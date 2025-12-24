"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SwapState {
  inputToken: string | null
  outputToken: string | null
  amount: string
  selectedNote: string | null // commitment hex
  setInputToken: (token: string) => void
  setOutputToken: (token: string) => void
  setAmount: (amount: string) => void
  setSelectedNote: (note: string | null) => void
  reset: () => void
}

export const useSwapStore = create<SwapState>()(
  persist(
    (set) => ({
      inputToken: null,
      outputToken: null,
      amount: "",
      selectedNote: null,
      
      setInputToken: (token) => set({ inputToken: token }),
      setOutputToken: (token) => set({ outputToken: token }),
      setAmount: (amount) => set({ amount }),
      setSelectedNote: (note) => set({ selectedNote: note }),
      reset: () => set({
        inputToken: null,
        outputToken: null,
        amount: "",
        selectedNote: null
      })
    }),
    {
      name: 'zylith-swap',
    }
  )
)

