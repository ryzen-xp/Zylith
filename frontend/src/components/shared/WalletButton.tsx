"use client"

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core"
import { Loader2, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog" // Need to ensure Dialog is created
import { useEffect, useState } from "react"

export function WalletButton() {
  const { address, status } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [isOpen, setIsOpen] = useState(false)

  // Shorten address
  const shortenedAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}` 
    : ""

  if (status === "connected") {
    return (
      <Button 
        variant="outline" 
        onClick={() => disconnect()}
        className="gap-2 border-stark-blue/20 bg-stark-blue/5 hover:bg-stark-blue/10 text-stark-blue"
      >
        <Wallet className="h-4 w-4" />
        {shortenedAddress}
      </Button>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="stark" className="gap-2">
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-stark-dark border-stark-blue/20">
        <DialogHeader>
          <DialogTitle className="text-white">Connect Wallet</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {connectors.map((connector) => (
            <Button
              key={connector.id}
              onClick={() => {
                connect({ connector })
                setIsOpen(false)
              }}
              variant="outline"
              className="justify-start gap-4 border-stark-blue/20 hover:bg-stark-blue/10 hover:text-stark-blue text-white"
            >
              <img 
                src={typeof connector.icon === 'string' ? connector.icon : ''} 
                alt={connector.name} 
                className="h-6 w-6" 
              />
              {connector.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
