import { NextRequest, NextResponse } from "next/server";
import { proofService } from "@/lib/proof-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate inputs
    if (!body.secret || !body.nullifier || !body.amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

