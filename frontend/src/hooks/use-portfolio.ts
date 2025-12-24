"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Note } from "@/lib/commitment"

interface Transaction {
  hash: string
  type: 'deposit' | 'swap' | 'withdraw' | 'mint' | 'burn'
  status: 'pending' | 'success' | 'failed'
  timestamp: number
}

interface PortfolioState {
  notes: Note[]
  transactions: Transaction[]
  addNote: (note: Note) => void
  removeNote: (commitment: bigint) => void
  updateNote: (oldCommitment: bigint, newNote: Note) => void
  addTransaction: (tx: Transaction) => void
  updateTransaction: (hash: string, status: Transaction['status']) => void
  getNotesByToken: (tokenAddress: string) => Note[]
  getTotalBalance: (tokenAddress: string) => bigint
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      notes: [],
      transactions: [],
      
      addNote: (note) => set((state) => ({ 
        notes: [...state.notes, note] 
      })),
      
      removeNote: (commitment) => set((state) => ({
        notes: state.notes.filter(n => n.commitment !== commitment)
      })),
      
      updateNote: (oldCommitment, newNote) => set((state) => ({
        notes: state.notes.map(n => 
          n.commitment === oldCommitment ? newNote : n
        )
      })),
      
      addTransaction: (tx) => set((state) => ({
        transactions: [tx, ...state.transactions]
      })),
      
      updateTransaction: (hash, status) => set((state) => ({
        transactions: state.transactions.map(tx => 
          tx.hash === hash ? { ...tx, status } : tx
        )
      })),
      
      getNotesByToken: (tokenAddress) => {
        return get().notes.filter(n => n.tokenAddress === tokenAddress)
      },
      
      getTotalBalance: (tokenAddress) => {
        return get().notes
          .filter(n => n.tokenAddress === tokenAddress)
          .reduce((sum, note) => sum + note.amount, 0n)
      }
    }),
    {
      name: 'zylith-portfolio',
    }
  )
)

export function usePortfolio() {
  const store = usePortfolioStore()
  return store
}
