"use client"

import { useState, useCallback } from 'react'
import { useStarknet } from './use-starknet'
import { usePortfolioStore } from './use-portfolio'
import { Note } from '@/lib/commitment'
import { CONFIG } from '@/lib/config'
import { aspClient } from '@/lib/asp-client'
import { Contract } from 'starknet'
import zylithAbi from '@/lib/abis/zylith-abi.json'

interface DepositState {
  isLoading: boolean
  error: string | null
}

/**
 * Hook for private deposits
 * Uses ASP to prepare transactions, then executes them with user's wallet
 */
export function usePrivateDeposit() {
  const { account, provider } = useStarknet()
  const { addNote, addTransaction, updateTransaction } = usePortfolioStore()
  
  const [state, setState] = useState<DepositState>({
    isLoading: false,
    error: null,
  })

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

    if (!account.address) {
      throw new Error('Account address not available')
    }

    setState({ isLoading: true, error: null })

    try {
      // Step 1: Get prepared transactions from ASP
      // ASP generates note, commitment, and prepares approve + deposit transactions
      const prepareResponse = await aspClient.prepareDeposit(
        amount.toString(),
        tokenAddress,
        account.address
      )

      // Step 2: Execute each prepared transaction
      const transactionHashes: string[] = []

      for (const tx of prepareResponse.transactions) {
        // Execute transaction using account.execute()
        const result = await account.execute({
          contractAddress: tx.contract_address,
          entrypoint: tx.entry_point,
          calldata: tx.calldata,
        })

        transactionHashes.push(result.transaction_hash)

        // Add transaction to portfolio
        // Note: We only track the deposit transaction, approve is internal
        if (tx.entry_point === 'private_deposit') {
          addTransaction({
            hash: result.transaction_hash,
            type: 'deposit',
            status: 'pending',
            timestamp: Date.now(),
          })
        }

        // Wait for transaction to be accepted (with timeout)
        // Use a shorter timeout to avoid hanging too long
        try {
          await Promise.race([
            provider.waitForTransaction(result.transaction_hash),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transaction timeout')), 60000) // 60 second timeout
            )
          ])
        } catch (timeoutError) {
          console.warn(`Transaction ${result.transaction_hash} timeout, but continuing...`)
          // Continue even if timeout - transaction may still be processing
        }
      }

      // Step 3: Extract leaf_index from Deposit event
      // Get the deposit transaction receipt (last one)
      const depositTxHash = transactionHashes[transactionHashes.length - 1]
      const receipt = await provider.getTransactionReceipt(depositTxHash)
      
      // Event selectors for nested enum:
      // keys[0] = Event enum selector (zylith::zylith::Zylith::Event)
      // keys[1] = PrivacyEvent enum selector (zylith::privacy::deposit::PrivacyEvent)
      // keys[2] = Deposit variant selector (zylith::privacy::deposit::PrivacyEvent::Deposit)
      // The Deposit variant selector is: starknet_keccak("Deposit")
      const DEPOSIT_VARIANT_SELECTOR = '0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2'
      
      let leafIndex: number | undefined
      
      // Check if receipt has events (type guard)
      if (receipt && 'events' in receipt && receipt.events) {
        console.log('Searching for Deposit event in receipt...', {
          totalEvents: receipt.events.length,
          zylithContract: CONFIG.ZYLITH_CONTRACT,
          expectedCommitment: prepareResponse.commitment
        })
        
        // For nested enum events, we need to check keys[2] for the Deposit variant
        // But we'll be more flexible and check all keys AND data structure
        const expectedCommitment = BigInt(prepareResponse.commitment)
        
        const depositEvent = receipt.events.find((event: any) => {
          const isFromZylith = event.from_address?.toLowerCase() === CONFIG.ZYLITH_CONTRACT.toLowerCase()
          
          if (!isFromZylith) return false
          
          // Check if any key matches the Deposit variant selector
          // For nested enums, it could be in keys[0], keys[1], or keys[2]
          const hasDepositSelector = event.keys && event.keys.some((key: string) => 
            key === DEPOSIT_VARIANT_SELECTOR
          )
          
          // Also check if data structure matches (3 elements: commitment, leaf_index, root)
          // AND if the commitment matches what we expect
          const hasCorrectData = event.data && event.data.length >= 3
          const commitmentMatches = hasCorrectData && 
            BigInt(event.data[0]) === expectedCommitment
          
          return hasDepositSelector || (hasCorrectData && commitmentMatches)
        })

        if (depositEvent) {
          console.log('Found potential Deposit event:', {
            keys: depositEvent.keys,
            dataLength: depositEvent.data?.length,
            data: depositEvent.data
          })
          
          // Deposit event structure: [commitment, leaf_index, root]
          if (depositEvent.data && depositEvent.data.length >= 3) {
            const eventCommitment = BigInt(depositEvent.data[0])
            const expectedCommitment = BigInt(prepareResponse.commitment)
            
            console.log('Comparing commitments:', {
              eventCommitment: eventCommitment.toString(),
              expectedCommitment: expectedCommitment.toString(),
              match: eventCommitment === expectedCommitment
            })
            
            // Verify commitment matches
            if (eventCommitment === expectedCommitment) {
              leafIndex = Number(depositEvent.data[1])
              console.log('✅ Successfully extracted leaf_index:', leafIndex)
            } else {
              console.warn('Commitment mismatch in deposit event')
            }
          }
        } else {
          console.warn('No Deposit event found in receipt. Available events:', 
            receipt.events.map((e: any) => ({
              from: e.from_address,
              keys: e.keys,
              dataLength: e.data?.length
            }))
          )
        }
      } else {
        console.warn('Receipt has no events or invalid structure:', receipt)
      }

      // Step 4: Create note from ASP response and save to portfolio
      const note: Note = {
        secret: BigInt(prepareResponse.note_data.secret),
        nullifier: BigInt(prepareResponse.note_data.nullifier),
        amount: BigInt(prepareResponse.note_data.amount),
        commitment: BigInt(prepareResponse.commitment),
        tokenAddress,
        index: leafIndex,
      }

      addNote(note)

      // Fallback: If leaf index not found in events, try to query ASP after a delay
      if (leafIndex === undefined) {
        console.warn('Leaf index not found in deposit event. Will attempt to query ASP after sync delay.')
        
        // Wait a bit for ASP to sync, then try to get the index from ASP
        setTimeout(async () => {
          try {
            // ASP expects hex string without 0x prefix
            const commitmentStr = prepareResponse.commitment.startsWith('0x') 
              ? prepareResponse.commitment.slice(2) 
              : prepareResponse.commitment
            const indexResponse = await aspClient.getDepositIndex(commitmentStr)
            
            if (indexResponse.found && indexResponse.index !== undefined) {
              console.log('✅ Successfully retrieved leaf_index from ASP:', indexResponse.index)
              
              // Update the note with the index
              const updatedNote: Note = {
                ...note,
                index: indexResponse.index,
              }
              // Update note in portfolio store
              const { updateNote } = usePortfolioStore.getState()
              updateNote(note.commitment, updatedNote)
            } else {
              console.warn('ASP does not have the commitment yet. It may need more time to sync.')
            }
          } catch (err) {
            console.error('Failed to query ASP for leaf index:', err)
          }
        }, 5000) // Wait 5 seconds for ASP to sync
      }
      
      // Update transaction statuses
      transactionHashes.forEach(hash => {
        updateTransaction(hash, 'success')
      })

      // Step 5: Post-transaction synchronization (optional verification)
      try {
        // Use Contract directly for read calls
        const contract = new Contract(zylithAbi, CONFIG.ZYLITH_CONTRACT, provider)
        const contractRoot = await contract.get_merkle_root()
        
        if (receipt && 'events' in receipt && receipt.events) {
          const eventRoot = receipt.events.find((e: any) => 
            e.keys?.some((key: string) => key === DEPOSIT_VARIANT_SELECTOR)
          )?.data?.[2]
          
          if (eventRoot && BigInt(eventRoot) !== BigInt(contractRoot.toString())) {
            console.warn("Merkle root mismatch after deposit. Event root:", eventRoot, "Contract root:", contractRoot.toString())
          }
        }
      } catch (syncError) {
        console.warn("Failed to sync Merkle root after deposit:", syncError)
        // Non-critical error, continue
      }

      setState({ isLoading: false, error: null })
      return note

    } catch (error: any) {
      const errorMessage = error?.message || 'Deposit failed'
      setState({ isLoading: false, error: errorMessage })
      
      // Update transaction status if it was added
      if (error?.transaction_hash) {
        updateTransaction(error.transaction_hash, 'failed')
      }
      
      throw error
    }
  }, [account, provider, addNote, addTransaction, updateTransaction])

  return {
    deposit,
    isLoading: state.isLoading,
    error: state.error,
  }
}

