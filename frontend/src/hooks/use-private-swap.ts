"use client"

import { useState, useCallback } from "react"
import { useStarknet } from "./use-starknet"
import { useASP } from "./use-asp"
import { usePortfolioStore } from "./use-portfolio"
import { usePoolStore } from "@/stores/use-pool-store"
import { generateNote, Note } from "@/lib/commitment"
import { ZylithContractClient } from "@/lib/contracts/zylith-contract"
import { CONFIG } from "@/lib/config"
import { aspClient } from "@/lib/asp-client"

interface SwapState {
  isLoading: boolean
  error: string | null
  proofStep: "idle" | "fetching_merkle" | "generating_witness" | "computing_proof" | "formatting" | "verifying" | "complete" | "error"
}

/**
 * Hook for private swaps
 * Handles the complete flow: fetch Merkle proof, generate ZK proof, execute swap, update portfolio
 */
export function usePrivateSwap() {
  const { account, provider } = useStarknet()
  const { client: aspClientInstance } = useASP()
  const { removeNote, addNote, updateNote, addTransaction, updateTransaction } = usePortfolioStore()
  const { updatePoolState } = usePoolStore()
  
  const [state, setState] = useState<SwapState>({
    isLoading: false,
    error: null,
    proofStep: "idle",
  })

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
    if (!account) {
      throw new Error('Account not connected')
    }

    if (inputNote.index === undefined) {
      throw new Error('Input note must have a leaf index')
    }

    if (amountSpecified > inputNote.amount) {
      throw new Error('Amount specified exceeds note balance')
    }

    setState({ isLoading: true, error: null, proofStep: "fetching_merkle" })

    try {
      // Step 1: Fetch Merkle Proof from ASP
      const merkleProof = await aspClientInstance.getMerkleProof(inputNote.index)
      
      // Verify root matches
      const root = BigInt(merkleProof.root)
      if (root === 0n) {
        throw new Error('Invalid Merkle root from ASP')
      }

      // Step 2: Generate output note
      setState(prev => ({ ...prev, proofStep: "generating_witness" }))
      const outputAmount = expectedOutputAmount || amountSpecified // Simplified: assume 1:1 for now
      const outputNote = generateNote(outputAmount, inputNote.tokenAddress)

      // Step 3: Generate ZK Proof via Backend API
      setState(prev => ({ ...prev, proofStep: "computing_proof" }))
      
      // TODO: These values need to come from CLMM state or be calculated
      // For now, using placeholder values - these should be fetched from the pool
      const amount0Delta = zeroForOne ? -BigInt(amountSpecified) : 0n
      const amount1Delta = zeroForOne ? 0n : -BigInt(amountSpecified)
      const newSqrtPriceX128 = { low: 0n, high: 0n } // Should be calculated from CLMM
      const newTick = 0 // Should be calculated from CLMM

      const proofResponse = await fetch("/api/proof/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Public inputs
          nullifier: inputNote.nullifier.toString(),
          root: merkleProof.root,
          new_commitment: outputNote.commitment.toString(),
          amount_specified: amountSpecified.toString(),
          zero_for_one: zeroForOne ? "1" : "0",
          amount0_delta: amount0Delta.toString(),
          amount1_delta: amount1Delta.toString(),
          new_sqrt_price_x128: newSqrtPriceX128.low.toString(), // TODO: Handle u256 properly
          new_tick: newTick.toString(),
          // Private inputs
          secret_in: inputNote.secret.toString(),
          amount_in: inputNote.amount.toString(),
          secret_out: outputNote.secret.toString(),
          nullifier_out: outputNote.nullifier.toString(),
          amount_out: outputNote.amount.toString(),
          pathElements: merkleProof.path,
          pathIndices: merkleProof.path_indices,
          sqrt_price_old: "0", // TODO: Get from pool state
          liquidity: "0", // TODO: Get from pool state
        })
      })

      if (!proofResponse.ok) {
        const errorData = await proofResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Proof generation failed')
      }

      const proofData = await proofResponse.json()
      if (proofData.error) {
        throw new Error(proofData.error)
      }

      // Step 4: Format proof for contract
      setState(prev => ({ ...prev, proofStep: "formatting" }))
      
      // Proof format: [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]
      const proof = proofData.full_proof_with_hints || proofData.proof
      const publicInputs = proofData.public_inputs || []

      // Step 5: Execute swap on contract
      setState(prev => ({ ...prev, proofStep: "verifying" }))
      
      const contractClient = new ZylithContractClient(provider)
      
      const tx = await contractClient.privateSwap(
        account,
        proof,
        publicInputs,
        zeroForOne,
        amountSpecified,
        sqrtPriceLimitX128,
        outputNote.commitment
      )

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
      
      if (receipt.events) {
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
      updateNote(inputNote.commitment, outputNoteWithIndex)
      updateTransaction(tx.transaction_hash, 'success')

      // Step 10: Post-transaction synchronization
      // Verify Merkle root and pool state
      try {
        const contractRoot = await contractClient.getMerkleRoot()
        const eventRoot = receipt.events?.find((e: any) => 
          e.keys?.[0] === SWAP_EVENT_SELECTOR
        )?.data?.[2]
        
        if (eventRoot && BigInt(eventRoot) !== contractRoot) {
          console.warn("Merkle root mismatch after swap. Event root:", eventRoot, "Contract root:", contractRoot.toString())
        }

        // Update pool price from Swap event data
        // Extract sqrt_price_x128 and tick from Swap event if available
        const swapEvent = receipt.events?.find((e: any) => 
          e.keys?.[0] === SWAP_EVENT_SELECTOR
        )
        
        if (swapEvent && swapEvent.data) {
          // TODO: Parse actual Swap event structure from ABI
          // For now, try to get pool state from contract
          try {
            const poolState = await contractClient.getPoolState()
            if (poolState) {
              updatePoolState({
                sqrtPriceX128: poolState.sqrtPriceX128,
                tick: poolState.tick,
                liquidity: poolState.liquidity,
              })
            }
          } catch (poolError) {
            console.warn("Failed to update pool state after swap:", poolError)
          }
        }
      } catch (syncError) {
        console.warn("Failed to sync state after swap:", syncError)
        // Non-critical error, continue
      }

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

