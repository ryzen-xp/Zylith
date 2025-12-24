"use client"

import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"

interface RangeSelectorProps {
  tickLower: number
  tickUpper: number
  onRangeChange: (lower: number, upper: number) => void
}

export function RangeSelector({ tickLower, tickUpper, onRangeChange }: RangeSelectorProps) {
  const [range, setRange] = useState([tickLower, tickUpper])

  const handleRangeChange = (values: number[]) => {
    setRange(values)
    onRangeChange(values[0], values[1])
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">
          Price Range
        </label>
        <Card className="bg-stark-darker border-stark-gray/10 p-4">
          <div className="space-y-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Min: {range[0]}</span>
              <span>Max: {range[1]}</span>
            </div>
            <Slider
              value={range}
              onValueChange={handleRangeChange}
              min={-887272}
              max={887272}
              step={60}
              className="w-full"
            />
            <div className="flex justify-between text-xs">
              <div className="text-center">
                <div className="text-muted-foreground">Current Price</div>
                <div className="font-medium">~0</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Range</div>
                <div className="font-medium">{range[1] - range[0]}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

