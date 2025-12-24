"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { useContractEvents } from "@/hooks/use-contract-events"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Initialize event listeners for the dashboard
  useContractEvents()

  return (
    <div className="flex min-h-screen bg-stark-darker">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

