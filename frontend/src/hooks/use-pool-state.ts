"use client"

import { useEffect } from "react"
import { useStarknet } from "./use-starknet"
import { usePoolStore } from "@/stores/use-pool-store"
import { ZylithContractClient } from "@/lib/contracts/zylith-contract"

/**
 * Hook to fetch and maintain pool state
 * Polls the contract for current pool state (price, tick, liquidity)
 */
export function usePoolState() {
  const { provider } = useStarknet()
  const { poolState, updatePoolState } = usePoolStore()

  useEffect(() => {
    if (!provider) return

    const fetchPoolState = async () => {
      try {
        const contractClient = new ZylithContractClient(provider)
        const state = await contractClient.getPoolState()
        
        if (state) {
          updatePoolState({
            sqrtPriceX128: state.sqrtPriceX128,
            tick: state.tick,
            liquidity: state.liquidity,
          })
        }
      } catch (error) {
        console.warn("Failed to fetch pool state:", error)
      }
    }

    // Initial fetch
    fetchPoolState()

    // Poll every 30 seconds
    const interval = setInterval(fetchPoolState, 30000)

    return () => clearInterval(interval)
  }, [provider, updatePoolState])

  return {
    poolState,
    isLoading: poolState.sqrtPriceX128 === null,
  }
}

