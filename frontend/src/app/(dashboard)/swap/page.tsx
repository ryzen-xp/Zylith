"use client"

import { SwapInterface } from "@/components/swap/SwapInterface"

export default function SwapPage() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-80px)] py-10">
      <div className="w-full max-w-[480px] space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-stark-gray">
            Swap Tokens
          </h1>
          <p className="text-stark-gray">
            Trade privately with zero-knowledge proofs.
          </p>
        </div>
        
        <SwapInterface />
        
        <div className="text-center text-xs text-muted-foreground">
          Powered by Zylith Privacy Protocol
        </div>
      </div>
    </div>
  )
}

