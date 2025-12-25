"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { usePrivateDeposit } from "@/hooks/use-private-deposit"
import { useStarknet } from "@/hooks/use-starknet"
import { usePortfolio } from "@/hooks/use-portfolio"
import { aspClient } from "@/lib/asp-client"
import { TOKENS } from "@/lib/config"
import { toBigInt } from "@/lib/commitment"
import { getUserFriendlyError } from "@/lib/error-messages"
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog"
import { ProofProgress } from "@/components/shared/ProofProgress"
import { PrivacyShield } from "@/components/shared/PrivacyShield"
import { CheckCircle2, ExternalLink, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"

export function DepositForm() {
  const { account } = useStarknet()
  const { deposit, isLoading, error } = usePrivateDeposit()
  const { transactions } = usePortfolio()
  
  const [amount, setAmount] = useState("")
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]?.address || "")
  const [showConfirm, setShowConfirm] = useState(false)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [isPoolInitialized, setIsPoolInitialized] = useState<boolean | null>(null)
  const [checkingPool, setCheckingPool] = useState(true)

  // Check if pool is initialized
  useEffect(() => {
    const checkPool = async () => {
      try {
        const response = await aspClient.isPoolInitialized()
        setIsPoolInitialized(response.initialized)
      } catch (err) {
        console.error("Failed to check pool status:", err)
        setIsPoolInitialized(false)
      } finally {
        setCheckingPool(false)
      }
    }
    checkPool()
  }, [])

  // Re-check pool status after initialize transaction
  useEffect(() => {
    const initializeTx = transactions.find(tx => 
      tx.type === 'initialize' && tx.status === 'success'
    )
    if (initializeTx && !isPoolInitialized) {
      // Re-check pool status after a delay (state propagation can take a few seconds)
      // Try multiple times with increasing delays
      const delays = [2000, 5000, 10000] // 2s, 5s, 10s
      delays.forEach((delay, index) => {
        setTimeout(async () => {
          try {
            const response = await aspClient.isPoolInitialized()
            if (response.initialized) {
              setIsPoolInitialized(true)
              setCheckingPool(false)
            } else if (index === delays.length - 1) {
              // Last attempt failed, show error
              console.warn("Pool initialization detected but state not yet propagated. Please wait a few more seconds.")
            }
          } catch (err) {
            console.error(`Failed to re-check pool status (attempt ${index + 1}):`, err)
            if (index === delays.length - 1) {
              setCheckingPool(false)
            }
          }
        }, delay)
      })
    }
  }, [transactions, isPoolInitialized])

  // Get latest successful deposit transaction
  useEffect(() => {
    if (!isLoading) {
      const latestDeposit = transactions.find(tx => 
        tx.type === 'deposit' && tx.status === 'success'
      )
      if (latestDeposit) {
        setSuccessTxHash(latestDeposit.hash)
        const timer = setTimeout(() => setSuccessTxHash(null), 10000)
        return () => clearTimeout(timer)
      }
    }
  }, [transactions, isLoading])

  const selectedTokenInfo = TOKENS.find(t => t.address === selectedToken)
  const decimals = selectedTokenInfo?.decimals || 18
  
  // Convert amount string to BigInt in smallest unit
  // Handle decimal numbers correctly: "0.01" * 10^18 = 10000000000000000
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

  const handleDeposit = async () => {
    if (!amount || amountBigInt === 0n) {
      alert("Please enter an amount")
      return
    }

    if (!selectedToken) {
      alert("Please select a token")
      return
    }

    try {
      const note = await deposit(selectedToken, amountBigInt)
      // Note is added to portfolio, find the latest deposit transaction
      const latestDepositTx = transactions.find(tx => 
        tx.type === 'deposit' && tx.status === 'success'
      )
      if (latestDepositTx) {
        setSuccessTxHash(latestDepositTx.hash)
        setAmount("")
        setTimeout(() => setSuccessTxHash(null), 10000)
      }
    } catch (err) {
      console.error("Deposit failed:", err)
    }
  }

  if (!account) {
    return (
      <Card className="bg-stark-dark border-stark-gray/10">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Connect your wallet to deposit tokens</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-stark-dark border-stark-gray/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Deposit Tokens</CardTitle>
            <PrivacyShield active={true} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Select Token
            </label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full bg-stark-darker border border-stark-gray/20 rounded px-3 py-2 text-sm"
            >
              {TOKENS.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
          </div>

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
            {selectedTokenInfo && (
              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                <div>Decimals: {selectedTokenInfo.decimals}</div>
                {amount && (
                  <div className="text-green-400">
                    Amount in smallest unit: {amountBigInt.toString()} wei
                    {amountBigInt > 0n && (
                      <span className="text-muted-foreground ml-2">
                        ({amount} {selectedTokenInfo.symbol})
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {!checkingPool && !isPoolInitialized && (
            <Alert className="bg-yellow-500/10 border-yellow-500/20">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertTitle className="text-yellow-400">Pool Not Initialized</AlertTitle>
              <AlertDescription className="text-yellow-300">
                The pool must be initialized before you can make deposits. Please use the "Initialize Pool" button above to initialize the pool first.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {getUserFriendlyError(error, { operation: 'deposit' })}
            </div>
          )}

          {successTxHash && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Deposit successful!</span>
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
            onClick={() => setShowConfirm(true)}
            disabled={isLoading || !amount || amountBigInt === 0n || !isPoolInitialized || checkingPool}
            title={
              checkingPool
                ? "Checking pool status..."
                : !isPoolInitialized
                  ? "Pool must be initialized first"
                  : !amount 
                    ? "Enter an amount" 
                    : amountBigInt === 0n 
                      ? "Amount must be greater than 0" 
                      : "Click to deposit"
            }
          >
            {checkingPool
              ? "Checking pool status..."
              : !isPoolInitialized
                ? "Pool Not Initialized"
                : isLoading 
                  ? "Processing..." 
                  : !amount || amountBigInt === 0n
                    ? "Enter amount to deposit"
                    : "Deposit"
            }
          </Button>

          {isLoading && (
            <ProofProgress 
              currentStep="idle" 
              error={error || undefined} 
            />
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Confirm Deposit"
        description={`You are about to deposit ${amount} ${selectedTokenInfo?.symbol || 'tokens'}. This will create a private commitment note.`}
        confirmLabel="Confirm Deposit"
        cancelLabel="Cancel"
        onConfirm={handleDeposit}
      />
    </>
  )
}

