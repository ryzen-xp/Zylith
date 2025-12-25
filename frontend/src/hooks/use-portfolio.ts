"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Note } from "@/lib/commitment"

interface Transaction {
  hash: string
  type: 'deposit' | 'swap' | 'withdraw' | 'mint' | 'burn' | 'initialize'
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

// Serialized Note format (BigInt as strings for JSON)
interface SerializedNote {
  secret: string;
  nullifier: string;
  amount: string;
  commitment: string;
  tokenAddress?: string;
  index?: number;
}

// Transform Note to/from serialized format
const noteTransform = {
  serialize: (note: Note): SerializedNote => ({
    secret: note.secret.toString(),
    nullifier: note.nullifier.toString(),
    amount: note.amount.toString(),
    commitment: note.commitment.toString(),
    tokenAddress: note.tokenAddress,
    index: note.index,
  }),
  deserialize: (serialized: SerializedNote): Note => ({
    secret: BigInt(serialized.secret),
    nullifier: BigInt(serialized.nullifier),
    amount: BigInt(serialized.amount),
    commitment: BigInt(serialized.commitment),
    tokenAddress: serialized.tokenAddress,
    index: serialized.index,
  }),
};

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
      
      addTransaction: (tx) => set((state) => {
        // Check if transaction with same hash already exists
        const existingIndex = state.transactions.findIndex(t => t.hash === tx.hash)
        if (existingIndex >= 0) {
          // Update existing transaction instead of adding duplicate
          const updated = [...state.transactions]
          updated[existingIndex] = { ...updated[existingIndex], ...tx }
          return { transactions: updated }
        }
        // Add new transaction at the beginning
        return { transactions: [tx, ...state.transactions] }
      }),
      
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
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          // Deserialize notes: convert string BigInts back to BigInt
          if (parsed.state?.notes) {
            parsed.state.notes = parsed.state.notes.map((n: any) => {
              // If already BigInt (shouldn't happen but check anyway)
              if (typeof n.secret === 'bigint') return n
              // Deserialize from string format
              return noteTransform.deserialize(n as SerializedNote)
            })
          }
          return parsed
        },
        setItem: (name, value) => {
          // Serialize notes: convert BigInt to strings
          const serialized = {
            ...value,
            state: {
              ...value.state,
              notes: value.state.notes.map(noteTransform.serialize),
            }
          }
          localStorage.setItem(name, JSON.stringify(serialized))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)

export function usePortfolio() {
  const store = usePortfolioStore()
  return store
}
