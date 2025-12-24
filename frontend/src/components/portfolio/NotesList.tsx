"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePortfolio } from "@/hooks/use-portfolio"
import { usePrivateWithdraw } from "@/hooks/use-private-withdraw"
import { useStarknet } from "@/hooks/use-starknet"
import { Note } from "@/lib/commitment"
import { TOKENS } from "@/lib/config"
import { ArrowRight, ExternalLink, Search, Wallet, X, HelpCircle } from "lucide-react"
import { toHex, toBigInt } from "@/lib/commitment"
import { motion, AnimatePresence } from "framer-motion"
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function NotesList() {
  const { notes, removeNote, getNotesByToken } = usePortfolio()
  const { withdraw, isLoading: isWithdrawing } = usePrivateWithdraw()
  const { address } = useStarknet()
  
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [withdrawNote, setWithdrawNote] = useState<Note | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawRecipient, setWithdrawRecipient] = useState("")
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)

  const getTokenSymbol = (address?: string) => {
    return TOKENS.find(t => t.address === address)?.symbol || "UNK"
  }

  // Filter notes
  const filteredNotes = notes.filter(note => {
    const matchesSearch = searchTerm === "" || 
      toHex(note.commitment).toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.amount.toString().includes(searchTerm) ||
      (note.index !== undefined && note.index.toString().includes(searchTerm))
    
    const matchesToken = selectedToken === null || note.tokenAddress === selectedToken
    
    return matchesSearch && matchesToken
  })

  const executeWithdraw = async () => {
    if (!withdrawNote) return
    
    if (!withdrawAmount || toBigInt(withdrawAmount) === 0n) {
      alert("Please enter an amount")
      return
    }

    if (!withdrawRecipient || withdrawRecipient.length < 10) {
      alert("Please enter a valid recipient address")
      return
    }

    // Get token decimals (default to 18)
    const token = TOKENS.find(t => t.address === withdrawNote.tokenAddress)
    const decimals = token?.decimals || 18
    const amountBigInt = toBigInt(withdrawAmount) * BigInt(10 ** decimals)

    try {
      await withdraw(
        withdrawNote,
        amountBigInt,
        withdrawRecipient,
        withdrawNote.tokenAddress
      )

      // Reset withdraw form
      setWithdrawNote(null)
      setWithdrawAmount("")
      setWithdrawRecipient("")
    } catch (err) {
      console.error("Withdraw failed:", err)
    }
  }

  const handleWithdraw = () => {
    if (!withdrawNote) return
    setShowWithdrawConfirm(true)
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
        <div className="flex items-center justify-between">
          <CardTitle>Private Notes</CardTitle>
          <div className="text-sm text-muted-foreground">
            {filteredNotes.length} of {notes.length}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by commitment, amount, or index..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-stark-darker border-stark-gray/20"
            />
          </div>
          <select
            value={selectedToken ?? ""}
            onChange={(e) => setSelectedToken(e.target.value || null)}
            className="bg-stark-darker border border-stark-gray/20 rounded px-3 py-2 text-sm"
          >
            <option value="">All Tokens</option>
            {TOKENS.map(token => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
          {(searchTerm || selectedToken) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setSelectedToken(null)
              }}
              className="h-9"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Notes List */}
        <div className="space-y-2">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No notes found</p>
              {notes.length > 0 && (
                <p className="text-xs mt-2">Try adjusting your filters</p>
              )}
            </div>
          ) : (
            filteredNotes.map((note, index) => (
              <NoteItem 
                key={index} 
                note={note} 
                tokenSymbol={getTokenSymbol(note.tokenAddress)}
                onRemove={() => removeNote(note.commitment)}
                onWithdraw={() => {
                  setWithdrawNote(note)
                  setWithdrawRecipient(address || "")
                }}
                onUse={() => {
                  // Navigate to swap page with note pre-selected
                  // This would be handled by routing in a real implementation
                  console.log("Use note for swap:", note)
                }}
              />
            ))
          )}
        </div>

        {/* Withdraw Modal */}
        <AnimatePresence>
          {withdrawNote && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setWithdrawNote(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-stark-dark border border-stark-gray/20 rounded-lg p-6 w-full max-w-md"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Withdraw</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setWithdrawNote(null)}
                    className="h-6 w-6"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Amount (Available: {withdrawNote.amount.toString()})
                    </label>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-stark-darker border-stark-gray/20"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-xs"
                      onClick={() => {
                        const token = TOKENS.find(t => t.address === withdrawNote.tokenAddress)
                        const decimals = token?.decimals || 18
                        const fullAmount = Number(withdrawNote.amount) / Math.pow(10, decimals)
                        setWithdrawAmount(fullAmount.toString())
                      }}
                    >
                      Max
                    </Button>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Recipient Address
                    </label>
                    <Input
                      type="text"
                      placeholder="0x..."
                      value={withdrawRecipient}
                      onChange={(e) => setWithdrawRecipient(e.target.value)}
                      className="bg-stark-darker border-stark-gray/20 font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setWithdrawNote(null)}
                      disabled={isWithdrawing}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-stark-blue hover:bg-stark-blue/90"
                      onClick={handleWithdraw}
                      disabled={isWithdrawing || !withdrawAmount || !withdrawRecipient}
                    >
                      {isWithdrawing ? "Processing..." : "Confirm Withdraw"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmationDialog
          open={showWithdrawConfirm}
          onOpenChange={setShowWithdrawConfirm}
          title="Confirm Withdraw"
          description={
            withdrawNote
              ? `You are about to withdraw ${withdrawAmount} ${TOKENS.find(t => t.address === withdrawNote.tokenAddress)?.symbol || 'tokens'} to ${withdrawRecipient.slice(0, 10)}...${withdrawRecipient.slice(-8)}. This will generate a zero-knowledge proof.`
              : ''
          }
          confirmLabel="Confirm Withdraw"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={executeWithdraw}
        />
      </CardContent>
    </Card>
  )
}

function NoteItem({ 
  note, 
  tokenSymbol, 
  onRemove,
  onWithdraw,
  onUse
}: { 
  note: Note
  tokenSymbol: string
  onRemove: () => void
  onWithdraw: () => void
  onUse: () => void
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
          <div className="flex items-center gap-2 text-xs">
            {note.index !== undefined ? (
              <span className="text-muted-foreground">
                Leaf Index: {note.index}
              </span>
            ) : (
              <span className="text-yellow-500/70 italic">
                Index pending sync...
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8"
            onClick={onUse}
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Use
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8"
            onClick={onWithdraw}
          >
            <Wallet className="h-3 w-3 mr-1" />
            Withdraw
          </Button>
        </div>
      </div>
    </div>
  )
}

