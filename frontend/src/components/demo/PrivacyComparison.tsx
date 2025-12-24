"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Eye, EyeOff, Lock, Shield } from "lucide-react"

export function PrivacyComparison() {
  const [showPrivate, setShowPrivate] = useState(true)

  return (
    <Card className="bg-stark-dark border-stark-gray/10">
      <CardHeader>
        <CardTitle>Privacy Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShowPrivate(!showPrivate)}
            className="gap-2"
          >
            {showPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Toggle View
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <ComparisonCard
            title="Traditional AMM"
            isPrivate={false}
            visible={!showPrivate}
            items={[
              { label: "Swap Amount", value: "100 ETH", hidden: false },
              { label: "User Address", value: "0x1234...", hidden: false },
              { label: "Balance", value: "500 ETH", hidden: false },
              { label: "Routing", value: "ETH → USDC", hidden: false },
            ]}
          />
          <ComparisonCard
            title="Zylith Private AMM"
            isPrivate={true}
            visible={showPrivate}
            items={[
              { label: "Swap Amount", value: "100 ETH", hidden: true },
              { label: "User Address", value: "0x1234...", hidden: true },
              { label: "Balance", value: "500 ETH", hidden: true },
              { label: "Routing", value: "ETH → USDC", hidden: true },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ComparisonCard({ 
  title, 
  isPrivate, 
  visible, 
  items 
}: { 
  title: string
  isPrivate: boolean
  visible: boolean
  items: { label: string; value: string; hidden: boolean }[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: visible ? 1 : 0.5, scale: visible ? 1 : 0.95 }}
      transition={{ duration: 0.3 }}
      className={`p-6 rounded-lg border ${
        isPrivate 
          ? "bg-stark-purple/5 border-stark-purple/30" 
          : "bg-stark-darker border-stark-gray/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        {isPrivate ? (
          <Shield className="h-5 w-5 text-stark-purple" />
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground" />
        )}
        <h3 className="font-bold">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}:</span>
            <span className="font-mono">
              {item.hidden && isPrivate ? "••••••" : item.value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

