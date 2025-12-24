import { NextRequest, NextResponse } from "next/server";
import { proofService } from "@/lib/proof-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await proofService.generateProof("lp_mint", body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

