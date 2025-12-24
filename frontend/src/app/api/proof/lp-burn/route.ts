import { NextRequest, NextResponse } from "next/server";
import { proofService } from "@/lib/proof-service";

/**
 * POST /api/proof/lp-burn
 * Generate ZK proof for private liquidity burn operation
 * 
 * Note: Uses "lp" circuit for both mint and burn operations
 * 
 * Required inputs:
 * - nullifier: string (felt252)
 * - root: string (felt252)
 * - tick_lower: string (i32)
 * - tick_upper: string (i32)
 * - liquidity: string (u128)
 * - new_commitment: string (felt252)
 * - position_commitment: string (felt252)
 * - secret_in: string (felt252)
 * - amount_in: string (u128)
 * - secret_out: string (felt252)
 * - nullifier_out: string (felt252)
 * - amount_out: string (u128)
 * - pathElements: string[] (Merkle path)
 * - pathIndices: number[] (Merkle path indices)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required inputs
    const required = [
      'nullifier', 'root', 'tick_lower', 'tick_upper',
      'liquidity', 'new_commitment', 'position_commitment',
      'secret_in', 'amount_in', 'secret_out', 'nullifier_out',
      'amount_out', 'pathElements', 'pathIndices'
    ];
    
    const missing = required.filter(field => !body[field]);
    
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Use "lp" circuit for both mint and burn
    const result = await proofService.generateProof("lp", body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("LP burn proof error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

