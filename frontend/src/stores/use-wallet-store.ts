"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WalletState {
  address: string | null
  network: 'sepolia' | 'mainnet'
  setAddress: (address: string | null) => void
  setNetwork: (network: 'sepolia' | 'mainnet') => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      network: 'sepolia',
      
      setAddress: (address) => set({ address }),
      setNetwork: (network) => set({ network })
    }),
    {
      name: 'zylith-wallet',
    }
  )
)

