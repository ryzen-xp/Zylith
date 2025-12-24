import { NextRequest, NextResponse } from "next/server";
import { proofService } from "@/lib/proof-service";

/**
 * POST /api/proof/withdraw
 * Generate ZK proof for private withdraw operation
 * 
 * Required inputs:
 * - nullifier: string (felt252)
 * - root: string (felt252)
 * - recipient: string (ContractAddress)
 * - amount: string (u128)
 * - secret: string (felt252)
 * - pathElements: string[] (Merkle path)
 * - pathIndices: number[] (Merkle path indices)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required inputs
    const required = [
      'nullifier', 'root', 'recipient', 'amount',
      'secret', 'pathElements', 'pathIndices'
    ];
    
    const missing = required.filter(field => !body[field]);
    
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await proofService.generateProof("withdraw", body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Withdraw proof error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

