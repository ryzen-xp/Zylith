import { describe, it, expect } from '@jest/globals'
import { generateCommitment, generateNote } from '../lib/commitment'

describe('Commitment Generation', () => {
  it('should generate a commitment from secret, nullifier, and amount', () => {
    const secret = BigInt('0x1234567890abcdef')
    const nullifier = BigInt('0xfedcba0987654321')
    const amount = BigInt('1000000')
    
    const commitment = generateCommitment(secret, nullifier, amount)
    
    expect(commitment).toBeDefined()
    expect(typeof commitment).toBe('bigint')
  })

  it('should generate different commitments for different inputs', () => {
    const note1 = generateNote(BigInt('1000000'))
    const note2 = generateNote(BigInt('1000000'))
    
    expect(note1.commitment).not.toBe(note2.commitment)
  })

  it('should generate a note with all required fields', () => {
    const note = generateNote(BigInt('1000000'))
    
    expect(note.secret).toBeDefined()
    expect(note.nullifier).toBeDefined()
    expect(note.amount).toBe(BigInt('1000000'))
    expect(note.commitment).toBeDefined()
  })
})

