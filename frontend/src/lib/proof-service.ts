import * as snarkjs from "snarkjs";
import path from "path";
import fs from "fs";

// Paths relative to the project root (where next.js server runs)
// In local dev, we are in frontend/, so we go up to circuits
// In production, we might need to copy these files
const CIRCUITS_DIR = path.resolve(process.cwd(), "../circuits");

export interface ProofResult {
  full_proof_with_hints: string[];
  public_inputs: string[];
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
    const wasmPath = path.join(this.circuitsPath, "out", circuitName, `${circuitName}.wasm`);
    const zkeyPath = path.join(this.circuitsPath, "out", circuitName, `${circuitName}_final.zkey`);

    // Check if files exist
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM file not found at ${wasmPath}. Did you compile the circuits?`);
    }
    if (!fs.existsSync(zkeyPath)) {
      throw new Error(`ZKey file not found at ${zkeyPath}. Did you compile the circuits?`);
    }

    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        wasmPath,
        zkeyPath
      );

      return this.formatProofForGaraga(proof, publicSignals);
    } catch (error) {
      console.error("Proof generation failed:", error);
      throw new Error(`Proof generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Format proof for Garaga verifier (Cairo)
   * Garaga expects [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs, ...hints]
   */
  private formatProofForGaraga(proof: any, publicInputs: any[]): ProofResult {
    // Basic formatting - assuming standard Groth16 proof structure from snarkjs
    // A points
    const A = [proof.pi_a[0], proof.pi_a[1]];
    
    // B points (note the order for G2 points might vary, usually [x0, x1], [y0, y1] or similar)
    // Snarkjs returns B as [[x, y], [x, y]] (complex coordinates)
    // Garaga expects x0, x1 (coeff 0, coeff 1 of extension field)
    const B_x = proof.pi_b[0]; // [x0, x1]
    const B_y = proof.pi_b[1]; // [y0, y1]
    
    // C points
    const C = [proof.pi_c[0], proof.pi_c[1]];

    // Ensure all values are strings (BigInt as hex or decimal string)
    // Garaga usually expects decimal strings or hex.
    
    const full_proof_with_hints = [
      A[0], A[1],
      B_x[0], B_x[1], B_y[0], B_y[1],
      C[0], C[1],
      ...publicInputs
      // hints would follow if Garaga requires them, often empty for basic groth16
    ];

    return {
      full_proof_with_hints: full_proof_with_hints.map(v => v.toString()),
      public_inputs: publicInputs.map(v => v.toString())
    };
  }
}

export const proofService = new ProofService();

