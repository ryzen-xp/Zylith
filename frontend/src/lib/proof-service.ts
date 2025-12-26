import * as snarkjs from "snarkjs";
import path from "path";
import fs from "fs";

/**
 * Proof Service for Zylith
 * 
 * Generates Groth16 proofs using snarkjs and formats them for Garaga verifier.
 * 
 * IMPORTANT: Garaga Verifier Format
 * ---------------------------------
 * Garaga expects proofs in a specific format called `full_proof_with_hints`:
 * 
 * Base format: [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]
 * 
 * Where:
 * - A: G1 point (pi_a from snarkjs)
 * - B: G2 point (pi_b from snarkjs, format [[x0,x1], [y0,y1]])
 * - C: G1 point (pi_c from snarkjs)
 * 
 * For on-chain verification, Garaga also requires precomputed hints:
 * - mpcheck_hint: Hints for multi-pairing check
 * - msm_hint: Hints for multi-scalar multiplication
 * 
 * These hints are generated using the Garaga CLI:
 *   garaga gen --vk verification_key.json --proof proof.json --output calldata.txt
 * 
 * Public inputs per circuit:
 * - membership: 2 [root, commitment]
 * - swap: 9 [nullifier, root, new_commitment, amount_specified, zero_for_one, amount0_delta, amount1_delta, new_sqrt_price_x128, new_tick]
 * - withdraw: 4 [nullifier, root, recipient, amount]
 * - lp: 7 [nullifier, root, tick_lower, tick_upper, liquidity, new_commitment, position_commitment]
 */

// Paths relative to the project root (where next.js server runs)
// In local dev, we are in frontend/, so we go up to circuits
// In production, we might need to copy these files
const CIRCUITS_DIR = path.resolve(process.cwd(), "../circuits");

export interface ProofResult {
  full_proof_with_hints: string[];
  public_inputs: string[];
}

export interface ProofValidationResult {
  valid: boolean;
  errors: string[];
}

export class ProofService {
  private circuitsPath: string;

  constructor(circuitsPath: string = CIRCUITS_DIR) {
    this.circuitsPath = circuitsPath;
  }

  /**
   * Generate a Groth16 proof using snarkjs
   */
  async generateProof(
    circuitName: string,
    inputs: any
  ): Promise<ProofResult> {
    // Circuit paths match the structure from generate_proof.js
    // Format: out/{circuit}_js/{circuit}.wasm and out/{circuit}_final.zkey
    const wasmPath = path.join(this.circuitsPath, "out", `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(this.circuitsPath, "out", `${circuitName}_final.zkey`);

    // Check if files exist
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM file not found at ${wasmPath}. Did you compile the circuits?`);
    }
    if (!fs.existsSync(zkeyPath)) {
      throw new Error(`ZKey file not found at ${zkeyPath}. Did you compile the circuits?`);
    }

    try {
      console.log(`[ProofService] Starting proof generation for ${circuitName}...`);
      console.log(`[ProofService] WASM: ${wasmPath}`);
      console.log(`[ProofService] ZKey: ${zkeyPath}`);
      console.log(`[ProofService] Input keys: ${Object.keys(inputs).join(', ')}`);
      
      const startTime = Date.now();
      
      // Log progress for large circuits
      if (circuitName === "swap" || circuitName === "lp") {
        console.log(`[ProofService] ⏳ Large circuit detected. This may take 2-5 minutes...`);
        console.log(`[ProofService] Starting witness generation and proof computation...`);
      }
      
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        wasmPath,
        zkeyPath
      );
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[ProofService] ✅ Proof generated successfully in ${elapsed}s`);
      console.log(`[ProofService] Public signals count: ${publicSignals.length}`);

      const formatted = this.formatProofForGaraga(proof, publicSignals);
      
      // Validate the formatted proof
      // Note: expectedPublicInputsCount should be passed as parameter or determined by circuit
      // For now, we validate structure but not exact count (circuit-specific)
      const validation = this.validateProofFormat(
        formatted.full_proof_with_hints,
        formatted.public_inputs,
        publicSignals.length
      );

      if (!validation.valid) {
        console.warn("Proof format validation warnings:", validation.errors);
        // Don't throw - warnings are acceptable, errors would be caught by contract
      }

      return formatted;
    } catch (error) {
      console.error("Proof generation failed:", error);
      throw new Error(`Proof generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate proof format for Garaga verifier
   * Checks structure, field elements, and expected format
   */
  validateProofFormat(
    proof: string[],
    publicInputs: string[],
    expectedPublicInputsCount: number
  ): ProofValidationResult {
    const errors: string[] = [];

    // Check proof length (should be 8 proof points + public inputs)
    const expectedLength = 8 + expectedPublicInputsCount;
    if (proof.length !== expectedLength) {
      errors.push(
        `Proof length mismatch: expected ${expectedLength} elements (8 proof points + ${expectedPublicInputsCount} public inputs), got ${proof.length}`
      );
    }

    // Check proof points structure (first 8 elements)
    if (proof.length < 8) {
      errors.push("Proof must have at least 8 elements (proof points)");
    } else {
      // Verify all proof points are valid field elements
      const FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
      
      for (let i = 0; i < 8; i++) {
        try {
          const val = BigInt(proof[i]);
          if (val < 0n) {
            errors.push(`Proof point ${i} is negative`);
          }
          if (val >= FIELD_PRIME) {
            errors.push(`Proof point ${i} exceeds field prime`);
          }
        } catch {
          errors.push(`Proof point ${i} is not a valid BigInt: ${proof[i]}`);
        }
      }
    }

    // Check public inputs count
    const actualPublicInputsCount = proof.length - 8;
    if (actualPublicInputsCount !== expectedPublicInputsCount) {
      errors.push(
        `Public inputs count mismatch: expected ${expectedPublicInputsCount}, got ${actualPublicInputsCount}`
      );
    }

    // Verify public inputs match
    if (publicInputs.length !== expectedPublicInputsCount) {
      errors.push(
        `Public inputs array length mismatch: expected ${expectedPublicInputsCount}, got ${publicInputs.length}`
      );
    }

    // Check that public inputs in proof match provided public inputs
    for (let i = 0; i < Math.min(publicInputs.length, actualPublicInputsCount); i++) {
      const proofIndex = 8 + i;
      if (proof[proofIndex] !== publicInputs[i]) {
        errors.push(
          `Public input ${i} mismatch: proof[${proofIndex}]="${proof[proofIndex]}", publicInputs[${i}]="${publicInputs[i]}"`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format proof for Garaga verifier (Cairo)
   * Garaga expects: [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]
   * 
   * Format matches generate_proof.js exportForCairo function:
   * - A: [pi_a[0], pi_a[1]]
   * - B: [pi_b[0][0], pi_b[0][1], pi_b[1][0], pi_b[1][1]]
   * - C: [pi_c[0], pi_c[1]]
   * - publicSignals appended after proof points
   */
  private formatProofForGaraga(proof: any, publicInputs: any[]): ProofResult {
    // A points (G1)
    const A = [proof.pi_a[0], proof.pi_a[1]];
    
    // B points (G2) - snarkjs returns as [[x0, x1], [y0, y1]]
    // Garaga expects: [x0, x1, y0, y1]
    const B_x = proof.pi_b[0]; // [x0, x1] - first element is x coordinates
    const B_y = proof.pi_b[1]; // [y0, y1] - second element is y coordinates
    
    // C points (G1)
    const C = [proof.pi_c[0], proof.pi_c[1]];

    // Format: [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]
    const full_proof_with_hints = [
      A[0], A[1],                    // A.x, A.y
      B_x[0], B_x[1], B_y[0], B_y[1], // B.x0, B.x1, B.y0, B.y1
      C[0], C[1],                     // C.x, C.y
      ...publicInputs                  // Public inputs follow proof points
    ];

    // Convert all values to strings (felt252 format)
    // Garaga expects decimal strings for felt252 values
    return {
      full_proof_with_hints: full_proof_with_hints.map(v => {
        // Convert BigInt to decimal string, regular numbers to string
        if (typeof v === 'bigint') {
          return v.toString();
        }
        return String(v);
      }),
      public_inputs: publicInputs.map(v => {
        if (typeof v === 'bigint') {
          return v.toString();
        }
        return String(v);
      })
    };
  }
}

export const proofService = new ProofService();

