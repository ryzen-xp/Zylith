"use client"

import { useState, useCallback } from "react"
import { useStarknet } from "./use-starknet"
import { useASP } from "./use-asp"
import { aspClient } from "@/lib/asp-client"
import { usePortfolioStore } from "./use-portfolio"
import { useLPPositionStore } from "@/stores/use-lp-position-store"
import { generateNote, Note } from "@/lib/commitment"
import { ZylithContractClient } from "@/lib/contracts/zylith-contract"
import { Contract } from "starknet"
import { CONFIG } from "@/lib/config"
import zylithAbi from "@/lib/abis/zylith-abi.json"

interface LiquidityState {
  isLoading: boolean
  error: string | null
  proofStep: "idle" | "fetching_merkle" | "generating_witness" | "computing_proof" | "formatting" | "verifying" | "complete" | "error"
}

/**
 * Hook for private liquidity operations
 * Handles mint, burn, and collect operations for LP positions
 */
export function useLiquidity() {
  const { account, provider } = useStarknet()
  const { client: aspClientInstance } = useASP()
  const { removeNote, addNote, addTransaction, updateTransaction } = usePortfolioStore()
  const { addPosition, updatePosition, removePosition, getPosition } = useLPPositionStore()
  
  const [state, setState] = useState<LiquidityState>({
    isLoading: false,
    error: null,
    proofStep: "idle",
  })

  /**
   * Mint liquidity (add liquidity to a position)
   * @param inputNote Note to spend
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to mint
   * @param positionCommitment Unique identifier for the LP position
   */
  const mintLiquidity = useCallback(async (
    inputNote: Note,
    tickLower: number,
    tickUpper: number,
    liquidity: bigint,
    positionCommitment: bigint
  ): Promise<Note> => {
    if (!account) {
      throw new Error('Account not connected')
    }

    if (inputNote.index === undefined) {
      throw new Error('Input note must have a leaf index')
    }

    if (tickLower >= tickUpper) {
      throw new Error('tickLower must be less than tickUpper')
    }

    setState({ isLoading: true, error: null, proofStep: "fetching_merkle" })

    try {
      // Step 1: Fetch Merkle Proof from ASP
      const merkleProof = await aspClientInstance.getMerkleProof(inputNote.index)
      const root = BigInt(merkleProof.root)
      if (root === BigInt(0)) {
        throw new Error('Invalid Merkle root from ASP')
      }

      // Step 2: Generate change note (if needed)
      setState(prev => ({ ...prev, proofStep: "generating_witness" }))
      // TODO: Calculate actual change amount based on liquidity calculation
      const changeAmount = inputNote.amount // Simplified: assume full amount for now
      const changeNote = await generateNote(changeAmount, inputNote.tokenAddress)

      // Step 3: Generate ZK Proof via Backend API
      setState(prev => ({ ...prev, proofStep: "computing_proof" }))
      const proofResponse = await fetch("/api/proof/lp-mint", {
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
          pathElements: merkleProof.path,
          pathIndices: merkleProof.path_indices,
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

      // Step 4: Format proof
      setState(prev => ({ ...prev, proofStep: "formatting" }))
      const proof = proofData.full_proof_with_hints || proofData.proof
      const publicInputs = proofData.public_inputs || []

      // Step 5: Try to get prepared transaction from ASP, fallback to manual execution
      setState(prev => ({ ...prev, proofStep: "verifying" }))
      
      let tx: any
      
      try {
        // Try to use ASP to prepare transaction
        const prepareResponse = await aspClient.prepareMintLiquidity(
          inputNote.secret.toString(),
          inputNote.nullifier.toString(),
          inputNote.amount.toString(),
          inputNote.index!,
          tickLower,
          tickUpper,
          liquidity.toString(),
          changeNote.secret.toString(),
          changeNote.nullifier.toString(),
          changeNote.amount.toString()
        )

        // Execute prepared transaction from ASP
        if (prepareResponse.transactions && prepareResponse.transactions.length > 0) {
          const preparedTx = prepareResponse.transactions[0]
          tx = await account.execute({
            contractAddress: preparedTx.contract_address,
            entrypoint: preparedTx.entry_point,
            calldata: preparedTx.calldata,
          })
          
          // Update change note with commitment from ASP if provided
          if (prepareResponse.new_commitment) {
            changeNote.commitment = BigInt(prepareResponse.new_commitment)
          }
        } else {
          throw new Error('ASP returned empty transactions')
        }
      } catch (aspError: any) {
        // Fallback to manual execution if ASP is not ready or returns error
        if (aspError.message?.includes('NOT_IMPLEMENTED') || aspError.message?.includes('not yet implemented')) {
          console.warn('ASP mint liquidity preparation not yet implemented, using manual execution')
        } else {
          console.warn('ASP mint liquidity preparation failed, using manual execution:', aspError)
        }
        
        // Manual execution (existing logic)
        // Use Contract directly to avoid type issues
        const contract = new Contract(zylithAbi, CONFIG.ZYLITH_CONTRACT, account)
        tx = await contract.private_mint_liquidity(
          proof,
          publicInputs,
          tickLower,
          tickUpper,
          liquidity,
          changeNote.commitment
        )
      }

      // Step 6: Track transaction
      addTransaction({
        hash: tx.transaction_hash,
        type: 'mint',
        status: 'pending',
        timestamp: Date.now(),
      })

      // Step 7: Wait for transaction
      await provider.waitForTransaction(tx.transaction_hash)

      // Step 8: Update portfolio
      removeNote(inputNote.commitment)
      addNote(changeNote)
      updateTransaction(tx.transaction_hash, 'success')

      // Step 9: Update LP position store
      const positionId = positionCommitment.toString()
      const existingPosition = getPosition(positionId)
      
      if (existingPosition) {
        // Update existing position - add liquidity
        updatePosition(positionId, {
          liquidity: existingPosition.liquidity + liquidity,
          lastUpdated: Date.now(),
        })
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
        })
      }

      setState({ isLoading: false, error: null, proofStep: "complete" })
      return changeNote

    } catch (error: any) {
      const errorMessage = error?.message || 'Mint liquidity failed'
      setState({ isLoading: false, error: errorMessage, proofStep: "error" })
      
      if (error?.transaction_hash) {
        updateTransaction(error.transaction_hash, 'failed')
      }
      
      throw error
    }
  }, [account, provider, aspClientInstance, removeNote, addNote, addTransaction, updateTransaction])

  /**
   * Burn liquidity (remove liquidity from a position)
   * @param inputNote Note to spend
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to burn
   * @param positionCommitment Unique identifier for the LP position
   */
  const burnLiquidity = useCallback(async (
    inputNote: Note,
    tickLower: number,
    tickUpper: number,
    liquidity: bigint,
    positionCommitment: bigint
  ): Promise<Note> => {
    if (!account) {
      throw new Error('Account not connected')
    }

    if (inputNote.index === undefined) {
      throw new Error('Input note must have a leaf index')
    }

    if (tickLower >= tickUpper) {
      throw new Error('tickLower must be less than tickUpper')
    }

    setState({ isLoading: true, error: null, proofStep: "fetching_merkle" })

    try {
      // Step 1: Fetch Merkle Proof
      const merkleProof = await aspClientInstance.getMerkleProof(inputNote.index)
      const root = BigInt(merkleProof.root)
      if (root === BigInt(0)) {
        throw new Error('Invalid Merkle root from ASP')
      }

      // Step 2: Generate output note
      setState(prev => ({ ...prev, proofStep: "generating_witness" }))
      // TODO: Calculate actual output amount based on liquidity calculation
      const outputAmount = inputNote.amount // Simplified
      const outputNote = await generateNote(outputAmount, inputNote.tokenAddress)

      // Step 3: Generate ZK Proof
      setState(prev => ({ ...prev, proofStep: "computing_proof" }))
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

      // Step 4: Format and execute
      setState(prev => ({ ...prev, proofStep: "formatting" }))
      const proof = proofData.full_proof_with_hints || proofData.proof
      const publicInputs = proofData.public_inputs || []

      setState(prev => ({ ...prev, proofStep: "verifying" }))
      
      let tx: any
      
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
        )

        // Execute prepared transaction from ASP
        if (prepareResponse.transactions && prepareResponse.transactions.length > 0) {
          const preparedTx = prepareResponse.transactions[0]
          tx = await account.execute({
            contractAddress: preparedTx.contract_address,
            entrypoint: preparedTx.entry_point,
            calldata: preparedTx.calldata,
          })
          
          // Update output note with commitment from ASP if provided
          if (prepareResponse.new_commitment) {
            outputNote.commitment = BigInt(prepareResponse.new_commitment)
          }
        } else {
          throw new Error('ASP returned empty transactions')
        }
      } catch (aspError: any) {
        // Fallback to manual execution if ASP is not ready or returns error
        if (aspError.message?.includes('NOT_IMPLEMENTED') || aspError.message?.includes('not yet implemented')) {
          console.warn('ASP burn liquidity preparation not yet implemented, using manual execution')
        } else {
          console.warn('ASP burn liquidity preparation failed, using manual execution:', aspError)
        }
        
        // Manual execution (existing logic)
        // Use Contract directly to avoid type issues
        const contract = new Contract(zylithAbi, CONFIG.ZYLITH_CONTRACT, account)
        tx = await contract.private_burn_liquidity(
          proof,
          publicInputs,
          tickLower,
          tickUpper,
          liquidity,
          outputNote.commitment
        )
      }

      addTransaction({
        hash: tx.transaction_hash,
        type: 'burn',
        status: 'pending',
        timestamp: Date.now(),
      })

      await provider.waitForTransaction(tx.transaction_hash)

      removeNote(inputNote.commitment)
      addNote(outputNote)
      updateTransaction(tx.transaction_hash, 'success')

      // Update LP position store - remove or update liquidity
      const positionId = positionCommitment.toString()
      const existingPosition = getPosition(positionId)
      
      if (existingPosition) {
        const newLiquidity = existingPosition.liquidity > liquidity 
          ? existingPosition.liquidity - liquidity 
          : BigInt(0)
        
        if (newLiquidity === BigInt(0)) {
          // Remove position if all liquidity is burned
          removePosition(positionId)
        } else {
          // Update position with reduced liquidity
          updatePosition(positionId, {
            liquidity: newLiquidity,
            lastUpdated: Date.now(),
          })
        }
      }

      setState({ isLoading: false, error: null, proofStep: "complete" })
      return outputNote

    } catch (error: any) {
      const errorMessage = error?.message || 'Burn liquidity failed'
      setState({ isLoading: false, error: errorMessage, proofStep: "error" })
      
      if (error?.transaction_hash) {
        updateTransaction(error.transaction_hash, 'failed')
      }
      
      throw error
    }
  }, [account, provider, aspClientInstance, removeNote, addNote, addTransaction, updateTransaction])

  /**
   * Collect fees from a liquidity position
   * @param inputNote Note to spend
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param positionCommitment Unique identifier for the LP position
   */
  const collectFees = useCallback(async (
    inputNote: Note,
    tickLower: number,
    tickUpper: number,
    positionCommitment: bigint
  ): Promise<Note> => {
    if (!account) {
      throw new Error('Account not connected')
    }

    if (inputNote.index === undefined) {
      throw new Error('Input note must have a leaf index')
    }

    if (tickLower >= tickUpper) {
      throw new Error('tickLower must be less than tickUpper')
    }

    setState({ isLoading: true, error: null, proofStep: "fetching_merkle" })

    try {
      // Step 1: Fetch Merkle Proof
      const merkleProof = await aspClientInstance.getMerkleProof(inputNote.index)
      const root = BigInt(merkleProof.root)
      if (root === BigInt(0)) {
        throw new Error('Invalid Merkle root from ASP')
      }

      // Step 2: Generate output note (with collected fees)
      setState(prev => ({ ...prev, proofStep: "generating_witness" }))
      // TODO: Calculate actual fees collected
      const outputAmount = inputNote.amount // Simplified
      const outputNote = await generateNote(outputAmount, inputNote.tokenAddress)

      // Step 3: Generate ZK Proof
      setState(prev => ({ ...prev, proofStep: "computing_proof" }))
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

      // Step 4: Format and execute
      setState(prev => ({ ...prev, proofStep: "formatting" }))
      const proof = proofData.full_proof_with_hints || proofData.proof
      const publicInputs = proofData.public_inputs || []

      setState(prev => ({ ...prev, proofStep: "verifying" }))
      // Use Contract directly to avoid type issues
      const contract = new Contract(zylithAbi, CONFIG.ZYLITH_CONTRACT, account)
      
      const tx = await contract.private_collect(
        proof,
        publicInputs,
        tickLower,
        tickUpper,
        outputNote.commitment
      )

      addTransaction({
        hash: tx.transaction_hash,
        type: 'mint', // Using 'mint' type for collect
        status: 'pending',
        timestamp: Date.now(),
      })

      await provider.waitForTransaction(tx.transaction_hash)

      removeNote(inputNote.commitment)
      addNote(outputNote)
      updateTransaction(tx.transaction_hash, 'success')

      // Update LP position store - reset tokens owed after collecting
      const positionId = positionCommitment.toString()
      const existingPosition = getPosition(positionId)
      
      if (existingPosition) {
        // After collecting, tokensOwed should be reset (fees collected)
        // Note: We don't know the exact amounts collected without parsing events
        // This will be updated when we process Collect events
        updatePosition(positionId, {
          tokensOwed0: BigInt(0), // Will be updated from contract events
          tokensOwed1: BigInt(0), // Will be updated from contract events
          lastUpdated: Date.now(),
        })
      }

      setState({ isLoading: false, error: null, proofStep: "complete" })
      return outputNote

    } catch (error: any) {
      const errorMessage = error?.message || 'Collect fees failed'
      setState({ isLoading: false, error: errorMessage, proofStep: "error" })
      
      if (error?.transaction_hash) {
        updateTransaction(error.transaction_hash, 'failed')
      }
      
      throw error
    }
  }, [account, provider, aspClientInstance, removeNote, addNote, addTransaction, updateTransaction])

  return {
    mintLiquidity,
    burnLiquidity,
    collectFees,
    isLoading: state.isLoading,
    error: state.error,
    proofStep: state.proofStep,
  }
}

