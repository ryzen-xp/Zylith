"use client";

import React, { useEffect } from "react";
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  publicProvider,
  argent,
  braavos,
  useInjectedConnectors,
  voyager,
} from "@starknet-react/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationToast, useNotifications } from "@/components/shared/NotificationToast";
import { setNotificationHandler } from "@/hooks/use-contract-events";

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

  return (
    <StarknetConfig
      chains={[sepolia, mainnet]}
      provider={publicProvider()}
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

