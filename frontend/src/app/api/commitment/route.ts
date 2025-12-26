import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commitment
 * Generate a commitment using BN254 Poseidon (matching Circom circuit and Cairo contract)
 * 
 * This endpoint uses BN254 Poseidon to match the circuit's commitment calculation.
 * The frontend uses Starknet's Poseidon which is incompatible.
 * 
 * Request body:
 * {
 *   secret: string (felt252)
 *   nullifier: string (felt252)
 *   amount: string (u128)
 * }
 * 
 * Response:
 * {
 *   commitment: string (felt252)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, nullifier, amount } = body;

    if (!secret || !nullifier || amount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: secret, nullifier, amount" },
        { status: 400 }
      );
    }

    // Use circomlibjs for BN254 Poseidon (same as circuit)
    // Dynamic import to handle server-side only
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    // Mask to 250 bits (matches Cairo Mask250)
    const MASK_250 = (1n << 250n) - 1n;
    const mask250 = (value: bigint) => value & MASK_250;

    // Parse inputs
    const secretBigInt = BigInt(secret);
    const nullifierBigInt = BigInt(nullifier);
    const amountBigInt = BigInt(amount);

    // Step 1: First hash - Poseidon(secret, nullifier)
    // Note: Cairo contract uses u384 for intermediate, but circomlibjs works with Fr directly
    const hash1 = poseidon([secretBigInt, nullifierBigInt]);
    const hash1BigInt = F.toObject(hash1);
    
    // Step 2: Second hash - Poseidon(hash1, amount)
    // IMPORTANT: Cairo contract does NOT mask the intermediate value before second hash
    // It uses the full u384 value directly: poseidon_hash_2_bn254(state1, amount)
    // So we use hash1 directly without masking
    const hash2 = poseidon([hash1BigInt, amountBigInt]);
    const hash2BigInt = F.toObject(hash2);

    // Step 3: Mask final hash to get commitment (matches Cairo's final mask)
    const commitment = mask250(hash2BigInt);

    return NextResponse.json({
      commitment: commitment.toString(),
    });
  } catch (error) {
    console.error("Commitment generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

