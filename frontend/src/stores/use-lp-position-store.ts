"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * LP Position interface
 * Represents a liquidity position in the pool
 */
export interface LPPosition {
  id: string // Unique identifier (e.g., position commitment)
  tickLower: number
  tickUpper: number
  liquidity: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint
  createdAt: number
  lastUpdated: number
}

interface LPPositionStore {
  positions: LPPosition[]
  addPosition: (position: LPPosition) => void
  updatePosition: (id: string, updates: Partial<LPPosition>) => void
  removePosition: (id: string) => void
  getPosition: (id: string) => LPPosition | undefined
  getPositionsByRange: (tickLower: number, tickUpper: number) => LPPosition[]
}

export const useLPPositionStore = create<LPPositionStore>()(
  persist(
    (set, get) => ({
      positions: [],
      
      addPosition: (position) => set((state) => ({
        positions: [...state.positions, position]
      })),
      
      updatePosition: (id, updates) => set((state) => ({
        positions: state.positions.map(p =>
          p.id === id
            ? { ...p, ...updates, lastUpdated: Date.now() }
            : p
        )
      })),
      
      removePosition: (id) => set((state) => ({
        positions: state.positions.filter(p => p.id !== id)
      })),
      
      getPosition: (id) => {
        return get().positions.find(p => p.id === id)
      },
      
      getPositionsByRange: (tickLower, tickUpper) => {
        return get().positions.filter(p =>
          p.tickLower === tickLower && p.tickUpper === tickUpper
        )
      },
    }),
    {
      name: 'zylith-lp-positions',
    }
  )
)

