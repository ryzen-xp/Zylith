"use client";

import React, { useEffect, useMemo } from "react";
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  publicProvider,
  argent,
  braavos,
  useInjectedConnectors,
  voyager,
} from "@starknet-react/core";
import { RpcProvider } from "starknet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationToast, useNotifications } from "@/components/shared/NotificationToast";
import { setNotificationHandler } from "@/hooks/use-contract-events";
import { CONFIG } from "@/lib/config";

function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { notification, showNotification, dismissNotification } = useNotifications();

  useEffect(() => {
    setNotificationHandler((type, title, message) => {
      showNotification({ type, title, message });
    });
  }, [showNotification]);

  return (
    <>
      {children}
      <NotificationToast notification={notification} onDismiss={dismissNotification} />
    </>
  );
}

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [
      argent(),
      braavos(),
    ],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "onlyIfNoConnectors",
    // Randomize the order of the connectors.
    order: "random"
  });

  const queryClient = new QueryClient();

  // Create custom RPC provider using proxy API route to avoid CORS issues
  // The proxy route (/api/rpc) forwards requests from server (no CORS)
  const provider = useMemo(() => {
    // Use proxy API route for RPC calls to avoid CORS
    const proxyUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/rpc`
      : CONFIG.STARKNET_RPC;
    
    const customProvider = new RpcProvider({ nodeUrl: proxyUrl });
    // Return a function that matches the provider interface expected by StarknetConfig
    return (chain: any) => customProvider;
  }, []);

  return (
    <StarknetConfig
      chains={[sepolia, mainnet]}
      provider={provider}
      connectors={connectors}
      explorer={voyager}
      queryClient={queryClient}
    >
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </QueryClientProvider>
    </StarknetConfig>
  );
}

