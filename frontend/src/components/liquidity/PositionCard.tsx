"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MoreVertical } from "lucide-react"

interface Position {
  id: string
  tickLower: number
  tickUpper: number
  liquidity: string
  feeAccrued: string
  token0: string
  token1: string
}

interface PositionCardProps {
  position: Position
  onCollectFees?: () => void
  onRemove?: () => void
}

export function PositionCard({ position, onCollectFees, onRemove }: PositionCardProps) {
  return (
    <Card className="bg-stark-dark border-stark-gray/10 hover:border-stark-blue/30 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">
          {position.token0} / {position.token1}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Range</div>
            <div className="font-medium">
              {position.tickLower} - {position.tickUpper}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Liquidity</div>
            <div className="font-medium">{position.liquidity}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Fees Accrued</div>
            <div className="font-medium text-stark-success">
              {position.feeAccrued} {position.token0}
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onCollectFees}
            disabled={!onCollectFees}
          >
            Collect Fees
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onRemove}
            disabled={!onRemove}
          >
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

