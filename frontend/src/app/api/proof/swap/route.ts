import { NextRequest, NextResponse } from "next/server";
import { proofService } from "@/lib/proof-service";

/**
 * POST /api/proof/swap
 * Generate ZK proof for private swap operation
 * 
 * Required inputs:
 * - nullifier: string (felt252)
 * - root: string (felt252)
 * - new_commitment: string (felt252)
 * - amount_specified: string (u128)
 * - zero_for_one: string ("0" or "1")
 * - amount0_delta: string (i128)
 * - amount1_delta: string (i128)
 * - new_sqrt_price_x128: string (u256)
 * - new_tick: string (i32)
 * - secret_in: string (felt252)
 * - amount_in: string (u128)
 * - secret_out: string (felt252)
 * - nullifier_out: string (felt252)
 * - amount_out: string (u128)
 * - pathElements: string[] (Merkle path)
 * - pathIndices: number[] (Merkle path indices)
 * - sqrt_price_old: string (u256)
 * - liquidity: string (u128)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required public inputs
    const requiredPublic = [
      'nullifier', 'root', 'new_commitment', 'amount_specified',
      'zero_for_one', 'amount0_delta', 'amount1_delta',
      'new_sqrt_price_x128', 'new_tick'
    ];
    
    // Validate required private inputs
    const requiredPrivate = [
      'secret_in', 'amount_in', 'secret_out', 'nullifier_out',
      'amount_out', 'pathElements', 'pathIndices'
    ];
    
    const missing = [...requiredPublic, ...requiredPrivate].filter(
      field => !body[field]
    );
    
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await proofService.generateProof("swap", body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Swap proof error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

