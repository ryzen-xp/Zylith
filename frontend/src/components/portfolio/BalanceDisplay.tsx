"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePortfolio } from "@/hooks/use-portfolio"
import { TOKENS } from "@/lib/config"
import { Eye, EyeOff, HelpCircle } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function BalanceDisplay() {
  const { getTotalBalance, notes } = usePortfolio()
  const [isVisible, setIsVisible] = useState(false)

  const totalByToken = TOKENS.map(token => ({
    token,
    balance: getTotalBalance(token.address),
    notes: notes.filter(n => n.tokenAddress === token.address)
  }))

  // Calculate total value (simplified - would need price oracle in production)
  const totalValue = totalByToken.reduce((sum, item) => {
    // Simplified: assume 1 unit = $1 for demo
    const balanceInUnits = Number(item.balance) / Math.pow(10, item.token.decimals)
    return sum + balanceInUnits
  }, 0)

  return (
    <Card className="bg-stark-dark border-stark-gray/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Private Balance</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  Your private balance is the sum of all your private notes. Each note represents a private token commitment 
                  stored in the Merkle tree. Your balance remains private until you withdraw.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsVisible(!isVisible)}
          className="h-8 w-8"
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-bold">
          {isVisible ? `$${totalValue.toFixed(2)}` : "••••••"}
        </div>
        <div className="space-y-2">
          {totalByToken.map(({ token, balance, notes }) => (
            <div key={token.address} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-stark-blue/20" />
                <span>{token.symbol}</span>
              </div>
              <span className="font-medium">
                {isVisible 
                  ? (Number(balance) / Math.pow(10, token.decimals)).toFixed(4)
                  : "•••"}
              </span>
              <span className="text-xs text-muted-foreground">
                ({notes.length} notes)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

