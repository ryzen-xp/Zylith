"use client"

import { Button } from "@/components/ui/button"
import { useInitializePool } from "@/hooks/use-initialize-pool"
import { useAccount } from "@starknet-react/core"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function InitializePoolButton() {
  const { account } = useAccount()
  const { initialize, isInitializing } = useInitializePool()

  if (!account) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Wallet not connected</AlertTitle>
        <AlertDescription>
          Please connect your wallet to initialize the pool.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Pool Initialization</AlertTitle>
        <AlertDescription>
          Initialize the pool with ETH/USDC at a 1:1 price ratio. This can only be done once.
        </AlertDescription>
      </Alert>

      <Button
        onClick={initialize}
        disabled={isInitializing}
        className="w-full"
        size="lg"
      >
        {isInitializing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Initializing Pool...
          </>
        ) : (
          "Initialize Pool"
        )}
      </Button>

      <div className="text-sm text-muted-foreground space-y-1">
        <p><strong>Token0:</strong> ETH (0x049d...dc7)</p>
        <p><strong>Token1:</strong> USDC (0x053c...8a8)</p>
        <p><strong>Fee:</strong> 0.3% (3000)</p>
        <p><strong>Tick Spacing:</strong> 60</p>
        <p><strong>Initial Price:</strong> 1:1 (Q128)</p>
      </div>
    </div>
  )
}

