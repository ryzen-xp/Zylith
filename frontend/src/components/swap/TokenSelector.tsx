"use client"

import { useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TOKENS } from "@/lib/config"

interface Token {
  symbol: string
  name: string
  address: string
  decimals: number
}

interface TokenSelectorProps {
  selectedToken?: Token
  onSelect: (token: Token) => void
  disabled?: boolean
}

export function TokenSelector({ selectedToken, onSelect, disabled }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filteredTokens = TOKENS.filter(t => 
    t.symbol.toLowerCase().includes(search.toLowerCase()) || 
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          disabled={disabled}
          className="w-32 justify-between bg-stark-darker border-stark-gray/20 hover:bg-stark-darker/80"
        >
          {selectedToken ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-stark-blue/20 flex items-center justify-center text-[10px]">
                {selectedToken.symbol[0]}
              </div>
              <span>{selectedToken.symbol}</span>
            </div>
          ) : (
            "Select"
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-stark-dark border-stark-gray/20">
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
        </DialogHeader>
        <div className="p-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-stark-darker border-stark-gray/20"
            />
          </div>
          <div className="grid gap-2 max-h-[300px] overflow-y-auto">
            {filteredTokens.map((token) => (
              <div
                key={token.address}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-stark-darker cursor-pointer transition-colors"
                onClick={() => {
                  onSelect(token)
                  setIsOpen(false)
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-stark-blue/20 flex items-center justify-center text-xs font-bold text-stark-blue">
                    {token.symbol[0]}
                  </div>
                  <div>
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-xs text-muted-foreground">{token.name}</div>
                  </div>
                </div>
                {selectedToken?.address === token.address && (
                  <div className="h-2 w-2 rounded-full bg-stark-success" />
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

