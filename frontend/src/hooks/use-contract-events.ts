"use client"

import { useEffect, useCallback, useRef } from "react"
import { useStarknet } from "./use-starknet"
import { usePortfolioStore } from "./use-portfolio"
import { usePoolStore } from "@/stores/use-pool-store"
import { CONFIG } from "@/lib/config"
import { Note } from "@/lib/commitment"

// Notification system - simple event emitter pattern
type NotificationCallback = (type: "error" | "warning" | "info" | "success", title: string, message?: string) => void

let notificationCallback: NotificationCallback | null = null

export function setNotificationHandler(callback: NotificationCallback) {
  notificationCallback = callback
}

export function showNotification(type: "error" | "warning" | "info" | "success", title: string, message?: string) {
  if (notificationCallback) {
    notificationCallback(type, title, message)
  } else {
    console.warn("Notification handler not set:", { type, title, message })
  }
}

/**
 * Event selectors from the contract ABI
 * These match the event selectors in the Zylith contract
 */
const EVENT_SELECTORS = {
  DEPOSIT: "0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2",
  NULLIFIER_SPENT: "0x...", // TODO: Get from ABI
  PROOF_REJECTED: "0x...", // TODO: Get from ABI
  SWAP: "0x...", // TODO: Get from ABI
  MINT: "0x...", // TODO: Get from ABI
  BURN: "0x...", // TODO: Get from ABI
}

/**
 * Hook to listen to contract events and update state automatically
 * 
 * Currently uses polling as Starknet RPC doesn't support WebSocket subscriptions
 * In production, consider using a service like Apibara or custom event indexer
 */
export function useContractEvents() {
  const { provider, account } = useStarknet()
  const { addNote, removeNote, updateNote, notes } = usePortfolioStore()
  const { updatePoolState } = usePoolStore()
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastBlockRef = useRef<number | null>(null)

  /**
   * Poll for new events from the contract
   * This is a simplified implementation - in production, use an event indexer
   * 
   * Note: Starknet RPC doesn't support WebSocket subscriptions natively.
   * This uses polling as a fallback. For production, consider:
   * - Using Apibara for real-time event streaming
   * - Using a custom event indexer service
   * - Using the ASP server which already syncs events
   * 
   * IMPORTANT: Currently disabled because:
   * 1. The provider from @starknet-react/core may not have getBlockNumber()
   * 2. Event syncing is handled by the ASP server
   * 3. Frontend updates via transaction receipts after operations
   * 
   * This hook is kept for future implementation when we have a proper event indexer.
   */
  const pollForEvents = useCallback(async () => {
    // Validate provider exists
    if (!provider) {
      console.debug("useContractEvents: Provider not available, skipping poll")
      return
    }

    // For now, we rely on the ASP server to sync events
    // The frontend will update when transactions complete via receipt.events
    // This polling is disabled until we implement proper event indexing
    
    // TODO: Implement event polling when we have:
    // 1. A proper RpcProvider instance with getBlockNumber()
    // 2. Or an event indexer service (Apibara, custom indexer, etc.)
    // 3. Or query the ASP server for events instead
    
    console.debug("useContractEvents: Event polling disabled - using ASP server for event syncing")
  }, [provider])

  /**
   * Process a single event
   */
  const processEvent = useCallback(async (event: any) => {
    if (!event.keys || event.keys.length === 0) return

    const eventSelector = event.keys[0]

    // Process Deposit event
    if (eventSelector === EVENT_SELECTORS.DEPOSIT && event.data && event.data.length >= 3) {
      const commitment = BigInt(event.data[0])
      const leafIndex = Number(event.data[1])
      const root = BigInt(event.data[2])

      // Check if this is a note we're tracking
      const existingNote = notes.find(n => n.commitment === commitment)
      
      if (existingNote && existingNote.index === undefined) {
        // Update note with leaf index
        updateNote(existingNote.commitment, {
          ...existingNote,
          index: leafIndex,
        })
      } else if (!existingNote && account) {
        // This might be a deposit from another user, or a note we haven't tracked yet
        // In a real implementation, we'd check if this commitment belongs to the user
        console.log("New deposit event detected:", { commitment, leafIndex, root })
      }
    }

    // Process NullifierSpent event
    if (eventSelector === EVENT_SELECTORS.NULLIFIER_SPENT && event.data && event.data.length >= 1) {
      const nullifier = BigInt(event.data[0])
      
      // Find note with this nullifier and remove it
      const noteToRemove = notes.find(n => n.nullifier === nullifier)
      if (noteToRemove) {
        removeNote(noteToRemove.commitment)
      }
    }

    // Process ProofRejected event
    if (eventSelector === EVENT_SELECTORS.PROOF_REJECTED && event.data && event.data.length >= 3) {
      const proofType = event.data[0]
      const caller = event.data[1]
      const error = event.data[2]

      // Only show error if it's from the current user
      if (account && caller.toLowerCase() === account.address.toLowerCase()) {
        console.error("Proof rejected:", { proofType, error })
        showNotification(
          "error",
          "Proof Rejected",
          `Your ${proofType} proof was rejected. Error: ${error}`
        )
      }
    }

    // Process Swap event (from PoolEvent)
    if (eventSelector === EVENT_SELECTORS.SWAP && event.data) {
      // TODO: Extract sqrt_price_x128, tick, and liquidity from Swap event
      // For now, just log - actual extraction depends on event structure
      console.log("Swap event detected - pool state updated")
      // updatePoolState would be called here with extracted values
    }

    // Process Mint/Burn events (from PoolEvent)
    if (eventSelector === EVENT_SELECTORS.MINT || eventSelector === EVENT_SELECTORS.BURN) {
      // TODO: Update liquidity positions
      console.log("Liquidity event detected:", eventSelector)
    }
  }, [account, notes, addNote, removeNote, updateNote, updatePoolState])

  /**
   * Start polling for events
   * 
   * NOTE: Currently disabled - event syncing is handled by:
   * 1. ASP server (syncs events from chain)
   * 2. Transaction receipts (frontend updates after operations)
   * 
   * This effect is kept for future implementation.
   */
  useEffect(() => {
    if (!provider) {
      console.debug("useContractEvents: Provider not available, not starting polling")
      return
    }

    // Event polling is currently disabled
    // The ASP server handles event syncing, and the frontend updates
    // via transaction receipts after operations complete.
    
    // TODO: Enable polling when we have:
    // - Proper event indexer service
    // - Or direct RpcProvider with getBlockNumber()
    
    console.debug("useContractEvents: Event polling disabled - using ASP server for syncing")

    return () => {
      // Cleanup if polling was enabled
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [provider, pollForEvents])

  return {
    isPolling: pollingIntervalRef.current !== null,
  }
}

