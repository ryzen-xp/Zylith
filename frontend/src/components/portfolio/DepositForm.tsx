"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePrivateDeposit } from "@/hooks/use-private-deposit"
import { useStarknet } from "@/hooks/use-starknet"
import { usePortfolio } from "@/hooks/use-portfolio"
import { TOKENS } from "@/lib/config"
import { toBigInt } from "@/lib/commitment"
import { getUserFriendlyError } from "@/lib/error-messages"
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog"
import { ProofProgress } from "@/components/shared/ProofProgress"
import { PrivacyShield } from "@/components/shared/PrivacyShield"
import { CheckCircle2, ExternalLink } from "lucide-react"
import { motion } from "framer-motion"

export function DepositForm() {
  const { account } = useStarknet()
  const { deposit, isLoading, error } = usePrivateDeposit()
  const { transactions } = usePortfolio()
  
  const [amount, setAmount] = useState("")
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]?.address || "")
  const [showConfirm, setShowConfirm] = useState(false)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)

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
  const amountBigInt = amount ? toBigInt(amount) * BigInt(10 ** decimals) : 0n

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
      const tx = await deposit(selectedToken, amountBigInt)
      if (tx?.transaction_hash) {
        setSuccessTxHash(tx.transaction_hash)
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
              <div className="text-xs text-muted-foreground mt-1">
                Decimals: {selectedTokenInfo.decimals}
              </div>
            )}
          </div>

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
            disabled={isLoading || !amount || amountBigInt === 0n}
          >
            {isLoading ? "Processing..." : "Deposit"}
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

