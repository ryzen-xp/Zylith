"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PrivacyShield } from "@/components/shared/PrivacyShield"
import { RangeSelector } from "./RangeSelector"
import { PositionCard } from "./PositionCard"
import { useLiquidity } from "@/hooks/use-liquidity"
import { usePortfolio } from "@/hooks/use-portfolio"

export function LiquidityManager() {
  const [activeTab, setActiveTab] = useState("add")
  const [amount, setAmount] = useState("")
  const [tickLower, setTickLower] = useState(-1000)
  const [tickUpper, setTickUpper] = useState(1000)
  
  const { addLiquidity, removeLiquidity, loading } = useLiquidity()
  const { notes } = usePortfolio()

  // Mock positions for demo
  const positions = [
    {
      id: "1",
      tickLower: -500,
      tickUpper: 500,
      liquidity: "1000",
      feeAccrued: "5.2",
      token0: "ETH",
      token1: "USDC"
    }
  ]

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-stark-darker border-stark-gray/10">
          <TabsTrigger value="add">Add Liquidity</TabsTrigger>
          <TabsTrigger value="remove">Remove</TabsTrigger>
          <TabsTrigger value="positions">My Positions</TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="space-y-4">
          <Card className="bg-stark-dark border-stark-gray/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add Private Liquidity</CardTitle>
                <PrivacyShield active={true} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Amount
                </label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-stark-darker border-stark-gray/20"
                />
              </div>

              <RangeSelector
                tickLower={tickLower}
                tickUpper={tickUpper}
                onRangeChange={(lower, upper) => {
                  setTickLower(lower)
                  setTickUpper(upper)
                }}
              />

              <div className="p-4 rounded-lg bg-stark-darker border border-stark-gray/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee Tier</span>
                  <span>0.3%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Fees (24h)</span>
                  <span>~$0.00</span>
                </div>
              </div>

              <Button
                className="w-full bg-stark-blue hover:bg-stark-blue/90"
                onClick={() => addLiquidity(notes[0], tickLower, tickUpper, BigInt(amount || "0"))}
                disabled={loading || !amount}
              >
                {loading ? "Processing..." : "Add Private Liquidity"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remove" className="space-y-4">
          <Card className="bg-stark-dark border-stark-gray/10">
            <CardHeader>
              <CardTitle>Remove Liquidity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Liquidity Amount
                </label>
                <Input
                  type="number"
                  placeholder="0.0"
                  className="bg-stark-darker border-stark-gray/20"
                />
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => removeLiquidity()}
                disabled={loading}
              >
                {loading ? "Processing..." : "Remove Liquidity"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <div className="grid gap-4">
            {positions.length === 0 ? (
              <Card className="bg-stark-dark border-stark-gray/10">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No positions found</p>
                </CardContent>
              </Card>
            ) : (
              positions.map((position) => (
                <PositionCard key={position.id} position={position} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

