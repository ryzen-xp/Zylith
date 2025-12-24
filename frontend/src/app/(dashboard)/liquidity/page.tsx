"use client"

import { LiquidityManager } from "@/components/liquidity/LiquidityManager"

export default function LiquidityPage() {
  return (
    <div className="container py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-stark-gray">
            Manage Liquidity
          </h1>
          <p className="text-stark-gray">
            Add or remove liquidity privately with zero-knowledge proofs.
          </p>
        </div>
        
        <LiquidityManager />
      </div>
    </div>
  )
}

