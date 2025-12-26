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
  console.log("[API] /api/proof/swap - Request received");
  const requestStartTime = Date.now();
  let progressInterval: NodeJS.Timeout | null = null;
  
  try {
    console.log("[API] Parsing request body...");
    const body = await req.json();
    console.log("[API] Request body parsed. Input keys:", Object.keys(body).join(', '));
    
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

    // Add timeout for proof generation (circuits can take 2-5 minutes for large proofs)
    // Using 5 minutes (300 seconds) to be safe
    console.log("[API] Starting proof generation with timeout (5 minutes)...");
    const proofPromise = proofService.generateProof("swap", body);
    
    // Log progress every minute to track if it's still running
    const startProgressLogging = () => {
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - requestStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        console.log(`[API] ⏳ Proof generation in progress... ${minutes}m ${secs}s elapsed`);
      }, 60000); // Log every 60 seconds
    };
    
    const cleanup = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    };
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => {
        cleanup();
        const elapsed = Date.now() - requestStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        console.error(`[API] ⚠️ Proof generation TIMEOUT after ${minutes}m ${secs}s`);
        console.error(`[API] The proof generation was cancelled because it exceeded the 5-minute limit.`);
        console.error(`[API] This could mean: 1) The circuit is too complex, 2) There's an issue with inputs, or 3) The system is under heavy load.`);
        reject(new Error(`Proof generation timeout after 5 minutes (${seconds}s). The operation was cancelled.`));
      }, 300000) // 5 minutes
    );
    
    // Start progress logging
    startProgressLogging();
    
    console.log("[API] Waiting for proof generation or timeout...");
    const result = await Promise.race([proofPromise, timeoutPromise]) as any;
    
    // Clear progress interval if proof completed
    cleanup();
    
    const totalElapsed = Date.now() - requestStartTime;
    const seconds = Math.floor(totalElapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    console.log(`[API] ✅ Proof generation completed successfully in ${minutes}m ${secs}s (${seconds}s total)`);
    
    return NextResponse.json(result);
  } catch (error) {
    // Clean up progress interval in case of error
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    
    const elapsed = Date.now() - requestStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (error instanceof Error && error.message.includes("timeout")) {
      console.error(`[API] ❌ Proof generation TIMEOUT after ${minutes}m ${secs}s`);
      console.error(`[API] The request was cancelled because it exceeded 5 minutes.`);
    } else {
      console.error(`[API] ❌ Swap proof error after ${minutes}m ${secs}s:`, error);
      console.error("[API] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

