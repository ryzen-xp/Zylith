"use client"

import { useState, useCallback } from 'react'
import { Account, Contract, RpcProvider } from 'starknet'
import { useStarknet } from './use-starknet'
import { usePortfolioStore } from './use-portfolio'
import { generateNote, Note, toHex } from '@/lib/commitment'
import { getZylithContract } from '@/lib/contracts/zylith-contract'
import { CONFIG } from '@/lib/config'
import erc20Abi from '@/lib/abis/erc20-abi.json'

interface DepositState {
  isLoading: boolean
  error: string | null
}

/**
 * Hook for private deposits
 * Handles the complete flow: generate note, approve tokens, deposit, and save to portfolio
 */
export function usePrivateDeposit() {
  const { account, provider } = useStarknet()
  const { addNote, addTransaction, updateTransaction } = usePortfolioStore()
  
  const [state, setState] = useState<DepositState>({
    isLoading: false,
    error: null,
  })

  /**
   * Approve ERC20 tokens for the Zylith contract
   */
  const approveTokens = useCallback(async (
    tokenAddress: string,
    amount: bigint,
    account: Account
  ): Promise<void> => {
    const tokenContract = new Contract(erc20Abi, tokenAddress, account)
    
    // Convert amount to u256 format (low, high)
    const amountU256 = {
      low: amount & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
      high: amount >> BigInt(128),
    }

    const tx = await tokenContract.approve(
      CONFIG.ZYLITH_CONTRACT,
      amountU256
    )

    // Wait for transaction to be accepted
    await provider.waitForTransaction(tx.transaction_hash)
  }, [provider])

  /**
   * Execute private deposit
   * @param tokenAddress Token contract address
   * @param amount Amount to deposit (in token's smallest unit)
   */
  const deposit = useCallback(async (
    tokenAddress: string,
    amount: bigint
  ): Promise<Note> => {
    if (!account) {
      throw new Error('Account not connected')
    }

    setState({ isLoading: true, error: null })

    try {
      // Step 1: Generate commitment (note)
      const note = generateNote(amount, tokenAddress)

      // Step 2: Approve tokens
      await approveTokens(tokenAddress, amount, account)

      // Step 3: Call private_deposit on Zylith contract
      const zylithContract = getZylithContract(account)
      
      // Convert amount to u256 format
      const amountU256 = {
        low: amount & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
        high: amount >> BigInt(128),
      }

      const tx = await zylithContract.private_deposit(
        tokenAddress,
        amountU256,
        note.commitment
      )

      // Step 4: Add transaction to portfolio
      addTransaction({
        hash: tx.transaction_hash,
        type: 'deposit',
        status: 'pending',
        timestamp: Date.now(),
      })

      // Step 5: Wait for transaction and get events
      const receipt = await provider.waitForTransaction(tx.transaction_hash)
      
      // Step 6: Extract leaf_index from Deposit event
      // Deposit event selector: starknet_keccak("Deposit") truncated to 250 bits
      // This matches the selector used in the ASP syncer
      const DEPOSIT_EVENT_SELECTOR = '0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2'
      
      let leafIndex: number | undefined
      
      if (receipt.events) {
        const depositEvent = receipt.events.find((event: any) => {
          // Check if event is from Zylith contract and has Deposit selector
          const isFromZylith = event.from_address?.toLowerCase() === CONFIG.ZYLITH_CONTRACT.toLowerCase()
          const hasDepositSelector = event.keys && event.keys[0] === DEPOSIT_EVENT_SELECTOR
          return isFromZylith && hasDepositSelector
        })

        if (depositEvent && depositEvent.data && depositEvent.data.length >= 3) {
          // Deposit event structure: [commitment, leaf_index, root]
          const eventCommitment = BigInt(depositEvent.data[0])
          
          // Verify commitment matches
          if (eventCommitment === note.commitment) {
            leafIndex = Number(depositEvent.data[1])
          }
        }
      }

      // Fallback: If leaf index not found in events, log warning
      // The ASP should sync this eventually, but user may need to refresh
      if (leafIndex === undefined) {
        console.warn('Leaf index not found in deposit event. ASP may need time to sync.')
      }

      // Step 7: Update note with leaf index and save to portfolio
      const noteWithIndex: Note = {
        ...note,
        index: leafIndex,
      }

      addNote(noteWithIndex)
      updateTransaction(tx.transaction_hash, 'success')

      // Step 8: Post-transaction synchronization
      // Verify Merkle root from contract matches our expectation
      try {
        const contractClient = new ZylithContractClient(provider)
        const contractRoot = await contractClient.getMerkleRoot()
        const eventRoot = receipt.events?.find((e: any) => 
          e.keys?.[0] === DEPOSIT_EVENT_SELECTOR
        )?.data?.[2]
        
        if (eventRoot && BigInt(eventRoot) !== contractRoot) {
          console.warn("Merkle root mismatch after deposit. Event root:", eventRoot, "Contract root:", contractRoot.toString())
        }
      } catch (syncError) {
        console.warn("Failed to sync Merkle root after deposit:", syncError)
        // Non-critical error, continue
      }

      setState({ isLoading: false, error: null })
      return noteWithIndex

    } catch (error: any) {
      const errorMessage = error?.message || 'Deposit failed'
      setState({ isLoading: false, error: errorMessage })
      
      // Update transaction status if it was added
      if (error?.transaction_hash) {
        updateTransaction(error.transaction_hash, 'failed')
      }
      
      throw error
    }
  }, [account, provider, approveTokens, addNote, addTransaction, updateTransaction])

  return {
    deposit,
    isLoading: state.isLoading,
    error: state.error,
  }
}

