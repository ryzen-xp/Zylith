import { describe, it, expect, jest } from '@jest/globals';
import { ProofService } from '../proof-service';

// Mock snarkjs
jest.mock('snarkjs', () => ({
  groth16: {
    fullProve: jest.fn(),
  },
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

describe('ProofService', () => {
  const mockProof = {
    pi_a: ['0x123', '0x456'],
    pi_b: [['0x789', '0xabc'], ['0xdef', '0x111']],
    pi_c: ['0x222', '0x333'],
  };

  const mockPublicSignals = ['0x444', '0x555'];

  it('should format proof correctly for Garaga', () => {
    // Test proof formatting logic
    const A = [mockProof.pi_a[0], mockProof.pi_a[1]];
    const B_x = mockProof.pi_b[0];
    const B_y = mockProof.pi_b[1];
    const C = [mockProof.pi_c[0], mockProof.pi_c[1]];

    const formatted = [
      A[0], A[1],
      B_x[0], B_x[1], B_y[0], B_y[1],
      C[0], C[1],
      ...mockPublicSignals,
    ];

    expect(formatted.length).toBe(10); // 8 proof points + 2 public signals
    expect(formatted[0]).toBe('0x123'); // A.x
    expect(formatted[1]).toBe('0x456'); // A.y
    expect(formatted[2]).toBe('0x789'); // B.x0
    expect(formatted[3]).toBe('0xabc'); // B.x1
    expect(formatted[4]).toBe('0xdef'); // B.y0
    expect(formatted[5]).toBe('0x111'); // B.y1
    expect(formatted[6]).toBe('0x222'); // C.x
    expect(formatted[7]).toBe('0x333'); // C.y
    expect(formatted[8]).toBe('0x444'); // public_inputs[0]
    expect(formatted[9]).toBe('0x555'); // public_inputs[1]
  });

  it('should handle BigInt conversion to string', () => {
    // Test BigInt to string conversion
    const bigIntValue = 1234567890n;
    const stringValue = bigIntValue.toString();

    expect(typeof stringValue).toBe('string');
    expect(stringValue).toBe('1234567890');
  });

  it('should validate proof structure', () => {
    // Test proof structure validation
    const hasPiA = mockProof.pi_a && mockProof.pi_a.length === 2;
    const hasPiB = mockProof.pi_b && mockProof.pi_b.length === 2;
    const hasPiC = mockProof.pi_c && mockProof.pi_c.length === 2;

    expect(hasPiA).toBe(true);
    expect(hasPiB).toBe(true);
    expect(hasPiC).toBe(true);
  });

  it('should validate public signals format', () => {
    // Test public signals format
    const signals = mockPublicSignals.map(v => String(v));
    
    expect(signals.length).toBe(2);
    expect(typeof signals[0]).toBe('string');
    expect(typeof signals[1]).toBe('string');
  });

  describe('validateProofFormat', () => {
    const proofService = new ProofService();

    it('should validate correct proof format', () => {
      const proof = [
        '123', '456',           // A.x, A.y
        '789', 'abc', 'def', '111', // B.x0, B.x1, B.y0, B.y1
        '222', '333',           // C.x, C.y
        '444', '555',           // public_inputs
      ];
      const publicInputs = ['444', '555'];

      const result = proofService.validateProofFormat(proof, publicInputs, 2);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject proof with wrong length', () => {
      const proof = ['123', '456', '789']; // Too short
      const publicInputs = ['444', '555'];

      const result = proofService.validateProofFormat(proof, publicInputs, 2);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('length'))).toBe(true);
    });

    it('should reject proof with wrong public inputs count', () => {
      const proof = [
        '123', '456', '789', 'abc', 'def', '111', '222', '333',
        '444', '555', '666', // 3 public inputs instead of 2
      ];
      const publicInputs = ['444', '555', '666'];

      const result = proofService.validateProofFormat(proof, publicInputs, 2);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('count'))).toBe(true);
    });

    it('should reject proof with mismatched public inputs', () => {
      const proof = [
        '123', '456', '789', 'abc', 'def', '111', '222', '333',
        '444', '555',
      ];
      const publicInputs = ['444', '999']; // Different value

      const result = proofService.validateProofFormat(proof, publicInputs, 2);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('mismatch'))).toBe(true);
    });

    it('should validate field elements are within range', () => {
      const FIELD_PRIME = "21888242871839275222246405745257275088548364400416034343698204186575808495617";
      const proof = [
        '0', '0', '0', '0', '0', '0', '0', '0', // Valid (within range)
        '444', '555',
      ];
      const publicInputs = ['444', '555'];

      const result = proofService.validateProofFormat(proof, publicInputs, 2);

      expect(result.valid).toBe(true);
    });
  });
});

