"use client"

import { useAccount, useConnect, useDisconnect, useNetwork, useProvider } from "@starknet-react/core"
import { useMemo } from "react"

export function useStarknet() {
  const { address, status, account } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { chain } = useNetwork()
  const { provider } = useProvider()

  const isConnected = status === "connected"
  const isConnecting = status === "connecting"
  const isReconnecting = status === "reconnecting"

  return useMemo(() => ({
    address,
    status,
    account,
    connect,
    connectors,
    disconnect,
    chain,
    provider,
    isConnected,
    isConnecting,
    isReconnecting
  }), [
    address,
    status,
    account,
    connect,
    connectors,
    disconnect,
    chain,
    provider,
    isConnected,
    isConnecting,
    isReconnecting
  ])
}

