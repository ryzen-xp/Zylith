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
        console.log(
          "[Frontend] 🔍 Validating note commitments against Merkle tree..."
        );
        let inputNote: Note | null = null;
        let noteIndex: number | null = null;
        let merkleProof: any = null;

        for (const candidate of candidateNotes) {
          if (candidate.index === undefined || candidate.index === null) {
            continue;
          }

          try {
            const proof = await aspClientInstance.getMerkleProof(
              candidate.index
            );
            const treeCommitment = BigInt(proof.leaf);

            const { generateCommitment } = await import("@/lib/commitment");
            const calculatedCommitment = await generateCommitment(
              candidate.secret,
              candidate.nullifier,
              candidate.amount
            );

            if (treeCommitment === calculatedCommitment) {
              inputNote = candidate;
              noteIndex = candidate.index;
              merkleProof = proof;
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
            }
          } catch (error: any) {
            console.log(
              `[Frontend] ⚠️ Skipping note at index ${candidate.index}: validation error - ${error.message}`
            );
            continue;
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
        });

        // Generate position commitment
        const positionCommitment = await generatePositionCommitment(
          inputNote.secret,
          tickLower,
          tickUpper
        );

        console.log(
          "[Frontend] 📋 Generated position commitment:",
          positionCommitment.toString()
        );

        // Step 1: Use Merkle Proof
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

        // Validate note against Merkle tree
        const validation = await validateNote(inputNote);

        console.log("[Frontend] ✅ Validation result:", {
          isValid: validation.isValid,
          isLegacy: validation.isLegacy,
          reason: validation.reason,
        });

        if (!validation.isValid) {
          if (validation.isLegacy) {
            throw new Error(
              `⚠️ Legacy Note Detected\n\n` +
                `This note was deposited before the Poseidon implementation fix. ` +
                `Please create a new deposit to update the commitment in the Merkle tree.`
            );
          } else {
            throw new Error(
              `⚠️ Invalid Note - Cannot Generate Valid Proof\n\n` +
                `The note's data doesn't match what's stored in the Merkle tree. ` +
                `Please create a new deposit.`
            );
          }
        }

        const proofLeaf = BigInt(merkleProof.leaf);

        // Step 2: Generate change note
        setState((prev) => ({ ...prev, proofStep: "generating_witness" }));
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

        // Use ASP endpoint for proof generation
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

        // Extract proof (first 8 elements)
        let extractedProof = proof;
        if (Array.isArray(proof) && proof.length > 8) {
          extractedProof = proof.slice(0, 8);
          console.warn(
            `[Frontend] ⚠️ Proof had ${proof.length} elements, extracted first 8`
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
        // 0: nullifier, 1: root, 2: tick_lower, 3: tick_upper, 4: liquidity, 5: new_commitment, 6: position_commitment
        if (publicInputs.length !== 7) {
          throw new Error(
            `Invalid public inputs length: expected 7 elements, got ${publicInputs.length}`
          );
        }

        console.log(
          `[Frontend] 📋 Raw public inputs received from backend:`,
          publicInputs
        );

        // Step 5: Convert BN254 to felt252
        const BN254_MODULUS = BigInt(
          "21888242871839275222246405745257275088548364400416034343698204186575808495617"
        );
        const STARKNET_FELT_MAX = BigInt(
          "3618502788666131106986593281521497120414687020801267626233049500247285301248"
        );

        const bn254ToFelt252 = (value: string | bigint): string => {
          try {
            const bigValue = typeof value === "string" ? BigInt(value) : value;

            // Check if this is a BN254 negative number
            if (bigValue > BN254_MODULUS / 2n) {
              const negativeValue = BN254_MODULUS - bigValue;
              const felt252Value = STARKNET_FELT_MAX - negativeValue;
              console.warn(
                `[Frontend] ⚠️ Converted BN254 negative to felt252: ${bigValue.toString()} -> ${felt252Value.toString()}`
              );
              return felt252Value.toString();
            }

            return (bigValue % STARKNET_FELT_MAX).toString();
          } catch (e) {
            console.warn(
              `[Frontend] ⚠️ Could not convert BN254 to felt252 for value: ${value}`,
              e
            );
            try {
              const bigValue = BigInt(value.toString());
              return (bigValue % STARKNET_FELT_MAX).toString();
            } catch {
              return value.toString();
            }
          }
        };

        const applyFeltModulo = (value: string): string => {
          try {
            const bigValue = BigInt(value);
            if (bigValue >= STARKNET_FELT_MAX) {
              const moduloValue = bigValue % STARKNET_FELT_MAX;
              console.warn(
                `[Frontend] ⚠️ Applied felt252 modulo to value: ${value} -> ${moduloValue.toString()}`
              );
              return moduloValue.toString();
            }
            return value;
          } catch (e) {
            console.warn(
              `[Frontend] ⚠️ Could not parse value as BigInt: ${value}`
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

        // Apply modulo to all proof values
        const normalizedProof = extractedProof.map(applyFeltModulo);

        // Apply modulo to all public input values
        const normalizedPublicInputs =
          convertedPublicInputs.map(applyFeltModulo);

        // Check for overflow values
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
            `[Frontend] ❌ OVERFLOW DETECTED! Some values exceed felt252 max.`
          );
        } else {
          console.log(
            `[Frontend] ✅ No overflow detected in proof or public inputs.`
          );
        }

        // Step 6: Execute transaction
        setState((prev) => ({ ...prev, proofStep: "verifying" }));

        console.log(
          `[Frontend] 📋 Executing mint liquidity with manual calldata`
        );

        // Validate inputs
        const I32_MAX = 2147483647;
        const I32_MIN = -2147483648;

        if (typeof tickLower !== "number" || typeof tickUpper !== "number") {
          throw new Error(
            `Invalid tick values: tickLower=${tickLower}, tickUpper=${tickUpper}`
          );
        }

        if (tickLower < I32_MIN || tickLower > I32_MAX) {
          throw new Error(`tickLower ${tickLower} is out of i32 range`);
        }
        if (tickUpper < I32_MIN || tickUpper > I32_MAX) {
          throw new Error(`tickUpper ${tickUpper} is out of i32 range`);
        }

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

        // Extract parameters from public_inputs
        const liquidityStr = normalizedPublicInputs[4]; // u128 as string
        const newCommitmentStr = normalizedPublicInputs[5]; // felt252 as string

        // Create Contract instance with account as provider
        const contract = new Contract(
          zylithAbi,
          CONFIG.ZYLITH_CONTRACT,
          account
        );

        console.log(`[Frontend] 📋 Contract call parameters:`);
        console.log(`  - proof: ${normalizedProof.length} elements`);
        console.log(
          `  - public_inputs: ${normalizedPublicInputs.length} elements`
        );
        console.log(`  - tick_lower (i32): ${tickLower}`);
        console.log(`  - tick_upper (i32): ${tickUpper}`);
        console.log(`  - liquidity (u128): ${liquidityStr}`);
        console.log(`  - new_commitment (felt252): ${newCommitmentStr}`);

        // Call the contract method - pass i32 values directly
        // Starknet.js will handle the serialization to Cairo i32 type
        const tx = await contract.private_mint_liquidity(
          normalizedProof,
          normalizedPublicInputs,
          tickLower, // Pass as JavaScript number (i32)
          tickUpper, // Pass as JavaScript number (i32)
          BigInt(liquidityStr), // u128
          newCommitmentStr // felt252
        );

        console.log(`[Frontend] ✅ Transaction sent: ${tx.transaction_hash}`);

        // Step 7: Track transaction
        addTransaction({
          hash: tx.transaction_hash,
          type: "mint",
          status: "pending",
          timestamp: Date.now(),
        });

        // Step 8: Wait for transaction
        await provider.waitForTransaction(tx.transaction_hash);

        // Step 9: Update portfolio
        removeNote(inputNote.commitment);
        addNote(changeNote);
        updateTransaction(tx.transaction_hash, "success");

        // Step 10: Update LP position store
        const positionId = positionCommitment.toString();
        const existingPosition = getPosition(positionId);

        if (existingPosition) {
          updatePosition(positionId, {
            liquidity: existingPosition.liquidity + liquidity,
            lastUpdated: Date.now(),
          });
        } else {
          addPosition({
            id: positionId,
            tickLower,
            tickUpper,
            liquidity,
            feeGrowthInside0LastX128: BigInt(0),
            feeGrowthInside1LastX128: BigInt(0),
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
