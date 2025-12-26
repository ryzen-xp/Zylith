"use client"

import { useEffect } from 'react'
import { usePortfolioStore } from './use-portfolio'
import { aspClient } from '@/lib/asp-client'
import { Note } from '@/lib/commitment'

/**
 * Hook to automatically sync note indices from ASP
 * Polls ASP periodically for notes that don't have an index yet
 */
export function useSyncNotes() {
  const { notes, updateNote } = usePortfolioStore()

  useEffect(() => {
    // Find notes without index
    const notesWithoutIndex = notes.filter(note => note.index === undefined)
    
    if (notesWithoutIndex.length === 0) {
      return // All notes have indices, nothing to sync
    }

    console.log(`Found ${notesWithoutIndex.length} note(s) without index. Attempting to sync...`)

    // Try to get index for each note without index
    const syncPromises = notesWithoutIndex.map(async (note) => {
      try {
        // Convert BigInt to hex string (without 0x prefix, as ASP expects)
        const commitmentStr = note.commitment.toString(16)
        console.log(`  Querying ASP for commitment: ${commitmentStr.substring(0, 20)}...`)
        
        const indexResponse = await aspClient.getDepositIndex(commitmentStr)
        console.log(`  ASP response:`, indexResponse)
        
        if (indexResponse.found && indexResponse.index !== undefined) {
          console.log(`✅ Successfully synced index for commitment ${commitmentStr.substring(0, 20)}...: ${indexResponse.index}`)
          
          // Update the note with the index
          const updatedNote: Note = {
            ...note,
            index: indexResponse.index,
          }
          updateNote(note.commitment, updatedNote)
          return true
        } else {
          console.log(`  ⏳ ASP does not have commitment yet: ${indexResponse.message || 'Not found'}`)
          return false
        }
      } catch (err) {
        console.error(`❌ Failed to sync index for commitment ${note.commitment.toString().substring(0, 20)}...:`, err)
        return false
      }
    })

    // Wait for all sync attempts
    Promise.all(syncPromises).then(results => {
      const syncedCount = results.filter(r => r).length
      if (syncedCount > 0) {
        console.log(`✅ Synced ${syncedCount} note(s)`)
      }
    })
  }, [notes, updateNote])

  // Poll every 10 seconds if there are notes without index
  useEffect(() => {
    const notesWithoutIndex = notes.filter(note => note.index === undefined)
    
    if (notesWithoutIndex.length === 0) {
      return // No need to poll if all notes have indices
    }

    const interval = setInterval(async () => {
      console.log(`🔄 Polling ASP for ${notesWithoutIndex.length} note(s) without index...`)
      
      // Try to sync all notes without index
      for (const note of notesWithoutIndex) {
        try {
          // Convert BigInt to hex string (without 0x prefix, as ASP expects)
          const commitmentStr = note.commitment.toString(16)
          console.log(`  Querying ASP for commitment: ${commitmentStr.substring(0, 20)}...`)
          
          const indexResponse = await aspClient.getDepositIndex(commitmentStr)
          console.log(`  ASP response:`, indexResponse)
          
          if (indexResponse.found && indexResponse.index !== undefined) {
            console.log(`✅ Polled and synced index for commitment ${commitmentStr.substring(0, 20)}...: ${indexResponse.index}`)
            
            const updatedNote: Note = {
              ...note,
              index: indexResponse.index,
            }
            updateNote(note.commitment, updatedNote)
          } else {
            console.log(`  ⏳ ASP does not have commitment yet: ${indexResponse.message || 'Not found'}`)
          }
        } catch (err) {
          console.error(`❌ Poll sync failed for commitment ${note.commitment.toString().substring(0, 20)}...:`, err)
        }
      }
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(interval)
  }, [notes, updateNote])
}

