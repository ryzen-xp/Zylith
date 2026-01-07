"use client";

import { useState, useCallback } from "react";
import { useStarknet } from "./use-starknet";
import { useASP } from "./use-asp";
import { aspClient } from "@/lib/asp-client";
import { usePortfolioStore } from "./use-portfolio";
import { useLPPositionStore } from "@/stores/use-lp-position-store";
import {
  generateNote,
  Note,
  generatePositionCommitment,
} from "@/lib/commitment";
import { ZylithContractClient } from "@/lib/contracts/zylith-contract";
import { Contract, Account, CallData } from "starknet";
import { CONFIG } from "@/lib/config";
import zylithAbi from "@/lib/abis/zylith-abi.json";
import { validateNote } from "@/lib/note-validation";

interface LiquidityState {
  isLoading: boolean;
  error: string | null;
  proofStep:
    | "idle"
    | "fetching_merkle"
    | "generating_witness"
    | "computing_proof"
    | "formatting"
    | "verifying"
    | "complete"
    | "error";
}

/**
 * Helper function to convert i32 to felt252 for contract interface
 * Negative i32 values are represented as: PRIME - abs(value)
 * This matches the contract's expected format (contract accepts felt252, converts to i32 internally)
 */

function i32ToFelt252(value: number): string {
  if (value >= 0) {
    return value.toString();
  }
  // For negatives: 32-bit two's complement
  const TWO_POW_32 = BigInt(4294967296); // 2^32
  return (TWO_POW_32 + BigInt(value)).toString();
}

// Example:
// -1000 → "4294966296" (2^32 - 1000)
// 1000  → "1000"

/**
 * Hook for private liquidity operations
 * Handles mint, burn, and collect operations for LP positions
 */
export function useLiquidity() {
  const { account, provider } = useStarknet();
  const { client: aspClientInstance } = useASP();
  const { notes, removeNote, addNote, addTransaction, updateTransaction } =
    usePortfolioStore();
  const { addPosition, updatePosition, removePosition, getPosition } =
    useLPPositionStore();

  const [state, setState] = useState<LiquidityState>({
    isLoading: false,
    error: null,
    proofStep: "idle",
  });

  /**
   * Mint liquidity (add liquidity to a position)
   * Automatically selects a note from the portfolio with sufficient balance
   * @param amount Amount of tokens to use for liquidity (must match note's token)
   * @param tokenAddress Token address to use (optional, uses first available if not provided)
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to mint
   */
  const mintLiquidity = useCallback(
    async (
      amount: bigint,
      tokenAddress: string | undefined,
      tickLower: number,
      tickUpper: number,
      liquidity: bigint
    ): Promise<Note> => {
      if (!account) {
        throw new Error("Account not connected");
      }

      if (tickLower >= tickUpper) {
        throw new Error("tickLower must be less than tickUpper");
      }

      if (amount <= 0n) {
        throw new Error("Amount must be greater than zero");
      }

      setState({ isLoading: true, error: null, proofStep: "fetching_merkle" });

      try {
        // Step 0: Verify tree state and find a valid note from portfolio
        console.log(
          "[Frontend] 🔍 Verifying tree state and searching for valid note..."
        );

        // First, get tree info to know valid indices (notes start at index 0)
        const treeInfo = await aspClientInstance.getTreeInfo();
        console.log("[Frontend] 📋 Tree info:", {
          leafCount: treeInfo.leaf_count,
          merkleRoot: treeInfo.root,
          depth: treeInfo.depth,
          validIndices: `0-${treeInfo.leaf_count - 1}`,
        });

        if (treeInfo.leaf_count === 0) {
          throw new Error(
            "No deposits found in the Merkle tree. Please deposit tokens first."
          );
        }

        console.log(
          "[Frontend] 📋 Available notes in portfolio:",
          notes.length
        );

        // Filter notes: must have valid index (0 to leaf_count - 1), sufficient amount, and matching token (if specified)
        const candidateNotes = notes.filter((note) => {
          // Must have index defined
          if (note.index === undefined || note.index === null) {
            console.log(`[Frontend] ⚠️ Skipping note without index`);
            return false;
          }

          // Index must be valid (0 to leaf_count - 1, since notes start at 0)
          if (note.index < 0 || note.index >= treeInfo.leaf_count) {
            console.log(
              `[Frontend] ⚠️ Skipping note with invalid index: ${
                note.index
              } (valid: 0-${treeInfo.leaf_count - 1})`
            );
            return false;
          }

          // Must have sufficient balance
          if (note.amount < amount) {
            console.log(
              `[Frontend] ⚠️ Skipping note with insufficient balance: ${note.amount.toString()} < ${amount.toString()}`
            );
            return false;
          }

          // Must match token if specified
          if (tokenAddress && note.tokenAddress !== tokenAddress) {
            console.log(
              `[Frontend] ⚠️ Skipping note with different token: ${note.tokenAddress} !== ${tokenAddress}`
            );
            return false;
          }

          return true;
        });

        if (candidateNotes.length === 0) {
          const errorMsg = tokenAddress
            ? `No valid notes found with sufficient balance (${amount.toString()}) for token ${tokenAddress}. ` +
              `Tree has ${treeInfo.leaf_count} leaves (indices 0-${
                treeInfo.leaf_count - 1
              }). ` +
              `Please verify your notes have valid indices or deposit tokens first.`
            : `No valid notes found with sufficient balance (${amount.toString()}). ` +
              `Tree has ${treeInfo.leaf_count} leaves (indices 0-${
                treeInfo.leaf_count - 1
              }). ` +
              `Please verify your notes have valid indices or deposit tokens first.`;
          throw new Error(errorMsg);
        }

        // Validate commitment for each candidate note until we find a valid one
        // This ensures we only select notes whose commitment matches the Merkle tree
        console.log(
          "[Frontend] 🔍 Validating note commitments against Merkle tree..."
        );
        let inputNote: Note | null = null;
        let noteIndex: number | null = null;
        let merkleProof: any = null; // Store Merkle proof to reuse later

        for (const candidate of candidateNotes) {
          if (candidate.index === undefined || candidate.index === null) {
            continue; // Skip notes without index (shouldn't happen after filtering)
          }

          try {
            // Get Merkle proof to verify commitment matches
            const proof = await aspClientInstance.getMerkleProof(
              candidate.index
            );
            const treeCommitment = BigInt(proof.leaf);

            // Calculate what the commitment should be from note data
            const { generateCommitment } = await import("@/lib/commitment");
            const calculatedCommitment = await generateCommitment(
              candidate.secret,
              candidate.nullifier,
              candidate.amount
            );

            // Check if commitment matches
            if (treeCommitment === calculatedCommitment) {
              // This note is valid! Save the proof to reuse later
              inputNote = candidate;
              noteIndex = candidate.index;
              merkleProof = proof; // Save proof to avoid fetching again
              console.log("[Frontend] ✅ Found valid note:", {
                index: noteIndex,
                amount: inputNote.amount.toString(),
                commitment:
                  inputNote.commitment.toString().substring(0, 20) + "...",
                tokenAddress: inputNote.tokenAddress,
                treeCommitment:
                  treeCommitment.toString().substring(0, 20) + "...",
                matches: "✅ Commitment matches tree",
              });
              break;
            } else {
              console.log(
                `[Frontend] ⚠️ Skipping note at index ${candidate.index}: commitment mismatch`
              );
              console.log(
                `  Tree: ${treeCommitment.toString().substring(0, 20)}...`
              );
              console.log(
                `  Calculated: ${calculatedCommitment
                  .toString()
                  .substring(0, 20)}...`
              );
            }
          } catch (error: any) {
            console.log(
              `[Frontend] ⚠️ Skipping note at index ${candidate.index}: validation error - ${error.message}`
            );
            continue; // Try next note
          }
        }

        if (!inputNote || noteIndex === null) {
          throw new Error(
            `No valid notes found with matching commitments in the Merkle tree. ` +
              `All ${candidateNotes.length} candidate note(s) have commitment mismatches. ` +
              `This usually means the note's secret/nullifier/amount don't match what's stored in the tree. ` +
              `Please create a new deposit to generate a valid note.`
          );
        }

        console.log("[Frontend] ✅ Selected note:", {
          index: noteIndex,
          amount: inputNote.amount.toString(),
          commitment: inputNote.commitment.toString().substring(0, 20) + "...",
          tokenAddress: inputNote.tokenAddress,
          validIndex: `✅ Index ${noteIndex} is valid (0-${
            treeInfo.leaf_count - 1
          })`,
          validCommitment: "✅ Commitment matches Merkle tree",
        });

        // Generate position commitment: Mask(Poseidon(secret, tick_lower + tick_upper))
        // This must match the circuit's calculation in lp.circom
        const positionCommitment = await generatePositionCommitment(
          inputNote.secret,
          tickLower,
          tickUpper
        );

        console.log(
          "[Frontend] 📋 Generated position commitment:",
          positionCommitment.toString()
        );

        // Step 1: Use Merkle Proof (already fetched during validation, or fetch if not available)
        if (!merkleProof) {
          console.log(
            "[Frontend] 🔄 Fetching Merkle proof (not cached during validation)..."
          );
          merkleProof = await aspClientInstance.getMerkleProof(noteIndex);
        }
        const root = BigInt(merkleProof.root);
        if (root === BigInt(0)) {
          throw new Error("Invalid Merkle root from ASP");
        }

        console.log("[Frontend] 📋 Merkle proof fetched:", {
          root: merkleProof.root,
          leaf: merkleProof.leaf,
          pathLength: merkleProof.path?.length || 0,
        });

        // Step 0: Validate note against Merkle tree (security check)
        // This ensures the note can be used for ZK operations
        const validation = await validateNote(inputNote);

        console.log("[Frontend] ✅ Validation result:", {
          isValid: validation.isValid,
          isLegacy: validation.isLegacy,
          reason: validation.reason,
        });

        if (!validation.isValid) {
          // Note is invalid - provide helpful error message with actionable solution
          if (validation.isLegacy) {
            throw new Error(
              `⚠️ Legacy Note Detected\n\n` +
                `This note was deposited before the Poseidon implementation fix. ` +
                `The commitment in the Merkle tree was computed using Starknet's Poseidon, ` +
                `but the circuit now requires BN254 Poseidon.\n\n` +
                `🔧 Solution:\n` +
                `1. Go to the Deposit page\n` +
                `2. Create a new deposit with the same amount\n` +
                `3. The new note will use BN254 Poseidon and work with all ZK operations\n\n` +
                `Note: Your secret and nullifier are still valid - you just need to ` +
                `re-deposit to update the commitment in the Merkle tree.`
            );
          } else {
            // Provide more specific guidance based on the error
            const treeCommitmentStr =
              validation.treeCommitment?.toString() || "unknown";
            const calculatedStr =
              validation.calculatedCommitment?.toString() || "unknown";
            const legacyStr =
              validation.legacyCommitment?.toString() || "unknown";

            throw new Error(
              `⚠️ Invalid Note - Cannot Generate Valid Proof\n\n` +
                `The note's data (secret/nullifier/amount) doesn't match what's stored in the Merkle tree.\n\n` +
                `Details:\n` +
                `- Tree commitment: ${treeCommitmentStr}\n` +
                `- Calculated (BN254): ${calculatedStr}\n` +
                `- Legacy (Starknet): ${legacyStr}\n\n` +
                `🔧 Solution:\n` +
                `1. Go to the Deposit page\n` +
                `2. Create a new deposit with the amount you want to use\n` +
                `3. The new note will work with all ZK operations (swap, LP, withdraw)\n\n` +
                `This note cannot be used because the circuit verifies that you know the secret/nullifier ` +
                `that produce the commitment in the tree. Since they don't match, the proof would fail.`
            );
          }
        }

        console.log("[Frontend] ✅ Note validation passed:", {
          treeCommitment: validation.treeCommitment?.toString(),
          calculatedCommitment: validation.calculatedCommitment?.toString(),
        });

        const proofLeaf = BigInt(merkleProof.leaf);

        // Step 2: Generate change note (if needed)
        setState((prev) => ({ ...prev, proofStep: "generating_witness" }));
        // Calculate change amount: amount_in - liquidity (simplified for MVP)
        // In production, this should calculate actual token amounts needed for LP position
        const changeAmount =
          inputNote.amount >= liquidity ? inputNote.amount - liquidity : 0n;

        if (changeAmount < 0n) {
          throw new Error(
            `Insufficient balance: need ${liquidity.toString()}, have ${inputNote.amount.toString()}`
          );
        }

        const changeNote = await generateNote(
          changeAmount,
          inputNote.tokenAddress
        );

        // Step 3: Generate ZK Proof via Backend API
        setState((prev) => ({ ...prev, proofStep: "computing_proof" }));

        // Ensure pathElements are strings and pathIndices are numbers (0 or 1)
        // pathElements: array of strings (felt252 values)
        // pathIndices: array of numbers (0 or 1) - selector for left/right in Merkle tree
        const pathElements = Array.isArray(merkleProof.path)
          ? merkleProof.path.map((p: any) => p.toString())
          : [];
        const pathIndices = Array.isArray(merkleProof.path_indices)
          ? merkleProof.path_indices.map((p: any) => {
              const num =
                typeof p === "number" ? p : parseInt(p.toString(), 10);
              if (num !== 0 && num !== 1) {
                throw new Error(
                  `Invalid pathIndices value: ${num}. Must be 0 or 1.`
                );
              }
              return num;
            })
          : [];

        if (pathElements.length === 0 || pathIndices.length === 0) {
          throw new Error(
            "Invalid Merkle proof: pathElements or pathIndices is empty"
          );
        }

        console.log("[Frontend] 📋 Preparing proof inputs:", {
          pathElementsLength: pathElements.length,
          pathIndicesLength: pathIndices.length,
          root: merkleProof.root,
          nullifier: inputNote.nullifier.toString(),
          liquidity: liquidity.toString(),
          amount_in: inputNote.amount.toString(),
          amount_out: changeNote.amount.toString(),
        });

        // Use ASP endpoint for proof generation (uses rapidsnark for faster proofs)
        const aspUrl = CONFIG.ASP_SERVER_URL || "http://localhost:3000";
        const proofResponse = await fetch(`${aspUrl}/api/proof/lp-mint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Public inputs
            nullifier: inputNote.nullifier.toString(),
            root: merkleProof.root,
            tick_lower: tickLower.toString(),
            tick_upper: tickUpper.toString(),
            liquidity: liquidity.toString(),
            new_commitment: changeNote.commitment.toString(),
            position_commitment: positionCommitment.toString(),
            // Private inputs
            secret_in: inputNote.secret.toString(),
            amount_in: inputNote.amount.toString(),
            secret_out: changeNote.secret.toString(),
            nullifier_out: changeNote.nullifier.toString(),
            amount_out: changeNote.amount.toString(),
            pathElements: pathElements,
            pathIndices: pathIndices,
          }),
        });

        if (!proofResponse.ok) {
          const errorData = await proofResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Proof generation failed");
        }

        const proofData = await proofResponse.json();
        if (proofData.error) {
          throw new Error(proofData.error);
        }

        // Step 4: Format proof
        setState((prev) => ({ ...prev, proofStep: "formatting" }));
        const proof = proofData.full_proof_with_hints || proofData.proof;
        const publicInputs = proofData.public_inputs || [];

        // Extract proof from full_proof_with_hints if needed (similar to swap)
        let extractedProof = proof;
        if (Array.isArray(proof) && proof.length > 8) {
          // If proof includes public inputs, extract only the first 8 elements
          extractedProof = proof.slice(0, 8);
          console.warn(
            `[Frontend] ⚠️  Proof had ${proof.length} elements, extracted first 8`
          );
        }

        if (!Array.isArray(extractedProof) || extractedProof.length !== 8) {
          throw new Error(
            `Invalid proof length: expected 8 elements, got ${
              extractedProof?.length || 0
            }`
          );
        }

        if (!Array.isArray(publicInputs)) {
          throw new Error(
            `Invalid public inputs: expected array, got ${typeof publicInputs}`
          );
        }

        // LP circuit has exactly 7 public inputs:
        // 0: nullifier (felt252)
        // 1: root (felt252)
        // 2: tick_lower (i32)
        // 3: tick_upper (i32)
        // 4: liquidity (u128)
        // 5: new_commitment (felt252)
        // 6: position_commitment (felt252)
        if (publicInputs.length !== 7) {
          throw new Error(
            `Invalid public inputs length: expected 7 elements (LP circuit), got ${
              publicInputs.length
            }. Public inputs: [${publicInputs.join(", ")}]`
          );
        }

        console.log(
          `[Frontend] 📋 Raw public inputs received from backend:`,
          publicInputs
        );

        // Step 5: Convert BN254 to felt252 (circuit outputs BN254, Starknet needs felt252)
        const BN254_MODULUS = BigInt(
          "21888242871839275222246405745257275088548364400416034343698204186575808495617"
        );
        const STARKNET_FELT_MAX = BigInt(
          "3618502788666131106986593281521497120414687020801267626233049500247285301248"
        );

        /**
         * Convert a value from BN254 field to felt252 field
         * BN254 negative numbers are represented as (BN254_MODULUS - abs(value))
         * We need to convert them to felt252 negative representation: (STARKNET_FELT_MAX - abs(value))
         */
        const bn254ToFelt252 = (value: string | bigint): string => {
          try {
            const bigValue = typeof value === "string" ? BigInt(value) : value;

            // Check if this is a BN254 negative number (values > BN254_MODULUS/2 are negative in BN254)
            if (bigValue > BN254_MODULUS / 2n) {
              // This is a negative number in BN254
              const negativeValue = BN254_MODULUS - bigValue;
              const felt252Value = STARKNET_FELT_MAX - negativeValue;
              console.warn(
                `[Frontend] ⚠️  Converted BN254 negative to felt252: ${bigValue.toString()} -> ${felt252Value.toString()}`
              );
              return felt252Value.toString();
            }

            // Positive number, just ensure it's within felt252 range
            return (bigValue % STARKNET_FELT_MAX).toString();
          } catch (e) {
            console.warn(
              `[Frontend] ⚠️  Could not convert BN254 to felt252 for value: ${value}`,
              e
            );
            // Fallback: try to parse as string and apply modulo
            try {
              const bigValue = BigInt(value.toString());
              return (bigValue % STARKNET_FELT_MAX).toString();
            } catch {
              return value.toString();
            }
          }
        };

        /**
         * Apply felt252 modulo to ensure value is within valid range
         * This is a safety check after BN254 conversion
         */
        const applyFeltModulo = (value: string): string => {
          try {
            const bigValue = BigInt(value);
            if (bigValue >= STARKNET_FELT_MAX) {
              const moduloValue = bigValue % STARKNET_FELT_MAX;
              console.warn(
                `[Frontend] ⚠️  Applied felt252 modulo to value: ${value} -> ${moduloValue.toString()}`
              );
              return moduloValue.toString();
            }
            return value;
          } catch (e) {
            console.warn(
              `[Frontend] ⚠️  Could not parse value as BigInt: ${value}`
            );
            return value;
          }
        };

        // Convert all public inputs from BN254 to felt252
        console.log(
          `[Frontend] 🔄 Converting public inputs from BN254 to felt252...`
        );
        const convertedPublicInputs = publicInputs.map(
          (val: any, idx: number) => {
            const original = val.toString();
            const converted = bn254ToFelt252(val);
            if (converted !== original) {
              console.log(
                `[Frontend] 🔄 Public input[${idx}] converted: ${original} -> ${converted}`
              );
            }
            return converted;
          }
        );
        console.log(
          `[Frontend] ✅ Converted public inputs (felt252):`,
          convertedPublicInputs
        );

        // Apply modulo to all proof values (proof should already be in felt252, but apply modulo as safety)
        const normalizedProof = extractedProof.map(applyFeltModulo);

        // Apply modulo to all public input values (after BN254 conversion)
        const normalizedPublicInputs =
          convertedPublicInputs.map(applyFeltModulo);

        // Check for overflow values (after normalization)
        console.log(`[Frontend] 🔍 Checking for overflow values...`);
        let hasOverflow = false;
        normalizedProof.forEach((val, idx) => {
          const bigValue = BigInt(val);
          if (bigValue >= STARKNET_FELT_MAX) {
            console.error(
              `[Frontend] ❌ Overflow detected in proof[${idx}]: ${val}`
            );
            hasOverflow = true;
          }
        });
        normalizedPublicInputs.forEach((val, idx) => {
          const bigValue = BigInt(val);
          if (bigValue >= STARKNET_FELT_MAX) {
            console.error(
              `[Frontend] ❌ Overflow detected in publicInputs[${idx}]: ${val}`
            );
            hasOverflow = true;
          }
        });

        if (hasOverflow) {
          throw new Error(
            `[Frontend] ❌ OVERFLOW DETECTED! Some values still exceed felt252 max after normalization.`
          );
        } else {
          console.log(
            `[Frontend] ✅ No overflow detected in proof or public inputs.`
          );
        }

        // Step 6: Execute transaction using manual calldata construction
        setState((prev) => ({ ...prev, proofStep: "verifying" }));

        console.log(
          `[Frontend] 📋 Executing mint liquidity with manual calldata`
        );
        console.log(`[Frontend] 📋 Contract: ${CONFIG.ZYLITH_CONTRACT}`);
        console.log(`[Frontend] 📋 Proof: ${normalizedProof.length} elements`);
        console.log(
          `[Frontend] 📋 Public inputs: ${normalizedPublicInputs.length} elements`
        );

        // Verify contract is accessible (this also validates the ABI indirectly)
        console.log("[Frontend] 🔍 Verifying contract accessibility...");

        try {
          // Create contract instance - if ABI is invalid, this will fail
          const contract = new Contract(
            zylithAbi,
            CONFIG.ZYLITH_CONTRACT,
            provider
          );

          // Try to call a known method to verify ABI is working
          const merkleRoot = await contract.get_merkle_root();
          console.log(
            "[Frontend] ✅ Contract is accessible, merkle root:",
            merkleRoot.toString()
          );

          // Verify that private_mint_liquidity exists by checking if Contract has the method
          // Starknet.js Contract will have methods for all functions in the ABI
          if (!contract.private_mint_liquidity) {
            // Fallback: Check ABI directly
            const abiArray = Array.isArray(zylithAbi) ? zylithAbi : [];
            const method = abiArray.find(
              (item: any) =>
                item.name === "private_mint_liquidity" &&
                item.type === "function"
            );

            if (!method) {
              // Log all function names for debugging
              const allFunctions = abiArray.filter(
                (item: any) => item.type === "function"
              );
              console.error(
                "[Frontend] ❌ Available functions:",
                allFunctions.map((f: any) => f.name).join(", ")
              );
              throw new Error("❌ private_mint_liquidity not found in ABI!");
            }
          }

          console.log("[Frontend] ✅ Contract and ABI verified successfully");
        } catch (e) {
          console.error("[Frontend] ❌ Contract verification failed:", e);
          // Don't throw here - let the actual transaction attempt reveal the real error
          // The ABI might be fine, but the verification logic might be too strict
          console.warn(
            "[Frontend] ⚠️ Continuing despite verification warning - will attempt transaction"
          );
        }

        // Validate inputs
        const I32_MAX = 2147483647;
        const I32_MIN = -2147483648;

        if (typeof tickLower !== "number" || typeof tickUpper !== "number") {
          throw new Error(
            `Invalid tick values: tickLower=${tickLower}, tickUpper=${tickUpper}`
          );
        }

        // Validate range
        if (tickLower < I32_MIN || tickLower > I32_MAX) {
          throw new Error(`tickLower ${tickLower} is out of i32 range`);
        }
        if (tickUpper < I32_MIN || tickUpper > I32_MAX) {
          throw new Error(`tickUpper ${tickUpper} is out of i32 range`);
        }

        // Validate public_inputs array specifically
        if (normalizedPublicInputs.length !== 7) {
          throw new Error(
            `Invalid public_inputs length: expected 7, got ${normalizedPublicInputs.length}`
          );
        }

        // Validate each public input individually
        normalizedPublicInputs.forEach((val, idx) => {
          try {
            const bigVal = BigInt(val);
            if (bigVal < 0n || bigVal >= STARKNET_FELT_MAX) {
              throw new Error(
                `public_inputs[${idx}] is out of felt252 range: ${val}`
              );
            }
          } catch (e) {
            if (
              e instanceof Error &&
              e.message.includes("out of felt252 range")
            ) {
              throw e;
            }
            throw new Error(
              `public_inputs[${idx}] could not be parsed as BigInt: ${val}`
            );
          }
        });

        // Convert felt252 to i32 for tick_lower and tick_upper parameters
        // The contract expects i32 parameters, but public_inputs contain felt252 values
        // We need to convert felt252 back to JavaScript number for Starknet.js to serialize as i32
        const FELT_MAX = BigInt(
          "3618502788666131106986593281521497120414687020801267626233049500247285301248"
        );
        const I32_MAX_VAL = 2147483647n;
        const I32_MIN_VAL = -2147483648n;

        /**
         * Convert felt252 to i32 JavaScript number
         * Felt252 negative numbers are represented as: FELT_MAX - abs(value)
         * We need to convert back to JavaScript number for Starknet.js serialization
         */
        const felt252ToI32 = (value: string): number => {
          const bigValue = BigInt(value);

          // If value is in the upper half of felt252 field, it's negative
          if (bigValue > FELT_MAX / 2n) {
            // This is a negative number: convert felt252 to negative i32
            const negativeValue = bigValue - FELT_MAX;

            // Verify it's within i32 range
            if (negativeValue < I32_MIN_VAL || negativeValue > I32_MAX_VAL) {
              throw new Error(
                `Value ${negativeValue} is out of i32 range (${I32_MIN_VAL} to ${I32_MAX_VAL})`
              );
            }

            return Number(negativeValue);
          } else {
            // Positive number
            if (bigValue > I32_MAX_VAL) {
              throw new Error(
                `Value ${bigValue} is out of i32 range (${I32_MIN_VAL} to ${I32_MAX_VAL})`
              );
            }
            return Number(bigValue);
          }
        };

        // Convert tick values from i32 to felt252 for contract interface
        // The contract now accepts felt252 instead of i32 (for Starknet.js compatibility)
        const tickLowerFelt = i32ToFelt252(tickLower);
        const tickUpperFelt = i32ToFelt252(tickUpper);
        const liquidityStr = normalizedPublicInputs[4]; // u128 as string (already correct)
        const newCommitmentStr = normalizedPublicInputs[5]; // felt252 as string (already correct)

        console.log(
          `[Frontend] 📋 Transaction parameters (i32 → felt252 conversion):`
        );
        console.log(
          `  - tick_lower: ${tickLower} (i32) → ${tickLowerFelt} (felt252)`
        );
        console.log(
          `  - tick_upper: ${tickUpper} (i32) → ${tickUpperFelt} (felt252)`
        );
        console.log(`  - liquidity: ${liquidityStr} (u128)`);
        console.log(`  - new_commitment: ${newCommitmentStr} (felt252)`);
        console.log(
          `  - position_commitment: ${normalizedPublicInputs[6]} (felt252)`
        );

        // Verify that the felt252 values match what's in public_inputs
        // The contract will verify that public_inputs[2] == tick_lower_felt
        if (
          tickLowerFelt !== normalizedPublicInputs[2] ||
          tickUpperFelt !== normalizedPublicInputs[3]
        ) {
          console.warn(
            `[Frontend] ⚠️  Warning: Converted felt252 values don't match public_inputs!`
          );
          console.warn(
            `  - tick_lower: converted=${tickLowerFelt}, public_inputs[2]=${normalizedPublicInputs[2]}`
          );
          console.warn(
            `  - tick_upper: converted=${tickUpperFelt}, public_inputs[3]=${normalizedPublicInputs[3]}`
          );
        }

        // Execute transaction using Contract instance - let Starknet.js handle all serialization
        // The contract now accepts felt252 for tick_lower and tick_upper (not i32)
        console.log(
          `[Frontend] 📋 Executing mint liquidity with Starknet.js Contract instance...`
        );
        console.log(`[Frontend] 📋 Parameters:`);
        console.log(
          `  - proof: Array<felt252> (${normalizedProof.length} elements)`
        );
        console.log(
          `  - public_inputs: Array<felt252> (${normalizedPublicInputs.length} elements)`
        );
        console.log(`  - tick_lower_felt: felt252 = ${tickLowerFelt}`);
        console.log(`  - tick_upper_felt: felt252 = ${tickUpperFelt}`);
        console.log(`  - liquidity: u128 = ${liquidityStr}`);
        console.log(`  - new_commitment: felt252 = ${newCommitmentStr}`);

        // Create Contract instance with account as provider
        // This ensures Starknet.js handles all type serialization automatically
        const contract = new Contract(
          zylithAbi,
          CONFIG.ZYLITH_CONTRACT,
          account // ← CRITICAL: Pass account as provider for proper serialization
        );

        // Call the method directly - Starknet.js handles all serialization
        // Contract now accepts felt252 for tick_lower and tick_upper (not i32)
        const tx = await contract.private_mint_liquidity(
          normalizedProof, // Array<felt252> - Starknet.js serializes array correctly
          normalizedPublicInputs, // Array<felt252> - Starknet.js serializes array correctly
          tickLowerFelt, // felt252 (string) - Contract converts to i32 internally
          tickUpperFelt, // felt252 (string) - Contract converts to i32 internally
          BigInt(liquidityStr), // BigInt - Starknet.js serializes as u128
          newCommitmentStr // string - Starknet.js serializes as felt252
        );

        console.log(
          `[Frontend] ✅ Transaction sent via Contract instance: ${tx.transaction_hash}`
        );

        // Step 6: Track transaction
        addTransaction({
          hash: tx.transaction_hash,
          type: "mint",
          status: "pending",
          timestamp: Date.now(),
        });

        // Step 7: Wait for transaction
        await provider.waitForTransaction(tx.transaction_hash);

        // Step 8: Update portfolio
        removeNote(inputNote.commitment);
        addNote(changeNote);
        updateTransaction(tx.transaction_hash, "success");

        // Step 9: Update LP position store
        const positionId = positionCommitment.toString();
        const existingPosition = getPosition(positionId);

        if (existingPosition) {
          // Update existing position - add liquidity
          updatePosition(positionId, {
            liquidity: existingPosition.liquidity + liquidity,
            lastUpdated: Date.now(),
          });
        } else {
          // Create new position
          addPosition({
            id: positionId,
            tickLower,
            tickUpper,
            liquidity,
            feeGrowthInside0LastX128: BigInt(0), // Will be updated from contract events
            feeGrowthInside1LastX128: BigInt(0), // Will be updated from contract events
            tokensOwed0: BigInt(0),
            tokensOwed1: BigInt(0),
            createdAt: Date.now(),
            lastUpdated: Date.now(),
          });
        }

        setState({ isLoading: false, error: null, proofStep: "complete" });
        return changeNote;
      } catch (error: any) {
        const errorMessage = error?.message || "Mint liquidity failed";
        setState({ isLoading: false, error: errorMessage, proofStep: "error" });

        if (error?.transaction_hash) {
          updateTransaction(error.transaction_hash, "failed");
        }

        throw error;
      }
    },
    [
      account,
      provider,
      aspClientInstance,
      removeNote,
      addNote,
      addTransaction,
      updateTransaction,
      addPosition,
      updatePosition,
      getPosition,
    ]
  );

  /**
   * Burn liquidity (remove liquidity from a position)
   * @param inputNote Note to spend
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to burn
   * @param positionCommitment Unique identifier for the LP position
   */
  const burnLiquidity = useCallback(
    async (
      inputNote: Note,
      tickLower: number,
      tickUpper: number,
      liquidity: bigint,
      positionCommitment: bigint
    ): Promise<Note> => {
      if (!account) {
        throw new Error("Account not connected");
      }

      if (inputNote.index === undefined) {
        throw new Error("Input note must have a leaf index");
      }

      if (tickLower >= tickUpper) {
        throw new Error("tickLower must be less than tickUpper");
      }

      setState({ isLoading: true, error: null, proofStep: "fetching_merkle" });

      try {
        // Step 1: Fetch Merkle Proof
        const merkleProof = await aspClientInstance.getMerkleProof(
          inputNote.index
        );
        const root = BigInt(merkleProof.root);
        if (root === BigInt(0)) {
          throw new Error("Invalid Merkle root from ASP");
        }

        // Step 2: Generate output note
        setState((prev) => ({ ...prev, proofStep: "generating_witness" }));
        // TODO: Calculate actual output amount based on liquidity calculation
        const outputAmount = inputNote.amount; // Simplified
        const outputNote = await generateNote(
          outputAmount,
          inputNote.tokenAddress
        );

        // Step 3: Generate ZK Proof
        setState((prev) => ({ ...prev, proofStep: "computing_proof" }));
        const proofResponse = await fetch("/api/proof/lp-burn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nullifier: inputNote.nullifier.toString(),
            root: merkleProof.root,
            tick_lower: tickLower.toString(),
            tick_upper: tickUpper.toString(),
            liquidity: liquidity.toString(),
            new_commitment: outputNote.commitment.toString(),
            position_commitment: positionCommitment.toString(),
            secret_in: inputNote.secret.toString(),
            amount_in: inputNote.amount.toString(),
            secret_out: outputNote.secret.toString(),
            nullifier_out: outputNote.nullifier.toString(),
            amount_out: outputNote.amount.toString(),
            pathElements: merkleProof.path,
            pathIndices: merkleProof.path_indices,
          }),
        });

        if (!proofResponse.ok) {
          const errorData = await proofResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Proof generation failed");
        }

        const proofData = await proofResponse.json();
        if (proofData.error) {
          throw new Error(proofData.error);
        }

        // Step 4: Format and execute
        setState((prev) => ({ ...prev, proofStep: "formatting" }));
        const proof = proofData.full_proof_with_hints || proofData.proof;
        const publicInputs = proofData.public_inputs || [];

        setState((prev) => ({ ...prev, proofStep: "verifying" }));

        let tx: any;

        try {
          // Try to use ASP to prepare transaction
          const prepareResponse = await aspClient.prepareBurnLiquidity(
            inputNote.secret.toString(),
            inputNote.nullifier.toString(),
            inputNote.amount.toString(),
            inputNote.index!,
            tickLower,
            tickUpper,
            liquidity.toString(),
            outputNote.secret.toString(),
            outputNote.nullifier.toString(),
            outputNote.amount.toString()
          );

          // Execute prepared transaction from ASP
          if (
            prepareResponse.transactions &&
            prepareResponse.transactions.length > 0
          ) {
            const preparedTx = prepareResponse.transactions[0];
            tx = await account.execute({
              contractAddress: preparedTx.contract_address,
              entrypoint: preparedTx.entry_point,
              calldata: preparedTx.calldata,
            });

            // Update output note with commitment from ASP if provided
            if (prepareResponse.new_commitment) {
              outputNote.commitment = BigInt(prepareResponse.new_commitment);
            }
          } else {
            throw new Error("ASP returned empty transactions");
          }
        } catch (aspError: any) {
          // Fallback to manual execution if ASP is not ready or returns error
          if (
            aspError.message?.includes("NOT_IMPLEMENTED") ||
            aspError.message?.includes("not yet implemented")
          ) {
            console.warn(
              "ASP burn liquidity preparation not yet implemented, using manual execution"
            );
          } else {
            console.warn(
              "ASP burn liquidity preparation failed, using manual execution:",
              aspError
            );
          }

          // Manual execution (existing logic)
          // Use Contract directly to avoid type issues
          // Convert i32 to felt252 for contract interface
          const tickLowerFelt = i32ToFelt252(tickLower);
          const tickUpperFelt = i32ToFelt252(tickUpper);

          const contract = new Contract(
            zylithAbi,
            CONFIG.ZYLITH_CONTRACT,
            account
          );
          tx = await contract.private_burn_liquidity(
            proof,
            publicInputs,
            tickLowerFelt, // felt252 (contract converts to i32 internally)
            tickUpperFelt, // felt252 (contract converts to i32 internally)
            liquidity,
            outputNote.commitment
          );
        }

        addTransaction({
          hash: tx.transaction_hash,
          type: "burn",
          status: "pending",
          timestamp: Date.now(),
        });

        await provider.waitForTransaction(tx.transaction_hash);

        removeNote(inputNote.commitment);
        addNote(outputNote);
        updateTransaction(tx.transaction_hash, "success");

        // Update LP position store - remove or update liquidity
        const positionId = positionCommitment.toString();
        const existingPosition = getPosition(positionId);

        if (existingPosition) {
          const newLiquidity =
            existingPosition.liquidity > liquidity
              ? existingPosition.liquidity - liquidity
              : BigInt(0);

          if (newLiquidity === BigInt(0)) {
            // Remove position if all liquidity is burned
            removePosition(positionId);
          } else {
            // Update position with reduced liquidity
            updatePosition(positionId, {
              liquidity: newLiquidity,
              lastUpdated: Date.now(),
            });
          }
        }

        setState({ isLoading: false, error: null, proofStep: "complete" });
        return outputNote;
      } catch (error: any) {
        const errorMessage = error?.message || "Burn liquidity failed";
        setState({ isLoading: false, error: errorMessage, proofStep: "error" });

        if (error?.transaction_hash) {
          updateTransaction(error.transaction_hash, "failed");
        }

        throw error;
      }
    },
    [
      account,
      provider,
      aspClientInstance,
      removeNote,
      addNote,
      addTransaction,
      updateTransaction,
    ]
  );

  /**
   * Collect fees from a liquidity position
   * @param inputNote Note to spend
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param positionCommitment Unique identifier for the LP position
   */
  const collectFees = useCallback(
    async (
      inputNote: Note,
      tickLower: number,
      tickUpper: number,
      positionCommitment: bigint
    ): Promise<Note> => {
      if (!account) {
        throw new Error("Account not connected");
      }

      if (inputNote.index === undefined) {
        throw new Error("Input note must have a leaf index");
      }

      if (tickLower >= tickUpper) {
        throw new Error("tickLower must be less than tickUpper");
      }

      setState({ isLoading: true, error: null, proofStep: "fetching_merkle" });

      try {
        // Step 1: Fetch Merkle Proof
        const merkleProof = await aspClientInstance.getMerkleProof(
          inputNote.index
        );
        const root = BigInt(merkleProof.root);
        if (root === BigInt(0)) {
          throw new Error("Invalid Merkle root from ASP");
        }

        // Step 2: Generate output note (with collected fees)
        setState((prev) => ({ ...prev, proofStep: "generating_witness" }));
        // TODO: Calculate actual fees collected
        const outputAmount = inputNote.amount; // Simplified
        const outputNote = await generateNote(
          outputAmount,
          inputNote.tokenAddress
        );

        // Step 3: Generate ZK Proof
        setState((prev) => ({ ...prev, proofStep: "computing_proof" }));
        const proofResponse = await fetch("/api/proof/lp-collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nullifier: inputNote.nullifier.toString(),
            root: merkleProof.root,
            tick_lower: tickLower.toString(),
            tick_upper: tickUpper.toString(),
            new_commitment: outputNote.commitment.toString(),
            position_commitment: positionCommitment.toString(),
            secret_in: inputNote.secret.toString(),
            amount_in: inputNote.amount.toString(),
            secret_out: outputNote.secret.toString(),
            nullifier_out: outputNote.nullifier.toString(),
            amount_out: outputNote.amount.toString(),
            pathElements: merkleProof.path,
            pathIndices: merkleProof.path_indices,
          }),
        });

        if (!proofResponse.ok) {
          const errorData = await proofResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Proof generation failed");
        }

        const proofData = await proofResponse.json();
        if (proofData.error) {
          throw new Error(proofData.error);
        }

        // Step 4: Format and execute
        setState((prev) => ({ ...prev, proofStep: "formatting" }));
        const proof = proofData.full_proof_with_hints || proofData.proof;
        const publicInputs = proofData.public_inputs || [];

        setState((prev) => ({ ...prev, proofStep: "verifying" }));
        // Use Contract directly to avoid type issues
        // Convert i32 to felt252 for contract interface
        const tickLowerFelt = i32ToFelt252(tickLower);
        const tickUpperFelt = i32ToFelt252(tickUpper);

        const contract = new Contract(
          zylithAbi,
          CONFIG.ZYLITH_CONTRACT,
          account
        );

        const tx = await contract.private_collect(
          proof,
          publicInputs,
          tickLowerFelt, // felt252 (contract converts to i32 internally)
          tickUpperFelt, // felt252 (contract converts to i32 internally)
          outputNote.commitment
        );

        addTransaction({
          hash: tx.transaction_hash,
          type: "mint", // Using 'mint' type for collect
          status: "pending",
          timestamp: Date.now(),
        });

        await provider.waitForTransaction(tx.transaction_hash);

        removeNote(inputNote.commitment);
        addNote(outputNote);
        updateTransaction(tx.transaction_hash, "success");

        // Update LP position store - reset tokens owed after collecting
        const positionId = positionCommitment.toString();
        const existingPosition = getPosition(positionId);

        if (existingPosition) {
          // After collecting, tokensOwed should be reset (fees collected)
          // Note: We don't know the exact amounts collected without parsing events
          // This will be updated when we process Collect events
          updatePosition(positionId, {
            tokensOwed0: BigInt(0), // Will be updated from contract events
            tokensOwed1: BigInt(0), // Will be updated from contract events
            lastUpdated: Date.now(),
          });
        }

        setState({ isLoading: false, error: null, proofStep: "complete" });
        return outputNote;
      } catch (error: any) {
        const errorMessage = error?.message || "Collect fees failed";
        setState({ isLoading: false, error: errorMessage, proofStep: "error" });

        if (error?.transaction_hash) {
          updateTransaction(error.transaction_hash, "failed");
        }

        throw error;
      }
    },
    [
      account,
      provider,
      aspClientInstance,
      removeNote,
      addNote,
      addTransaction,
      updateTransaction,
    ]
  );

  return {
    mintLiquidity,
    burnLiquidity,
    collectFees,
    isLoading: state.isLoading,
    error: state.error,
    proofStep: state.proofStep,
  };
}
