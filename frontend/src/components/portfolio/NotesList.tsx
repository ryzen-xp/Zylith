"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { usePortfolio } from "@/hooks/use-portfolio"
import { Note } from "@/lib/commitment"
import { TOKENS } from "@/lib/config"
import { ArrowRight, ExternalLink } from "lucide-react"
import { toHex } from "@/lib/commitment"

export function NotesList() {
  const { notes, removeNote } = usePortfolio()

  const getTokenSymbol = (address?: string) => {
    return TOKENS.find(t => t.address === address)?.symbol || "UNK"
  }

  if (notes.length === 0) {
    return (
      <Card className="bg-stark-dark border-stark-gray/10">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No private notes found</p>
          <p className="text-xs text-muted-foreground mt-2">
            Deposit tokens to create private commitments
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-stark-dark border-stark-gray/10">
      <CardHeader>
        <CardTitle>Private Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {notes.map((note, index) => (
          <NoteItem 
            key={index} 
            note={note} 
            tokenSymbol={getTokenSymbol(note.tokenAddress)}
            onRemove={() => removeNote(note.commitment)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function NoteItem({ 
  note, 
  tokenSymbol, 
  onRemove 
}: { 
  note: Note
  tokenSymbol: string
  onRemove: () => void
}) {
  return (
    <div className="p-4 rounded-lg bg-stark-darker border border-stark-gray/10 hover:border-stark-blue/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-stark-purple/20 flex items-center justify-center text-xs font-bold text-stark-purple">
              {tokenSymbol[0]}
            </div>
            <div>
              <div className="font-medium">{note.amount.toString()} {tokenSymbol}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {toHex(note.commitment).slice(0, 16)}...
              </div>
            </div>
          </div>
          {note.index !== undefined && (
            <div className="text-xs text-muted-foreground">
              Leaf Index: {note.index}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-8">
            <ArrowRight className="h-3 w-3 mr-1" />
            Use
          </Button>
        </div>
      </div>
    </div>
  )
}

