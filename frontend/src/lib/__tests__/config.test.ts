import { describe, it, expect } from '@jest/globals'
import { CONFIG } from '../config'

describe('Config', () => {
  it('should have Zylith contract address', () => {
    expect(CONFIG.ZYLITH_CONTRACT).toBeDefined()
    expect(CONFIG.ZYLITH_CONTRACT).toMatch(/^0x[a-fA-F0-9]+$/)
  })

  it('should have all verifier addresses', () => {
    expect(CONFIG.VERIFIERS.MEMBERSHIP).toBeDefined()
    expect(CONFIG.VERIFIERS.SWAP).toBeDefined()
    expect(CONFIG.VERIFIERS.WITHDRAW).toBeDefined()
    expect(CONFIG.VERIFIERS.LP).toBeDefined()
  })

  it('should have ASP server URL', () => {
    expect(CONFIG.ASP_SERVER_URL).toBeDefined()
  })

  it('should have Starknet RPC URL', () => {
    expect(CONFIG.STARKNET_RPC).toBeDefined()
  })
})

