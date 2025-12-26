"use client"

import { useState, useEffect } from "react"
import { ArrowDown, Settings, CheckCircle2, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TokenSelector } from "./TokenSelector"
import { PrivacyShield } from "@/components/shared/PrivacyShield"
import { ProofProgress } from "@/components/shared/ProofProgress"
import { usePrivateSwap } from "@/hooks/use-private-swap"
import { usePortfolio } from "@/hooks/use-portfolio"
import { TOKENS } from "@/lib/config"
import { toBigInt } from "@/lib/commitment"
import { getUserFriendlyError } from "@/lib/error-messages"
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { HelpCircle, ArrowRight, Wallet } from "lucide-react"
import Link from "next/link"

export function SwapInterface() {
  const [inputToken, setInputToken] = useState(TOKENS[0])
  const [outputToken, setOutputToken] = useState(TOKENS[1])
  const [amount, setAmount] = useState("")
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null)
  const [isPrivate, setIsPrivate] = useState(true)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingSwap, setPendingSwap] = useState<(() => void) | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  
  const { executeSwap, isLoading, error, proofStep } = usePrivateSwap()
  const { getNotesByToken, getTotalBalance, transactions } = usePortfolio()

  // Handle client-side mounting to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Get latest successful swap transaction
  useEffect(() => {
    if (proofStep === 'complete' && !isLoading) {
      const latestSwap = transactions.find(tx => tx.type === 'swap' && tx.status === 'success')
      if (latestSwap) {
        setSuccessTxHash(latestSwap.hash)
        // Clear success message after 10 seconds
        const timer = setTimeout(() => setSuccessTxHash(null), 10000)
        return () => clearTimeout(timer)
      }
    } else if (proofStep !== 'complete') {
      // Clear success message when starting a new swap
      setSuccessTxHash(null)
    }
  }, [transactions, proofStep, isLoading])

  // Get available notes for input token (only after mount to avoid hydration mismatch)
  const availableNotes = isMounted ? getNotesByToken(inputToken.address) : []
  const totalBalance = isMounted ? getTotalBalance(inputToken.address) : 0n
  
  // Calculate amount in smallest unit (assuming 18 decimals for demo)
  // Handle empty string, "0", "0.0", etc. as 0
  // Use same logic as DepositForm to properly handle decimals
  const decimals = 18 // Assuming 18 decimals for all tokens
  const amountBigInt = amount ? (() => {
    const trimmed = amount.trim()
    if (!trimmed || trimmed === '0' || trimmed === '0.0' || trimmed === '0.00') {
      return 0n
    }
    
    // Parse as float to handle decimals
    const floatValue = parseFloat(trimmed)
    if (isNaN(floatValue) || floatValue <= 0) {
      return 0n
    }
    
    // Multiply by 10^decimals to get smallest unit, then convert to BigInt
    // Use string manipulation to avoid precision loss
    const parts = trimmed.split('.')
    if (parts.length === 1) {
      // Integer: "1" -> 1 * 10^18
      return BigInt(trimmed) * BigInt(10 ** decimals)
    } else {
      // Decimal: "0.01" -> "01" -> 1 * 10^16 (18-2)
      const integerPart = parts[0] || '0'
      const decimalPart = parts[1] || ''
      const decimalPlaces = decimalPart.length
      
      // Pad or truncate decimal part to match token decimals
      let adjustedDecimal = decimalPart
      if (decimalPlaces < decimals) {
        adjustedDecimal = decimalPart.padEnd(decimals, '0')
      } else if (decimalPlaces > decimals) {
        adjustedDecimal = decimalPart.substring(0, decimals)
      }
      
      // Combine: integerPart + adjustedDecimal = total in smallest units
      const totalString = integerPart + adjustedDecimal
      return BigInt(totalString)
    }
  })() : 0n
  
  const amountValue = amount?.trim() || "0"
  const amountNum = parseFloat(amountValue) || 0

  // Find suitable note (either selected or first with enough balance)
  const selectedNote = selectedNoteIndex !== null && availableNotes[selectedNoteIndex] !== undefined
    ? availableNotes[selectedNoteIndex] 
    : availableNotes.find(n => n.amount >= amountBigInt)
  
  // Check if amount is valid (greater than 0)
  const isValidAmount = amountNum > 0 && amountBigInt > BigInt(0)
  
  // Determine button disabled state and message
  const getButtonState = () => {
    if (isLoading) {
      return { disabled: true, text: "Processing...", reason: "loading" }
    }
    
    if (!isValidAmount) {
      return { disabled: true, text: "Enter amount", reason: "no_amount" }
    }
    
    if (isPrivate) {
      if (availableNotes.length === 0) {
        return { disabled: true, text: "No notes available - Deposit first", reason: "no_notes" }
      }
      
      if (!selectedNote) {
        return { disabled: true, text: `Insufficient balance - Need ${amount} ${inputToken.symbol}`, reason: "insufficient_balance" }
      }
      
      // Check if note has index (leaf index is required for Merkle proof)
      if (selectedNote.index === undefined) {
        return { disabled: true, text: "Note not synced - Please wait", reason: "note_not_synced" }
      }
    }
    
    return { disabled: false, text: isPrivate ? "Private Swap" : "Swap", reason: "ready" }
  }
  
  const buttonState = getButtonState()
  
  // Debug info (remove in production)
  useEffect(() => {
    console.log("Swap Button State:", {
      isLoading,
      amount,
      amountValue,
      amountNum,
      amountBigInt: amountBigInt.toString(),
      isValidAmount,
      isPrivate,
      availableNotesCount: availableNotes.length,
      selectedNote: selectedNote ? {
        amount: selectedNote.amount.toString(),
        index: selectedNote.index,
        commitment: selectedNote.commitment.toString()
      } : null,
      buttonState
    })
  }, [isLoading, amount, amountValue, amountNum, amountBigInt, isValidAmount, isPrivate, availableNotes.length, selectedNote, buttonState])

  const executeSwapAction = async () => {
    if (!amount || amountBigInt === 0n) {
      alert("Please enter an amount")
      return
    }

    if (!inputToken || !outputToken) {
      alert("Please select tokens")
      return
    }

    if (inputToken.address === outputToken.address) {
      alert("Input and output tokens must be different")
      return
    }
    
    if (isPrivate) {
      if (!selectedNote) {
        alert("No suitable note found. Please deposit tokens first or select a different note.")
        return
      }

      if (selectedNote.amount < amountBigInt) {
        alert(`Insufficient balance in selected note. Available: ${selectedNote.amount.toString()}, Required: ${amountBigInt.toString()}`)
        return
      }

      if (!selectedNote.index && selectedNote.index !== 0) {
        alert("Selected note does not have a leaf index. Please wait for synchronization.")
        return
      }

      try {
        // Determine swap direction: true = token0 -> token1, false = token1 -> token0
        const zeroForOne = inputToken.address < outputToken.address
        
        // TODO: Calculate actual output amount from CLMM
        // For now, using simplified 1:1 ratio
        const expectedOutputAmount = amountBigInt
        
        // TODO: Get sqrt_price_limit from pool state
        const sqrtPriceLimitX128 = { low: 0n, high: 0n }

        const outputNote = await executeSwap(
          selectedNote,
          amountBigInt,
          zeroForOne,
          sqrtPriceLimitX128,
          expectedOutputAmount
        )

        // Reset form on success
        setAmount("")
        setSelectedNoteIndex(null)
        
        // Success will be shown via useEffect watching transactions
      } catch (err) {
        // Error is already handled by usePrivateSwap hook
        console.error("Swap failed:", err)
      }
    } else {
      // Public swap logic (not implemented)
      alert("Public swap not implemented in this demo")
    }
  }

  const handleSwap = () => {
    // Show confirmation dialog
    setPendingSwap(() => executeSwapAction)
    setShowConfirmDialog(true)
  }

  return (
    <>
    <Card className="w-full max-w-[480px] bg-stark-dark border-stark-gray/10 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl font-bold">Swap</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  Private swaps use zero-knowledge proofs to hide transaction amounts and maintain privacy. 
                  Your input note is replaced with a new output note containing the swapped tokens.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="cursor-pointer"
            onClick={() => setIsPrivate(!isPrivate)}
          >
            <PrivacyShield active={isPrivate} />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input */}
        <div className="rounded-xl bg-stark-darker p-4 space-y-2 border border-stark-gray/10 focus-within:border-stark-blue/30 transition-colors">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>You pay</span>
            <span>
              Balance: {isPrivate 
                ? `${availableNotes.length} note${availableNotes.length !== 1 ? 's' : ''}` 
                : "0.00"}
            </span>
          </div>
          
          {/* Note selector for private swaps */}
          {isPrivate && availableNotes.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <select
                value={selectedNoteIndex ?? ""}
                onChange={(e) => setSelectedNoteIndex(e.target.value ? Number(e.target.value) : null)}
                className="bg-stark-dark border border-stark-gray/20 rounded px-2 py-1 text-xs"
              >
                <option value="">Auto-select note</option>
                {availableNotes.map((note, idx) => (
                  <option key={idx} value={idx}>
                    Note #{idx + 1}: {note.amount.toString()} (Index: {note.index ?? 'N/A'})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-4">
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-none bg-transparent text-2xl p-0 focus-visible:ring-0 h-auto"
            />
            <TokenSelector 
              selectedToken={inputToken} 
              onSelect={setInputToken} 
            />
          </div>
        </div>

        {/* Switch Arrow */}
        <div className="flex justify-center -my-2 relative z-10">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-stark-dark border-stark-darker hover:bg-stark-darker"
            onClick={() => {
              const temp = inputToken
              setInputToken(outputToken)
              setOutputToken(temp)
            }}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Output */}
        <div className="rounded-xl bg-stark-darker p-4 space-y-2 border border-stark-gray/10">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>You receive</span>
            <span>Balance: {isPrivate ? "Hidden" : "0.00"}</span>
          </div>
          <div className="flex gap-4">
            <Input
              type="number"
              placeholder="0.0"
              readOnly
              value={amount} // Demo: 1:1 price
              className="border-none bg-transparent text-2xl p-0 focus-visible:ring-0 h-auto text-stark-blue"
            />
            <TokenSelector 
              selectedToken={outputToken} 
              onSelect={setOutputToken} 
            />
          </div>
        </div>

        {/* Price Info */}
        <div className="flex justify-between text-xs px-2 text-muted-foreground">
          <span>Rate</span>
          <span className="text-yellow-400">
            Calculando desde pool...
            {/* TODO: Implementar cálculo real del rate desde el estado del pool CLMM
            El rate actual (1:1) es temporal. Necesitamos:
            1. Obtener sqrtPriceX128 del pool
            2. Calcular el precio real usando la fórmula del CLMM
            3. Calcular el output amount basado en la liquidez del pool
            */}
          </span>
        </div>
        
        {/* No Notes Warning */}
        {isPrivate && availableNotes.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4"
          >
            <div className="flex items-start gap-3">
              <Wallet className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-400 mb-1">No notes available</p>
                <p className="text-sm text-yellow-300/80 mb-3">
                  Para hacer un swap privado, primero necesitas depositar tokens. Esto creará una "nota privada" que podrás usar para hacer swaps.
                </p>
                <Link
                  href="/portfolio"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-300 text-sm font-medium transition-colors"
                >
                  <Wallet className="h-4 w-4" />
                  Ir a Portfolio para Depositar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Success Display */}
        {successTxHash && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Swap completed successfully!</span>
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

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400"
          >
            {getUserFriendlyError(error, { 
              operation: 'swap',
              balance: selectedNote?.amount,
              token: inputToken.symbol
            })}
          </motion.div>
        )}

        {/* Debug Info - Always show for troubleshooting */}
        <div className="text-xs text-muted-foreground p-2 bg-stark-darker rounded border border-stark-gray/10 space-y-1">
          <div className="flex justify-between">
            <span>Amount:</span>
            <span>{amount || "empty"} → {amountNum} → {amountBigInt.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Valid Amount:</span>
            <span className={isValidAmount ? "text-green-400" : "text-red-400"}>{isValidAmount ? "Yes" : "No"}</span>
          </div>
          <div className="flex justify-between">
            <span>Notes Available:</span>
            <span>{availableNotes.length} note{availableNotes.length !== 1 ? 's' : ''}</span>
          </div>
          {isPrivate && (
            <>
              <div className="flex justify-between">
                <span>Selected Note:</span>
                <span>{selectedNote ? `Yes (Index: ${selectedNote.index ?? "N/A"})` : "No"}</span>
              </div>
              {selectedNote && (
                <div className="flex justify-between">
                  <span>Note Balance:</span>
                  <span>{selectedNote.amount.toString()} wei</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between pt-1 border-t border-stark-gray/10">
            <span className="font-semibold">Button State:</span>
            <span className={buttonState.disabled ? "text-yellow-400" : "text-green-400"}>
              {buttonState.text} ({buttonState.reason})
            </span>
          </div>
        </div>

        {/* Action Button */}
        <Button 
          className="w-full h-12 text-lg font-medium bg-stark-blue hover:bg-stark-blue/90 text-white shadow-[0_0_20px_rgba(0,212,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-stark-blue"
          onClick={handleSwap}
          disabled={buttonState.disabled}
          title={buttonState.disabled ? `Disabled: ${buttonState.reason}` : "Click to swap"}
        >
          {buttonState.text}
        </Button>

        {/* Progress */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-3"
            >
              <ProofProgress 
                currentStep={proofStep} 
                error={error || undefined} 
              />
              {proofStep === "computing_proof" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/30"
                >
                  <p className="text-sm text-blue-300">
                    💡 <strong>Generating ZK proof...</strong> This is the most time-consuming step. 
                    The circuit is processing ~22,000 constraints, which typically takes 2-3 minutes. 
                    Please keep this window open.
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>

    <ConfirmationDialog
      open={showConfirmDialog}
      onOpenChange={setShowConfirmDialog}
      title="Confirm Private Swap"
      description={`You are about to swap ${amount} ${inputToken.symbol} for ${outputToken.symbol}. This will generate a zero-knowledge proof and execute on-chain.`}
      confirmLabel="Confirm Swap"
      cancelLabel="Cancel"
      onConfirm={() => {
        if (pendingSwap) {
          pendingSwap()
          setPendingSwap(null)
        }
      }}
    />
    </>
  )
}

