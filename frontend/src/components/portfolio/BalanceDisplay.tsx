"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePortfolio } from "@/hooks/use-portfolio"
import { TOKENS } from "@/lib/config"
import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export function BalanceDisplay() {
  const { getTotalBalance, notes } = usePortfolio()
  const [isVisible, setIsVisible] = useState(false)

  const totalByToken = TOKENS.map(token => ({
    token,
    balance: getTotalBalance(token.address),
    notes: notes.filter(n => n.tokenAddress === token.address)
  }))

  const totalValue = totalByToken.reduce((sum, item) => sum + Number(item.balance), 0)

  return (
    <Card className="bg-stark-dark border-stark-gray/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Private Balance</CardTitle>
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
                {isVisible ? balance.toString() : "•••"}
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

