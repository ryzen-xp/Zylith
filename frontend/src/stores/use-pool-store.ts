"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Pool state interface
 * Represents the current state of the CLMM pool
 */
export interface PoolState {
  sqrtPriceX128: { low: bigint; high: bigint } | null
  tick: number | null
  liquidity: bigint | null
  feeGrowthGlobal0X128: bigint | null
  feeGrowthGlobal1X128: bigint | null
  lastUpdateBlock: number | null
}

interface PoolStore {
  poolState: PoolState
  updatePoolState: (state: Partial<PoolState>) => void
  resetPoolState: () => void
}

const initialPoolState: PoolState = {
  sqrtPriceX128: null,
  tick: null,
  liquidity: null,
  feeGrowthGlobal0X128: null,
  feeGrowthGlobal1X128: null,
  lastUpdateBlock: null,
}

export const usePoolStore = create<PoolStore>()(
  persist(
    (set) => ({
      poolState: initialPoolState,
      
      updatePoolState: (updates) => set((state) => ({
        poolState: {
          ...state.poolState,
          ...updates,
          lastUpdateBlock: Date.now(),
        }
      })),
      
      resetPoolState: () => set({ poolState: initialPoolState }),
    }),
    {
      name: 'zylith-pool-state',
    }
  )
)

