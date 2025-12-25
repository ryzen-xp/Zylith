"use client"

import { useCallback, useState } from "react"
import { useAccount } from "@starknet-react/core"
import { useStarknet } from "@/hooks/use-starknet"
import { usePortfolio } from "@/hooks/use-portfolio"
import { aspClient } from "@/lib/asp-client"
import { CONFIG } from "@/lib/config"
import { showNotification } from "./use-contract-events"

export function useInitializePool() {
  const { account } = useAccount()
  const { provider } = useStarknet()
  const { addTransaction, updateTransaction } = usePortfolio()
  const [isInitializing, setIsInitializing] = useState(false)

  const initialize = useCallback(async () => {
    if (!account || !provider) {
      showNotification("error", "Wallet not connected", "Please connect your wallet first")
      return
    }

    setIsInitializing(true)

    try {
      // Prepare transaction from ASP
      const response = await aspClient.prepareInitialize()

      if (!response.transactions || response.transactions.length === 0) {
        throw new Error("No transactions prepared")
      }

      const transaction = response.transactions[0]

      // Execute transaction
      const result = await account.execute({
        contractAddress: transaction.contract_address,
        entrypoint: transaction.entry_point,
        calldata: transaction.calldata,
      })

      const txHash = result.transaction_hash
      const explorerUrl = `https://sepolia.starkscan.co/tx/${txHash}`
      
      // Add transaction to history
      addTransaction({
        hash: txHash,
        type: 'initialize',
        status: 'pending',
        timestamp: Date.now(),
      })
      
      // Log transaction info to console for easy access
      console.log("📋 Pool Initialization Transaction:")
      console.log("   Hash:", txHash)
      console.log("   Explorer:", explorerUrl)
      console.log("   View in Transaction History section below")
      
      showNotification(
        "success",
        "Pool initialization submitted",
        `Transaction: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\nCheck Transaction History below or console for link.`
      )

      // Wait for transaction
      if (provider && "waitForTransaction" in provider) {
        await (provider as any).waitForTransaction(txHash)
      }

      // Update transaction status (don't add a new one)
      updateTransaction(txHash, 'success')

      showNotification(
        "success",
        "Pool initialized successfully!",
        "The pool is now ready for deposits, swaps, and liquidity operations."
      )
    } catch (error: any) {
      console.error("Failed to initialize pool:", error)
      showNotification(
        "error",
        "Failed to initialize pool",
        error.message || "An error occurred while initializing the pool"
      )
    } finally {
      setIsInitializing(false)
    }
  }, [account, provider])

  return {
    initialize,
    isInitializing,
  }
}

