"use client"

import { useState } from "react"
import { ArrowDown, Settings } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TokenSelector } from "./TokenSelector"
import { PrivacyShield } from "@/components/shared/PrivacyShield"
import { ProofProgress } from "@/components/shared/ProofProgress"
import { usePrivateSwap } from "@/hooks/use-private-swap"
import { usePortfolio } from "@/hooks/use-portfolio"
import { TOKENS } from "@/lib/config"
import { toBigInt } from "@/lib/commitment"

export function SwapInterface() {
  const [inputToken, setInputToken] = useState(TOKENS[0])
  const [outputToken, setOutputToken] = useState(TOKENS[1])
  const [amount, setAmount] = useState("")
  const [isPrivate, setIsPrivate] = useState(true)
  
  const { executeSwap, loading, error, proofStep } = usePrivateSwap()
  const { getNotesByToken } = usePortfolio()

  const handleSwap = async () => {
    if (!amount || !inputToken || !outputToken) return
    
    // Find suitable notes
    const notes = getNotesByToken(inputToken.address)
    const note = notes.find(n => n.amount >= toBigInt(amount)) // Simplified note selection
    
    if (!note && isPrivate) {
      alert("Insufficient private balance (no single note large enough)")
      return
    }

    if (isPrivate && note) {
      await executeSwap(
        note, 
        toBigInt(amount), // Assuming 1:1 price for demo
        inputToken.address < outputToken.address // ZeroForOne logic simplified
      )
    } else {
      // Public swap logic
      alert("Public swap not implemented in this demo")
    }
  }

  return (
    <Card className="w-full max-w-[480px] bg-stark-dark border-stark-gray/10 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl">Swap</CardTitle>
        <div className="flex items-center gap-2">
          <div 
            className="cursor-pointer"
            onClick={() => setIsPrivate(!isPrivate)}
          >
            <PrivacyShield active={isPrivate} />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input */}
        <div className="rounded-xl bg-stark-darker p-4 space-y-2 border border-stark-gray/10 focus-within:border-stark-blue/30 transition-colors">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>You pay</span>
            <span>Balance: {isPrivate ? "Hidden" : "0.00"}</span>
          </div>
          <div className="flex gap-4">
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-none bg-transparent text-2xl p-0 focus-visible:ring-0 h-auto"
            />
            <TokenSelector 
              selectedToken={inputToken} 
              onSelect={setInputToken} 
            />
          </div>
        </div>

        {/* Switch Arrow */}
        <div className="flex justify-center -my-2 relative z-10">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-stark-dark border-stark-darker hover:bg-stark-darker"
            onClick={() => {
              const temp = inputToken
              setInputToken(outputToken)
              setOutputToken(temp)
            }}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Output */}
        <div className="rounded-xl bg-stark-darker p-4 space-y-2 border border-stark-gray/10">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>You receive</span>
            <span>Balance: {isPrivate ? "Hidden" : "0.00"}</span>
          </div>
          <div className="flex gap-4">
            <Input
              type="number"
              placeholder="0.0"
              readOnly
              value={amount} // Demo: 1:1 price
              className="border-none bg-transparent text-2xl p-0 focus-visible:ring-0 h-auto text-stark-blue"
            />
            <TokenSelector 
              selectedToken={outputToken} 
              onSelect={setOutputToken} 
            />
          </div>
        </div>

        {/* Price Info */}
        <div className="flex justify-between text-xs px-2 text-muted-foreground">
          <span>Rate</span>
          <span>1 {inputToken.symbol} ≈ 1 {outputToken.symbol}</span>
        </div>

        {/* Action Button */}
        <Button 
          className="w-full h-12 text-lg font-medium bg-stark-blue hover:bg-stark-blue/90 text-white shadow-[0_0_20px_rgba(0,212,255,0.2)]"
          onClick={handleSwap}
          disabled={loading || !amount}
        >
          {loading ? "Processing..." : isPrivate ? "Private Swap" : "Swap"}
        </Button>

        {/* Progress */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ProofProgress 
                currentStep={proofStep} 
                error={error || undefined} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

