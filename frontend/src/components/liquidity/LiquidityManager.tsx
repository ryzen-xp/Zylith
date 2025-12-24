"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PrivacyShield } from "@/components/shared/PrivacyShield"
import { ProofProgress } from "@/components/shared/ProofProgress"
import { RangeSelector } from "./RangeSelector"
import { PositionCard } from "./PositionCard"
import { useLiquidity } from "@/hooks/use-liquidity"
import { usePortfolio } from "@/hooks/use-portfolio"
import { useLPPositionStore } from "@/stores/use-lp-position-store"
import { Note } from "@/lib/commitment"
import { toBigInt } from "@/lib/commitment"
import { getUserFriendlyError } from "@/lib/error-messages"
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle2, ExternalLink, HelpCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { TOKENS } from "@/lib/config"

export function LiquidityManager() {
  const [activeTab, setActiveTab] = useState("add")
  const [amount, setAmount] = useState("")
  const [tickLower, setTickLower] = useState(-1000)
  const [tickUpper, setTickUpper] = useState(1000)
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null)
  const [liquidityAmount, setLiquidityAmount] = useState("")
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [showMintConfirm, setShowMintConfirm] = useState(false)
  const [showBurnConfirm, setShowBurnConfirm] = useState(false)
  
  const { mintLiquidity, burnLiquidity, collectFees, isLoading, error, proofStep } = useLiquidity()
  const { notes, getNotesByToken, transactions } = usePortfolio()
  const { positions: storePositions } = useLPPositionStore()
  
  // Get available notes (for mint operations)
  const availableNotes = notes.filter(n => n.index !== undefined)

  // Get latest successful transaction
  useEffect(() => {
    if (proofStep === 'complete' && !isLoading) {
      const latestTx = transactions.find(tx => 
        (tx.type === 'mint' || tx.type === 'burn') && tx.status === 'success'
      )
      if (latestTx) {
        setSuccessTxHash(latestTx.hash)
        const timer = setTimeout(() => setSuccessTxHash(null), 10000)
        return () => clearTimeout(timer)
      }
    } else if (proofStep !== 'complete') {
      setSuccessTxHash(null)
    }
  }, [transactions, proofStep, isLoading])

  // Map store positions to PositionCard format
  // TODO: Get actual token0/token1 from pool contract
  const positions = storePositions.map(pos => {
    // Calculate fees accrued (simplified - in production, use feeGrowth calculations)
    const feeAccrued0 = Number(pos.tokensOwed0) / 1e18
    const feeAccrued1 = Number(pos.tokensOwed1) / 1e6 // USDC has 6 decimals
    const totalFeeAccrued = (feeAccrued0 + feeAccrued1).toFixed(4)
    
    return {
      id: pos.id,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidity: pos.liquidity.toString(),
      feeAccrued: totalFeeAccrued,
      token0: TOKENS[0]?.symbol || "ETH",
      token1: TOKENS[1]?.symbol || "USDC",
      positionCommitment: BigInt(pos.id), // Use position id as commitment for now
    }
  })

  const selectedNote = selectedNoteIndex !== null 
    ? availableNotes[selectedNoteIndex] 
    : availableNotes[0]

  const amountBigInt = amount ? toBigInt(amount) * BigInt(10 ** 18) : 0n
  const liquidityBigInt = liquidityAmount ? toBigInt(liquidityAmount) : 0n

  const executeMintLiquidity = async () => {
    if (!selectedNote) {
      alert("Please select a note or deposit tokens first")
      return
    }

    if (!amount || amountBigInt === 0n) {
      alert("Please enter an amount")
      return
    }

    if (tickLower >= tickUpper) {
      alert("Invalid tick range: lower tick must be less than upper tick")
      return
    }

    if (selectedNote.amount < amountBigInt) {
      alert(`Insufficient balance. Available: ${selectedNote.amount.toString()}`)
      return
    }

    try {
      // TODO: Calculate actual liquidity amount from amount and tick range
      // For now, using amount as liquidity (simplified)
      const calculatedLiquidity = amountBigInt
      
      // TODO: Generate position commitment from tick range and user address
      // For now, using a mock value
      const positionCommitment = BigInt(Date.now())

      await mintLiquidity(
        selectedNote,
        tickLower,
        tickUpper,
        calculatedLiquidity,
        positionCommitment
      )

      // Reset form on success
      setAmount("")
      setSelectedNoteIndex(null)
    } catch (err) {
      console.error("Mint liquidity failed:", err)
    }
  }

  const handleMintLiquidity = () => {
    setShowMintConfirm(true)
  }

  const executeBurnLiquidity = async () => {
    if (!selectedPositionId) {
      alert("Please select a position")
      return
    }

    const position = positions.find(p => p.id === selectedPositionId)
    if (!position) {
      alert("Position not found")
      return
    }

    if (!liquidityAmount || liquidityBigInt === 0n) {
      alert("Please enter liquidity amount to burn")
      return
    }

    // For burn, we need a note that represents the LP position
    // This is simplified - in reality, LP positions are tracked differently
    if (!selectedNote) {
      alert("Please select a note")
      return
    }

    try {
      await burnLiquidity(
        selectedNote,
        position.tickLower,
        position.tickUpper,
        liquidityBigInt,
        position.positionCommitment
      )

      setLiquidityAmount("")
      setSelectedPositionId(null)
    } catch (err) {
      console.error("Burn liquidity failed:", err)
    }
  }

  const handleBurnLiquidity = () => {
    setShowBurnConfirm(true)
  }

  const handleCollectFees = async () => {
    if (!selectedPositionId) {
      alert("Please select a position")
      return
    }

    const position = positions.find(p => p.id === selectedPositionId)
    if (!position) {
      alert("Position not found")
      return
    }

    if (!selectedNote) {
      alert("Please select a note")
      return
    }

    try {
      await collectFees(
        selectedNote,
        position.tickLower,
        position.tickUpper,
        position.positionCommitment
      )

      setSelectedPositionId(null)
    } catch (err) {
      console.error("Collect fees failed:", err)
    }
  }

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
              {/* Note Selector */}
              {availableNotes.length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Select Note
                  </label>
                  <select
                    value={selectedNoteIndex ?? ""}
                    onChange={(e) => setSelectedNoteIndex(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-stark-darker border border-stark-gray/20 rounded px-3 py-2 text-sm"
                  >
                    <option value="">Auto-select first note</option>
                    {availableNotes.map((note, idx) => (
                      <option key={idx} value={idx}>
                        Note #{idx + 1}: {note.amount.toString()} (Index: {note.index ?? 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                {selectedNote && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Available: {selectedNote.amount.toString()}
                  </div>
                )}
              </div>

              <RangeSelector
                tickLower={tickLower}
                tickUpper={tickUpper}
                onRangeChange={(lower, upper) => {
                  setTickLower(lower)
                  setTickUpper(upper)
                }}
              />

              {/* Preview */}
              <div className="p-4 rounded-lg bg-stark-darker border border-stark-gray/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee Tier</span>
                  <span>0.3%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tick Range</span>
                  <span>{tickLower} to {tickUpper}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Range Width</span>
                  <span>{tickUpper - tickLower} ticks</span>
                </div>
                {amount && (
                  <div className="flex justify-between text-sm pt-2 border-t border-stark-gray/10">
                    <span className="text-muted-foreground">Liquidity to Add</span>
                    <span className="font-medium">{amount}</span>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {getUserFriendlyError(error, { 
                    operation: 'mint',
                    balance: selectedNote?.amount,
                  })}
                </div>
              )}

              {/* Success Display */}
              {successTxHash && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Liquidity added successfully!</span>
                    <a
                      href={`https://sepolia.starkscan.co/tx/${successTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-green-300 hover:text-green-200 underline"
                    >
                      View on Starkscan
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </motion.div>
              )}

              <Button
                className="w-full bg-stark-blue hover:bg-stark-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleMintLiquidity}
                disabled={isLoading || !amount || amountBigInt === 0n || !selectedNote || tickLower >= tickUpper}
              >
                {isLoading ? "Processing..." : "Add Private Liquidity"}
              </Button>

              {/* Progress */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <ProofProgress 
                      currentStep={proofStep} 
                      error={error || undefined} 
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remove" className="space-y-4">
          <Card className="bg-stark-dark border-stark-gray/10">
            <CardHeader>
              <CardTitle>Remove Liquidity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {positions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No positions available</p>
                  <p className="text-xs mt-2">Add liquidity first to create a position</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Select Position
                    </label>
                    <select
                      value={selectedPositionId ?? ""}
                      onChange={(e) => setSelectedPositionId(e.target.value || null)}
                      className="w-full bg-stark-darker border border-stark-gray/20 rounded px-3 py-2 text-sm"
                    >
                      <option value="">Select a position</option>
                      {positions.map((pos) => (
                        <option key={pos.id} value={pos.id}>
                          {pos.token0}/{pos.token1} - Range: {pos.tickLower} to {pos.tickUpper}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPositionId && availableNotes.length > 0 && (
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">
                        Select Note
                      </label>
                      <select
                        value={selectedNoteIndex ?? ""}
                        onChange={(e) => setSelectedNoteIndex(e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-stark-darker border border-stark-gray/20 rounded px-3 py-2 text-sm"
                      >
                        <option value="">Auto-select first note</option>
                        {availableNotes.map((note, idx) => (
                          <option key={idx} value={idx}>
                            Note #{idx + 1}: {note.amount.toString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Liquidity Amount
                    </label>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={liquidityAmount}
                      onChange={(e) => setLiquidityAmount(e.target.value)}
                      className="bg-stark-darker border-stark-gray/20"
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                      {getUserFriendlyError(error, { 
                        operation: 'burn',
                        balance: selectedNote?.amount,
                      })}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleBurnLiquidity}
                    disabled={isLoading || !liquidityAmount || liquidityBigInt === 0n || !selectedPositionId || !selectedNote}
                  >
                    {isLoading ? "Processing..." : "Remove Liquidity"}
                  </Button>

                  <AnimatePresence>
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <ProofProgress 
                          currentStep={proofStep} 
                          error={error || undefined} 
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <div className="grid gap-4">
            {positions.length === 0 ? (
              <Card className="bg-stark-dark border-stark-gray/10">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No positions found</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Add liquidity to create your first position
                  </p>
                </CardContent>
              </Card>
            ) : (
              positions.map((position) => (
                <div key={position.id}>
                  <PositionCard 
                    position={position}
                    onCollectFees={() => {
                      setSelectedPositionId(position.id)
                      setSelectedNoteIndex(availableNotes.length > 0 ? 0 : null)
                      handleCollectFees()
                    }}
                    onRemove={() => {
                      setSelectedPositionId(position.id)
                      setActiveTab("remove")
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmationDialog
        open={showMintConfirm}
        onOpenChange={setShowMintConfirm}
        title="Confirm Add Liquidity"
        description={`You are about to add ${amount} tokens as liquidity in the range ${tickLower} to ${tickUpper}. This will generate a zero-knowledge proof.`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={executeMintLiquidity}
      />

      <ConfirmationDialog
        open={showBurnConfirm}
        onOpenChange={setShowBurnConfirm}
        title="Confirm Remove Liquidity"
        description={`You are about to remove ${liquidityAmount} liquidity from the selected position. This will generate a zero-knowledge proof.`}
        confirmLabel="Confirm Remove"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={executeBurnLiquidity}
      />
    </div>
  )
}

