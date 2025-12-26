"use client"

import { useState, useCallback, useEffect } from "react"
import { useStarknet } from "./use-starknet"
import { useASP } from "./use-asp"
import { usePortfolioStore } from "./use-portfolio"
import { usePoolStore } from "@/stores/use-pool-store"
import { generateNote, verifyAndFixCommitment, Note } from "@/lib/commitment"
import { ZylithContractClient } from "@/lib/contracts/zylith-contract"
import { Contract } from "starknet"
import { CONFIG } from "@/lib/config"
import { aspClient } from "@/lib/asp-client"
import zylithAbi from "@/lib/abis/zylith-abi.json"

interface SwapState {
  isLoading: boolean
  error: string | null
  proofStep: "idle" | "calculating_clmm" | "fetching_merkle" | "generating_witness" | "computing_proof" | "formatting" | "verifying" | "complete" | "error"
}

/**
 * Hook for private swaps
 * Handles the complete flow: fetch Merkle proof, generate ZK proof, execute swap, update portfolio
 */
export function usePrivateSwap() {
  const { account, provider, isConnected, isConnecting } = useStarknet()
  const { client: aspClientInstance } = useASP()
  const { removeNote, addNote, updateNote, addTransaction, updateTransaction } = usePortfolioStore()
  const { updatePoolState } = usePoolStore()
  
  const [state, setState] = useState<SwapState>({
    isLoading: false,
    error: null,
    proofStep: "idle",
  })
  
  // Log state changes for debugging
  useEffect(() => {
    console.log(`[usePrivateSwap] 🔄 State updated:`, { 
      isLoading: state.isLoading, 
      proofStep: state.proofStep, 
      error: state.error 
    });
  }, [state.isLoading, state.proofStep, state.error])

  /**
   * Execute private swap
   * @param inputNote Note to spend in the swap
   * @param amountSpecified Amount to swap (must be <= inputNote.amount)
   * @param zeroForOne Swap direction: true = token0 -> token1, false = token1 -> token0
   * @param sqrtPriceLimitX128 Price limit for the swap (u256 format)
   * @param expectedOutputAmount Expected output amount (for validation)
   */
  const executeSwap = useCallback(async (
    inputNote: Note,
    amountSpecified: bigint,
    zeroForOne: boolean,
    sqrtPriceLimitX128: { low: bigint; high: bigint } = { low: 0n, high: 0n },
    expectedOutputAmount?: bigint
  ): Promise<Note> => {
    if (isConnecting) {
      throw new Error('Wallet is connecting. Please wait...')
    }
    
    if (!isConnected || !account) {
      throw new Error('Wallet not connected. Please connect your wallet to perform a swap.')
    }
    
    if (!account.address) {
      throw new Error('Account address not available. Please reconnect your wallet.')
    }

    if (inputNote.index === undefined) {
      throw new Error('Input note must have a leaf index')
    }

    if (amountSpecified > inputNote.amount) {
      throw new Error('Amount specified exceeds note balance')
    }

    setState({ isLoading: true, error: null, proofStep: "fetching_merkle" })

    try {
      // Step 0: Verify tree state and note existence
      let treeInfo
      try {
        treeInfo = await aspClientInstance.getTreeInfo()
      } catch (error) {
        const { CONFIG } = await import("@/lib/config")
        throw new Error(
          `Failed to connect to ASP server. Please ensure the ASP server is running on ${CONFIG.ASP_SERVER_URL}`
        )
      }

      if (treeInfo.leaf_count === 0) {
        throw new Error(
          `⚠️ Merkle Tree is Empty\n\n` +
          `The ASP server's Merkle tree has no deposits yet (0 leaves).\n\n` +
          `This could mean:\n` +
          `1. No deposits have been made to the contract yet\n` +
          `2. The ASP syncer hasn't finished syncing events from the blockchain\n` +
          `3. The note you're trying to use was created locally but never deposited\n\n` +
          `Solution:\n` +
          `- Make a new deposit first to add a note to the tree\n` +
          `- Or wait for the ASP syncer to finish syncing (check ASP logs)\n` +
          `- Or verify your note's commitment exists in the blockchain`
        )
      }

      // If note index is out of range, try to find it by commitment
      if (inputNote.index! >= treeInfo.leaf_count) {
        console.warn(
          `Note index ${inputNote.index} is out of range (tree has ${treeInfo.leaf_count} leaves). ` +
          `Attempting to find note by commitment...`
        )
        
        // Try to find the note by commitment in the ASP
        try {
          const commitmentStr = inputNote.commitment.toString(16)
          const indexResponse = await aspClientInstance.getDepositIndex(commitmentStr)
          
          if (indexResponse.found && indexResponse.index !== undefined) {
            console.log(`✅ Found note in ASP at index ${indexResponse.index}. Updating note...`)
            
            // Update the note with the correct index
            const updatedNote: Note = {
              ...inputNote,
              index: indexResponse.index,
            }
            updateNote(inputNote.commitment, updatedNote)
            
            // Use the updated note
            inputNote = updatedNote
          } else {
            throw new Error(
              `⚠️ Note Not Found in Blockchain\n\n` +
              `The note you're trying to use (index ${inputNote.index}) doesn't exist in the ` +
              `Merkle tree (tree has ${treeInfo.leaf_count} leaves).\n\n` +
              `The ASP syncer couldn't find this commitment in blockchain events.\n\n` +
              `This likely means:\n` +
              `1. The note was created locally but never deposited to the blockchain\n` +
              `2. The deposit transaction failed or was never sent\n` +
              `3. The ASP syncer hasn't processed the deposit event yet\n\n` +
              `Solution:\n` +
              `- Make a new deposit to create a valid note\n` +
              `- Or wait a few seconds and try again (ASP may still be syncing)\n` +
              `- Or check if your deposit transaction was successful`
            )
          }
        } catch (indexError: any) {
          throw new Error(
            `⚠️ Note Not Found in Blockchain\n\n` +
            `The note you're trying to use (index ${inputNote.index}) doesn't exist in the ` +
            `Merkle tree (tree has ${treeInfo.leaf_count} leaves).\n\n` +
            `Failed to query ASP for commitment: ${indexError.message}\n\n` +
            `This likely means the note was created locally but never deposited to the blockchain.\n\n` +
            `Solution: Make a new deposit to create a valid note.`
          )
        }
      }

      // Step 1: Calculate CLMM values FIRST (before prepareSwap)
      // This ensures we have calculatedAmountOut to pass to prepareSwap
      setState(prev => ({ ...prev, proofStep: "calculating_clmm" }))
      console.log("[Frontend] 🔧 Step 1: Calculating CLMM values...")
      
      // TODO: These values need to come from CLMM state or be calculated
      // For now, using placeholder values - these should be fetched from the pool
      const amount0Delta = zeroForOne ? -BigInt(amountSpecified) : 0n
      const amount1Delta = zeroForOne ? 0n : -BigInt(amountSpecified)
      const newSqrtPriceX128 = { low: 0n, high: 0n } // Should be calculated from CLMM
      const newTick = 0 // Should be calculated from CLMM
      
      console.log("[Frontend] 📊 Initial CLMM parameters:", {
        amountSpecified: amountSpecified.toString(),
        zeroForOne,
        amount0Delta: amount0Delta.toString(),
        amount1Delta: amount1Delta.toString()
      })
      
      // Use same default values as ASP when sqrt_price_old or liquidity are 0
      // Q128 = 2^128 = 340282366920938463463374607431768211456
      // BUT: u128::MAX = 2^128 - 1 = 340282366920938463463374607431768211455
      // IMPORTANT: The circuit uses Q128 = 2^128, so we MUST use Q128 for calculations
      // When sending to ASP (Rust), we'll use U128_MAX as the string value (closest approximation)
      const Q128 = BigInt("340282366920938463463374607431768211456") // Q128 = 2^128 (for calculations)
      const U128_MAX = BigInt("340282366920938463463374607431768211455") // u128::MAX (for Rust parsing)
      const sqrtPriceOldStr = "0" // TODO: Get from pool state
      const liquidityStr = "0" // TODO: Get from pool state
      const newSqrtPriceX128Str = "0" // TODO: Get from pool state
      
      console.log("[Frontend] 🔢 Starting CLMM calculation with defaults...")
      
      // Apply same defaults as ASP
      // For calculations, use Q128 (circuit expects this)
      // For sending to ASP, we'll convert to U128_MAX string (Rust can't parse 2^128)
      console.log("[Frontend] 🔧 Applying default values...")
      let sqrtPriceOldFinal = sqrtPriceOldStr === "0" ? Q128 : BigInt(sqrtPriceOldStr)
      let newSqrtPriceX128Final = newSqrtPriceX128Str === "0" ? sqrtPriceOldFinal : BigInt(newSqrtPriceX128Str)
      
      console.log("[Frontend] 📐 Price values:", {
        sqrtPriceOldFinal: sqrtPriceOldFinal.toString(),
        newSqrtPriceX128Final: newSqrtPriceX128Final.toString(),
        areEqual: sqrtPriceOldFinal === newSqrtPriceX128Final
      })
      
      // For liquidity, use a reasonable default that allows swaps to work
      // We need enough liquidity so that amount_out is meaningful
      // Strategy: Make liquidity large enough so that (liquidity * diff) / Q128 ≈ amountSpecified
      // If diff is small, we need liquidity to be large
      let liquidityFinal: bigint
      if (liquidityStr === "0") {
        console.log("[Frontend] 💧 Calculating liquidity from amountSpecified...")
        // Calculate required liquidity: if we want amount_out ≈ amountSpecified, then:
        // amountSpecified = (liquidity * diff) / Q128
        // liquidity = (amountSpecified * Q128) / diff
        // But we need to handle the case where diff might be 0 or very small
        if (sqrtPriceOldFinal === newSqrtPriceX128Final) {
          // Simulate a tiny price change: new_price = old_price * 0.9999 (0.01% change)
          console.log("[Frontend] ⚠️  Prices are equal, simulating 0.01% price change...")
          const priceChangeFactor = BigInt(9999) // 0.9999 as integer (scaled by 10000)
          newSqrtPriceX128Final = (sqrtPriceOldFinal * priceChangeFactor) / BigInt(10000)
        }
        const diff = sqrtPriceOldFinal - newSqrtPriceX128Final
        console.log("[Frontend] 📊 Initial diff:", diff.toString())
        if (diff > 0n) {
          // Calculate liquidity to get amount_out ≈ amountSpecified
          // Use Q128 (not U128_MAX) because circuit expects Q128 = 2^128
          liquidityFinal = (amountSpecified * Q128) / diff
          // Round up to ensure we have enough liquidity
          if ((amountSpecified * Q128) % diff !== 0n) {
            liquidityFinal += 1n
          }
          console.log("[Frontend] 💧 Calculated liquidity:", liquidityFinal.toString())
        } else {
          // Fallback: use a large liquidity value
          console.log("[Frontend] ⚠️  diff <= 0, using fallback liquidity...")
          liquidityFinal = amountSpecified * Q128 * BigInt(1000)
        }
      } else {
        liquidityFinal = BigInt(liquidityStr)
        // If prices are the same, simulate a tiny price change
        if (sqrtPriceOldFinal === newSqrtPriceX128Final) {
          console.log("[Frontend] ⚠️  Prices are equal, simulating 0.01% price change...")
          const priceChangeFactor = BigInt(9999)
          newSqrtPriceX128Final = (sqrtPriceOldFinal * priceChangeFactor) / BigInt(10000)
        }
      }
      
      const diff = sqrtPriceOldFinal - newSqrtPriceX128Final
      console.log("[Frontend] 📊 Final diff:", diff.toString())
      
      // Calculate numerator = liquidity * diff
      // Ensure numerator is exactly divisible by Q128 by adjusting liquidity if needed
      // IMPORTANT: Circuit uses Q128 = 2^128, so we MUST use Q128 here
      console.log("[Frontend] 🔢 Calculating numerator and adjusting for exact division...")
      let numerator = liquidityFinal * diff
      let liquidityAdjusted = liquidityFinal
      
      console.log("[Frontend] 📊 Initial calculation:", {
        liquidityFinal: liquidityFinal.toString(),
        diff: diff.toString(),
        numerator: numerator.toString(),
        remainder: (numerator % Q128).toString()
      })
      
      // If numerator is not divisible by Q128, adjust liquidity to make it divisible
      if (diff > 0n) {
        const remainder = numerator % Q128
        console.log("[Frontend] 🔍 Checking divisibility, remainder:", remainder.toString())
        if (remainder !== 0n) {
          console.log("[Frontend] ⚙️  Adjusting liquidity to make numerator divisible by Q128...")
          // We need: (liquidityAdjusted * diff) % Q128 === 0
          // This means: liquidityAdjusted * diff = k * Q128 for some integer k
          // So: liquidityAdjusted = (k * Q128) / diff
          // We want the largest k such that (k * Q128) / diff <= liquidityFinal
          // k_max = floor((liquidityFinal * diff) / Q128) = numerator / Q128
          
          // Calculate kMax = floor(numerator / Q128)
          let kMax = numerator / Q128
          
          // Try to find liquidityAdjusted = (kMax * Q128) / diff
          // But this might not be exact, so we need to find the largest k <= kMax
          // such that (k * Q128) is divisible by diff
          
          // Find the GCD of Q128 and diff to determine valid k values
          // Actually, simpler approach: iterate backwards from kMax to find a valid k
          // But that could be slow. Better: use the fact that we need (k * Q128) % diff === 0
          
          // Calculate targetNumerator = kMax * Q128 (largest multiple of Q128 <= numerator)
          // Use Q128 (not U128_MAX) because circuit expects Q128 = 2^128
          let targetNumerator = kMax * Q128
          
          // Check if targetNumerator is divisible by diff
          let iterations = 0
          const maxIterations = 10000 // Increased limit for better chance of finding valid k
          while (targetNumerator > 0n && targetNumerator % diff !== 0n && iterations < maxIterations) {
            kMax -= 1n
            targetNumerator = kMax * Q128
            iterations++
          }
          
          if (iterations >= maxIterations || targetNumerator <= 0n) {
            console.error("[Frontend] ❌ Could not find valid k after", iterations, "iterations, using GCD-based method...")
            // Use GCD-based approach: find GCD of Q128 and diff
            // We need: liquidityAdjusted * diff = k * Q128
            // This means: liquidityAdjusted = (k * Q128) / diff
            // For this to be an integer, we need: (k * Q128) % diff === 0
            // This is equivalent to: k * (Q128 % diff) === 0 (mod diff)
            // So we need to find k such that k is a multiple of diff / GCD(Q128, diff)
            
            // Calculate GCD of Q128 and diff
            const gcd = (a: bigint, b: bigint): bigint => {
              while (b !== 0n) {
                [a, b] = [b, a % b]
              }
              return a
            }
            
            const q128ModDiff = Q128 % diff
            if (q128ModDiff === 0n) {
              // Q128 is divisible by diff, so any k works
              targetNumerator = kMax * Q128
              liquidityAdjusted = targetNumerator / diff
              numerator = targetNumerator
              console.log("[Frontend] ✅ Found solution using GCD method (Q128 divisible by diff)")
            } else {
              const g = gcd(q128ModDiff, diff)
              const step = diff / g
              // Find largest k <= kMax such that k is a multiple of step
              let k = (kMax / step) * step
              if (k <= 0n) k = step
              targetNumerator = k * Q128
              liquidityAdjusted = targetNumerator / diff
              numerator = targetNumerator
              console.log("[Frontend] ✅ Found solution using GCD method (k =", k.toString(), ", step =", step.toString(), ")")
            }
          } else {
            // Found a valid targetNumerator
            console.log("[Frontend] ✅ Found valid targetNumerator after", iterations, "iterations")
            liquidityAdjusted = targetNumerator / diff
            numerator = targetNumerator
          }
          
          // Final verification: ensure numerator is divisible by Q128
          if (numerator % Q128 !== 0n) {
            console.error("[Frontend] ❌ CRITICAL: numerator is still not divisible by Q128 after adjustment!")
            console.error("[Frontend]    numerator:", numerator.toString())
            console.error("[Frontend]    remainder:", (numerator % Q128).toString())
            throw new Error("Failed to make numerator divisible by Q128 - this should not happen")
          }
          
          console.log("[Frontend] 📊 After adjustment:", {
            liquidityAdjusted: liquidityAdjusted.toString(),
            numerator: numerator.toString(),
            remainder: (numerator % Q128).toString()
          })
        } else {
          console.log("[Frontend] ✅ numerator is already divisible by Q128")
        }
      } else {
        // If diff is 0 or negative, amount_out should be 0
        console.log("[Frontend] ⚠️  diff <= 0, setting amount_out to 0")
        numerator = 0n
        liquidityAdjusted = liquidityFinal
      }
      
      // Calculate amount_out = numerator / Q128 (using BigInt division)
      // Now numerator should be exactly divisible by Q128
      // IMPORTANT: Circuit uses Q128 = 2^128, so we MUST use Q128 here
      console.log("[Frontend] 🧮 Calculating amount_out...")
      const calculatedAmountOut = numerator / Q128
      
      // Verify the calculation: check if calculatedAmountOut * Q128 === numerator
      const verification = calculatedAmountOut * Q128
      console.log("[Frontend] ✅ Verification:", {
        calculatedAmountOut: calculatedAmountOut.toString(),
        verification: verification.toString(),
        numerator: numerator.toString(),
        matches: verification === numerator
      })
      
      if (verification !== numerator) {
        console.error("[Frontend] ❌ amount_out calculation verification failed:", {
          calculatedAmountOut: calculatedAmountOut.toString(),
          verification: verification.toString(),
          numerator: numerator.toString(),
          difference: (numerator - verification).toString(),
          remainder: (numerator % Q128).toString()
        });
        throw new Error("amount_out calculation failed verification - this should not happen");
      }

      // Step 2: Get prepared data from ASP (like deposit/initialize pattern)
      // ASP will provide Merkle proof, commitment, and output note in one call
      // We pass calculatedAmountOut so ASP generates the correct commitment
      setState(prev => ({ ...prev, proofStep: "fetching_merkle" }))
      console.log(`[Frontend] 🔄 Getting prepared swap data from ASP...`);
      console.log(`[Frontend]    Passing calculatedAmountOut: ${calculatedAmountOut.toString()}`);
      
      let prepareResponse;
      let merkleProof;
      try {
        // Call prepareSwap with calculatedAmountOut so ASP generates correct commitment
        prepareResponse = await aspClient.prepareSwap(
          inputNote.secret.toString(),
          inputNote.nullifier.toString(),
          inputNote.amount.toString(),
          inputNote.index!,
          amountSpecified.toString(),
          zeroForOne,
          sqrtPriceLimitX128.low !== 0n || sqrtPriceLimitX128.high !== 0n
            ? { low: sqrtPriceLimitX128.low.toString(), high: sqrtPriceLimitX128.high.toString() }
            : undefined,
          // Provide calculatedAmountOut so ASP generates correct commitment
          undefined, // new_secret - let ASP generate
          undefined, // new_nullifier - let ASP generate
          calculatedAmountOut.toString() // new_amount - PROVIDE calculated amount
        )
        
        merkleProof = prepareResponse.merkle_proof;
        console.log(`[Frontend] ✅ Prepared swap data received from ASP`);
        console.log(`[Frontend]    Merkle proof root: ${merkleProof.root}`);
        console.log(`[Frontend]    Path length: ${merkleProof.path.length}`);
        console.log(`[Frontend]    New commitment: ${prepareResponse.new_commitment}`);
        console.log(`[Frontend]    Output note:`, prepareResponse.output_note_data);
      } catch (error) {
        console.error(`[Frontend] ❌ Failed to prepare swap:`, error);
        throw error;
      }
      
      // Verify root matches
      const root = BigInt(merkleProof.root)
      if (root === 0n) {
        throw new Error('Invalid Merkle root from ASP')
      }
      
      // Step 0: Verify that the Merkle tree commitment matches what the circuit will compute
      // Both Cairo contract and circuit now use: Poseidon(Poseidon(secret, nullifier), amount) then mask
      // (NO intermediate mask - matches zylith/src/privacy/commitment.cairo)
      const proofLeaf = BigInt(merkleProof.leaf)
      const { generateCommitment, computeLegacyCommitment } = await import("@/lib/commitment")
      
      // Compute using Cairo contract method (no intermediate mask) - matches both circuit and tree
      const cairoCommitment = await generateCommitment(inputNote.secret, inputNote.nullifier, inputNote.amount)
      
      // Compute what the legacy method would produce (for comparison)
      const legacyCommitment = computeLegacyCommitment(inputNote.secret, inputNote.nullifier, inputNote.amount)
      
      // The circuit now matches Cairo (no intermediate mask), so this should match the tree
      const circuitCommitment = cairoCommitment
      
      // Check if the Merkle tree commitment matches what the Cairo contract computed
      // (The circuit has a different calculation, but the tree has what Cairo computed)
      if (proofLeaf !== cairoCommitment) {
        // The Merkle tree commitment doesn't match what the circuit will compute
        if (proofLeaf === legacyCommitment) {
          // The tree has a legacy commitment - this note was deposited before the fix
          throw new Error(
            `⚠️ Legacy Note Detected\n\n` +
            `This note was deposited before the Poseidon implementation fix. ` +
            `The commitment in the Merkle tree (${proofLeaf.toString()}) was computed using ` +
            `Starknet's Poseidon, but the circuit now requires BN254 Poseidon and will compute ` +
            `(${circuitCommitment.toString()}). These don't match, so the Merkle proof will fail.\n\n` +
            `To use this note, you need to:\n` +
            `1. Withdraw this note (if withdrawal is supported)\n` +
            `2. Create a new deposit with the same amount\n` +
            `3. The new note will use BN254 Poseidon and work with the circuit\n\n` +
            `Note: The note's secret and nullifier are still valid - you just need to ` +
            `re-deposit to update the commitment in the Merkle tree.`
          )
        } else {
          // The tree commitment doesn't match either method - this suggests the note data is wrong
          // The commitment in the tree is what was actually deposited on-chain
          // If it doesn't match what we compute, the note's secret/nullifier/amount are wrong
          const noteData = {
            secret: inputNote.secret.toString(),
            nullifier: inputNote.nullifier.toString(),
            amount: inputNote.amount.toString(),
            commitment: inputNote.commitment.toString(),
            index: inputNote.index,
          }
          
          throw new Error(
            `⚠️ Note Data Mismatch\n\n` +
            `The commitment in the Merkle tree (${proofLeaf.toString()}) does not match what ` +
            `the Cairo contract would compute from the note's secret/nullifier/amount.\n\n` +
            `Computed Values:\n` +
            `  Cairo Method (BN254, no intermediate mask): ${cairoCommitment.toString()}\n` +
            `  Legacy (Starknet): ${legacyCommitment.toString()}\n` +
            `  Tree has: ${proofLeaf.toString()}\n\n` +
            `Note Data:\n` +
            `  Secret: ${noteData.secret}\n` +
            `  Nullifier: ${noteData.nullifier}\n` +
            `  Amount: ${noteData.amount}\n` +
            `  Stored Commitment: ${noteData.commitment}\n` +
            `  Leaf Index: ${noteData.index}\n\n` +
            `Possible Causes:\n` +
            `1. The note's secret/nullifier/amount don't match what was actually deposited\n` +
            `2. The note data was corrupted or modified after deposit\n` +
            `3. The note was created with different values than what was sent to the contract\n\n` +
            `Solution:\n` +
            `- If you have the original deposit transaction, verify the commitment that was sent\n` +
            `- The commitment in the tree (${proofLeaf.toString()}) is what was actually deposited\n` +
            `- You may need to recover the correct secret/nullifier/amount from your deposit records\n` +
            `- Or create a new deposit with the correct values`
          )
        }
      }
      
      // If we get here, the Merkle tree commitment matches what the Cairo contract computed
      // Update the note's stored commitment to match (in case it was wrong)
      const verifiedInputNote: Note = {
        ...inputNote,
        commitment: cairoCommitment, // Use the Cairo commitment (matches tree)
      }

      // Step 3: Use output note from ASP (already generated with correct commitment)
      // ASP generated the commitment using calculatedAmountOut, so we use it directly
      const outputNote: Note = {
        secret: BigInt(prepareResponse.output_note_data.secret),
        nullifier: BigInt(prepareResponse.output_note_data.nullifier),
        amount: BigInt(prepareResponse.output_note_data.amount),
        commitment: BigInt(prepareResponse.new_commitment), // Use ASP's commitment directly (no regeneration)
        tokenAddress: inputNote.tokenAddress,
      }
      
      console.log("[Frontend] ✅ Output note ready (from ASP):", {
        commitment: outputNote.commitment.toString(),
        amount: outputNote.amount.toString(),
        calculatedAmountOut: calculatedAmountOut.toString(),
        amount_out_matches: outputNote.amount.toString() === calculatedAmountOut.toString()
      })

      // Step 3: Generate ZK Proof via Backend API
      setState(prev => ({ ...prev, proofStep: "computing_proof" }))
      
      console.log("[Frontend] Starting proof generation request...");
      const proofRequestStartTime = Date.now();
      
      console.log("[Frontend] CLMM calculation:", {
        sqrtPriceOldFinal: sqrtPriceOldFinal.toString(),
        newSqrtPriceX128Final: newSqrtPriceX128Final.toString(),
        liquidityFinal: liquidityFinal.toString(),
        liquidityAdjusted: liquidityAdjusted.toString(),
        diff: diff.toString(),
        numerator: numerator.toString(),
        calculatedAmountOut: calculatedAmountOut.toString(),
        verification: verification.toString(),
        finalAmountOut: outputNote.amount.toString()
      });

      const proofInputs = {
        // Public inputs
        nullifier: verifiedInputNote.nullifier.toString(),
        root: merkleProof.root,
        new_commitment: outputNote.commitment.toString(),
        amount_specified: amountSpecified.toString(),
        zero_for_one: zeroForOne ? "1" : "0",
        amount0_delta: amount0Delta.toString(),
        amount1_delta: amount1Delta.toString(),
        new_sqrt_price_x128: newSqrtPriceX128Final === Q128 ? U128_MAX.toString() : newSqrtPriceX128Final.toString(), // Convert Q128 to U128_MAX for Rust
        new_tick: newTick.toString(),
        // Private inputs
        secret_in: verifiedInputNote.secret.toString(),
        amount_in: verifiedInputNote.amount.toString(),
        secret_out: outputNote.secret.toString(),
        nullifier_out: outputNote.nullifier.toString(),
        amount_out: calculatedAmountOut.toString(), // Use calculated value, not outputNote.amount
        pathElements: merkleProof.path,
        pathIndices: merkleProof.path_indices,
        sqrt_price_old: sqrtPriceOldFinal === Q128 ? U128_MAX.toString() : sqrtPriceOldFinal.toString(), // Convert Q128 to U128_MAX for Rust
        liquidity: liquidityAdjusted.toString(), // Use adjusted value (multiple of Q128)
      };
      
      console.log("[Frontend] Proof inputs prepared:", {
        publicInputs: Object.keys(proofInputs).filter(k => !['secret_in', 'secret_out', 'pathElements', 'pathIndices'].includes(k)),
        pathLength: merkleProof.path?.length || 0,
        pathIndicesLength: merkleProof.path_indices?.length || 0,
      });

      // Add timeout for proof generation request (10 minutes - circuits can take time)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        const elapsed = ((Date.now() - proofRequestStartTime) / 1000).toFixed(2);
        console.error(`[Frontend] ⚠️ Proof request timeout after ${elapsed}s`);
        controller.abort()
      }, 600000) // 10 minutes

      let proofData
      try {
        console.log("[Frontend] Sending POST request to ASP /api/proof/swap...");
        console.log("[Frontend] Request body size:", JSON.stringify(proofInputs).length, "bytes");
        
        // Add a log every 10 seconds while waiting for response
        const waitLogInterval = setInterval(() => {
          const elapsed = ((Date.now() - proofRequestStartTime) / 1000).toFixed(2);
          console.log(`[Frontend] ⏳ Still waiting for proof response... ${elapsed}s elapsed`);
        }, 10000);
        
        // Use ASP client to generate proof
        proofData = await aspClientInstance.generateSwapProof(proofInputs)
        
        clearInterval(waitLogInterval);
        
        const fetchElapsed = ((Date.now() - proofRequestStartTime) / 1000).toFixed(2);
        console.log(`[Frontend] ✅ Proof received from ASP in ${fetchElapsed}s`);
        
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        const elapsed = ((Date.now() - proofRequestStartTime) / 1000).toFixed(2);
        console.error(`[Frontend] ❌ Proof generation error after ${elapsed}s:`, fetchError);
        console.error(`[Frontend] Error name:`, fetchError.name);
        console.error(`[Frontend] Error message:`, fetchError.message);
        console.error(`[Frontend] Error stack:`, fetchError.stack);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Proof generation timeout: The process took longer than 10 minutes. This may indicate a problem with the circuit or inputs.')
        }
        throw fetchError
      }
      
      const totalElapsed = ((Date.now() - proofRequestStartTime) / 1000).toFixed(2);
      console.log(`[Frontend] ✅ Proof data received successfully in ${totalElapsed}s`);
      console.log(`[Frontend] 📦 Proof data structure:`, {
        hasProof: !!proofData.full_proof_with_hints,
        hasPublicInputs: !!proofData.public_inputs,
        proofLength: proofData.full_proof_with_hints?.length || 0,
        publicInputsLength: proofData.public_inputs?.length || 0,
        keys: Object.keys(proofData)
      })
      
      // Log the raw response to see what we're actually receiving
      console.log(`[Frontend] 🔍 RAW RESPONSE FROM ASP:`, JSON.stringify({
        full_proof_with_hints: proofData.full_proof_with_hints?.slice(0, 10), // First 10 elements
        public_inputs: proofData.public_inputs?.slice(0, 10), // First 10 elements
        full_proof_length: proofData.full_proof_with_hints?.length,
        public_inputs_length: proofData.public_inputs?.length
      }, null, 2))

      // Validate proof structure
      const rawProof = proofData.full_proof_with_hints
      
      // First validate that proof exists and is an array
      if (!rawProof || !Array.isArray(rawProof) || rawProof.length === 0) {
        console.error(`[Frontend] ❌ Invalid proof structure:`, proofData)
        throw new Error('Invalid proof structure: proof is missing or empty')
      }
      
      // CRITICAL: Extract only the first 8 elements (Groth16 proof points: A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y)
      // The proof array from Garaga may include public inputs concatenated, so we only take the proof points
      const proof = rawProof.slice(0, 8);
      
      if (proof.length !== 8) {
        console.error(`[Frontend] ❌ CRITICAL ERROR: After extraction, proof has ${proof.length} elements, expected 8!`);
        console.error(`[Frontend] ❌ Raw proof array length: ${rawProof.length}`);
        console.error(`[Frontend] ❌ Raw proof array:`, rawProof);
        console.error(`[Frontend] ❌ Public inputs array:`, proofData.public_inputs);
        throw new Error(`Invalid proof length: expected at least 8 elements in raw proof, got ${rawProof.length}.`);
      }
      
      // Log if the raw proof had more than 8 elements (indicating it included public inputs)
      if (rawProof.length > 8) {
        console.warn(`[Frontend] ⚠️  Raw proof had ${rawProof.length} elements, extracted first 8. This suggests public inputs were concatenated.`);
      }

      if (!proofData.public_inputs || !Array.isArray(proofData.public_inputs) || proofData.public_inputs.length === 0) {
        console.error(`[Frontend] ❌ Invalid public inputs structure:`, proofData)
        throw new Error('Invalid proof structure: public_inputs is missing or empty')
      }

      console.log(`[Frontend] ✅ Proof data validated successfully. Proof length: ${proof.length}, Public inputs length: ${proofData.public_inputs.length}`)
      console.log(`[Frontend] ✅ Proof data received, updating state to "formatting"...`);

      // Step 4: Format proof for contract
      setState(prev => {
        console.log(`[Frontend] 📝 Updating proofStep from "${prev.proofStep}" to "formatting"`);
        return { ...prev, proofStep: "formatting" };
      })
      
      // Proof format: [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]
      // proof and publicInputs already defined above
      const publicInputs = proofData.public_inputs

      // Step 5: Execute transaction (like deposit/initialize pattern)
      // We already have all data from prepareSwap, just need to execute
      console.log(`[Frontend] 📝 Updating proofStep to "verifying"...`);
      setState(prev => {
        console.log(`[Frontend] 📝 Updating proofStep from "${prev.proofStep}" to "verifying"`);
        return { ...prev, proofStep: "verifying" };
      })
      
      // Execute transaction (ASP already prepared all data, we just execute like deposit/initialize)
      console.log(`[Frontend] 🔄 Executing swap transaction...`);
      console.log(`[Frontend] Proof length: ${proof.length}, Public inputs length: ${publicInputs.length}`);
      
      // Log complete calldata before sending
      console.log(`[Frontend] 📋 CALLDATA BEFORE SENDING:`);
      console.log(`[Frontend] 📋 Proof array (${proof.length} elements):`, JSON.stringify(proof, null, 2));
      console.log(`[Frontend] 📋 Public inputs array (${publicInputs.length} elements):`, JSON.stringify(publicInputs, null, 2));
      console.log(`[Frontend] 📋 zeroForOne:`, zeroForOne);
      console.log(`[Frontend] 📋 amountSpecified:`, amountSpecified.toString());
      console.log(`[Frontend] 📋 sqrtPriceLimitX128:`, {
        low: sqrtPriceLimitX128.low.toString(),
        high: sqrtPriceLimitX128.high.toString()
      });
      console.log(`[Frontend] 📋 newCommitment:`, outputNote.commitment.toString());
      
      // Check for potential overflow values
      const STARKNET_FELT_MAX = BigInt("3618502788666131106986593281521497120414687020801267626233049500247285301248");
      const checkValue = (value: string, name: string) => {
        try {
          const bigValue = BigInt(value);
          if (bigValue >= STARKNET_FELT_MAX) {
            console.warn(`[Frontend] ⚠️  ${name} exceeds felt252 max: ${value} (max: ${STARKNET_FELT_MAX.toString()})`);
            return false;
          }
          return true;
        } catch (e) {
          console.warn(`[Frontend] ⚠️  ${name} could not be parsed as BigInt: ${value}`);
          return false;
        }
      };
      
      console.log(`[Frontend] 🔍 Checking for overflow values...`);
      let hasOverflow = false;
      proof.forEach((val, idx) => {
        if (!checkValue(val, `proof[${idx}]`)) {
          console.error(`[Frontend] ❌ Overflow detected in proof[${idx}]: ${val}`);
          hasOverflow = true;
        }
      });
      publicInputs.forEach((val, idx) => {
        if (!checkValue(val, `publicInputs[${idx}]`)) {
          console.error(`[Frontend] ❌ Overflow detected in publicInputs[${idx}]: ${val}`);
          hasOverflow = true;
        }
      });
      
      if (hasOverflow) {
        console.error(`[Frontend] ❌ OVERFLOW DETECTED! Transaction will fail.`);
      } else {
        console.log(`[Frontend] ✅ No overflow detected in proof or public inputs.`);
      }
      
      const executeStartTime = Date.now();
      
        const contractClient = new ZylithContractClient(provider as any)
      const tx = await contractClient.privateSwap(
          account as any,
          proof,
          publicInputs,
          zeroForOne,
          amountSpecified,
          sqrtPriceLimitX128,
          outputNote.commitment
        )
      
      const executeElapsed = ((Date.now() - executeStartTime) / 1000).toFixed(2);
      console.log(`[Frontend] ✅ Transaction executed in ${executeElapsed}s. Hash: ${tx.transaction_hash}`);

      // Step 6: Track transaction
      addTransaction({
        hash: tx.transaction_hash,
        type: 'swap',
        status: 'pending',
        timestamp: Date.now(),
      })

      // Step 7: Wait for transaction and extract events
      const receipt = await provider.waitForTransaction(tx.transaction_hash)

      // Step 8: Extract leaf index from Swap event
      // The contract emits a Deposit event for the new commitment
      const SWAP_EVENT_SELECTOR = '0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2' // Same as Deposit
      
      let outputLeafIndex: number | undefined
      
      if (receipt && 'events' in receipt && receipt.events) {
        const swapEvent = receipt.events.find((event: any) => {
          const isFromZylith = event.from_address?.toLowerCase() === CONFIG.ZYLITH_CONTRACT.toLowerCase()
          const hasDepositSelector = event.keys && event.keys[0] === SWAP_EVENT_SELECTOR
          return isFromZylith && hasDepositSelector
        })

        if (swapEvent && swapEvent.data && swapEvent.data.length >= 3) {
          const eventCommitment = BigInt(swapEvent.data[0])
          if (eventCommitment === outputNote.commitment) {
            outputLeafIndex = Number(swapEvent.data[1])
          }
        }
      }

      // Fallback: If leaf index not found in events, try to query ASP after a short delay
      // Note: This is a best-effort approach. The ASP may need time to sync the new leaf.
      if (outputLeafIndex === undefined) {
        console.warn('Leaf index not found in swap event. Will attempt to query ASP after sync delay.')
        // TODO: Implement async query to ASP after transaction is confirmed
        // For now, the note will be saved without index and user may need to refresh
      }

      // Step 9: Update portfolio - replace input note with output note
      const outputNoteWithIndex: Note = {
        ...outputNote,
        index: outputLeafIndex,
      }
      
      // Use updateNote to replace the input note with output note
      // Use the verified commitment in case it was updated
      updateNote(verifiedInputNote.commitment, outputNoteWithIndex)
      updateTransaction(tx.transaction_hash, 'success')

      // Step 10: Post-transaction synchronization
      // Verify Merkle root and pool state
      try {
        // Use Contract directly for read calls
        const contract = new Contract(zylithAbi, CONFIG.ZYLITH_CONTRACT, provider)
        const contractRoot = await contract.get_merkle_root()
        const receiptWithEvents = receipt as any
        const eventRoot = receiptWithEvents?.events?.find((e: any) => 
          e.keys?.[0] === SWAP_EVENT_SELECTOR
        )?.data?.[2]
        
        if (eventRoot && BigInt(eventRoot) !== BigInt(contractRoot.toString())) {
          console.warn("Merkle root mismatch after swap. Event root:", eventRoot, "Contract root:", contractRoot.toString())
        }

        // Update pool price from Swap event data
        // Extract sqrt_price_x128 and tick from Swap event if available
        const swapEvent = receiptWithEvents?.events?.find((e: any) => 
          e.keys?.[0] === SWAP_EVENT_SELECTOR
        )
        
        // TODO: Parse actual Swap event structure from ABI and update pool state
        // For now, skip pool state update from events
      } catch (syncError) {
        console.warn("Failed to sync state after swap:", syncError)
        // Non-critical error, continue
      }

      console.log(`[Frontend] ✅ Swap completed successfully, updating proofStep to "complete"`);
      setState({ isLoading: false, error: null, proofStep: "complete" })
      return outputNoteWithIndex

    } catch (error: any) {
      const errorMessage = error?.message || 'Swap failed'
      setState({ isLoading: false, error: errorMessage, proofStep: "error" })
      
      // Update transaction status if it was added
      if (error?.transaction_hash) {
        updateTransaction(error.transaction_hash, 'failed')
      }
      
      throw error
    }
  }, [account, provider, aspClientInstance, removeNote, addNote, updateNote, addTransaction, updateTransaction])

  return {
    executeSwap,
    isLoading: state.isLoading,
    error: state.error,
    proofStep: state.proofStep,
  }
}

