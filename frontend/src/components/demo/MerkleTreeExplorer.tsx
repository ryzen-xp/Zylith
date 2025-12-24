"use client"

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useASP } from "@/hooks/use-asp"
import { motion } from "framer-motion"

export function MerkleTreeExplorer() {
  const { treeInfo } = useASP()
  const [searchIndex, setSearchIndex] = useState("")
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])

  // Simplified tree visualization - showing depth 4 for demo
  const depth = 4
  const maxLeaves = Math.pow(2, depth)

  const renderTree = (level: number, index: number): React.ReactNode => {
    if (level === depth) {
      const leafIndex = index - (maxLeaves - 1)
      const isHighlighted = highlightedPath.includes(leafIndex)
      
      return (
        <motion.div
          key={index}
          initial={{ scale: 0.8 }}
          animate={{ scale: isHighlighted ? 1.1 : 1 }}
          className={`h-8 w-8 rounded border text-[8px] flex items-center justify-center ${
            isHighlighted 
              ? "bg-stark-blue border-stark-blue text-white" 
              : "bg-stark-darker border-stark-gray/20 text-muted-foreground"
          }`}
        >
          {leafIndex}
        </motion.div>
      )
    }

    return (
      <div key={index} className="flex flex-col items-center">
        <div className="h-6 w-6 rounded border bg-stark-darker border-stark-gray/20 mb-2" />
        <div className="flex gap-2">
          {renderTree(level + 1, index * 2 + 1)}
          {renderTree(level + 1, index * 2 + 2)}
        </div>
      </div>
    )
  }

  const handleSearch = () => {
    const index = parseInt(searchIndex)
    if (isNaN(index) || index < 0) return
    
    // Calculate path to leaf
    const path: number[] = []
    let current = index
    for (let i = 0; i < depth; i++) {
      path.push(current)
      current = Math.floor(current / 2)
    }
    setHighlightedPath([index])
  }

  return (
    <Card className="bg-stark-dark border-stark-gray/10">
      <CardHeader>
        <CardTitle>Merkle Tree Explorer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Leaf index"
            value={searchIndex}
            onChange={(e) => setSearchIndex(e.target.value)}
            className="bg-stark-darker border-stark-gray/20"
          />
          <Button onClick={handleSearch} size="sm">
            Search
          </Button>
        </div>

        {treeInfo.data && (
          <div className="text-sm space-y-1">
            <div>Root: <span className="font-mono text-xs">{treeInfo.data.root.slice(0, 20)}...</span></div>
            <div>Leaves: {treeInfo.data.leaf_count}</div>
            <div>Depth: {treeInfo.data.depth}</div>
          </div>
        )}

        <div className="overflow-x-auto p-4 bg-stark-darker rounded-lg border border-stark-gray/10">
          <div className="flex justify-center">
            {renderTree(0, 0)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

