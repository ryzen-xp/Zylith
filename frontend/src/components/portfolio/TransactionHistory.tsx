"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { usePortfolio } from "@/hooks/use-portfolio"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { StatusBadge, Status } from "@/components/shared/StatusBadge"

export function TransactionHistory() {
  const { transactions } = usePortfolio()

  if (transactions.length === 0) {
    return (
      <Card className="bg-stark-dark border-stark-gray/10">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No transactions yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-stark-dark border-stark-gray/10">
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {transactions
          .filter((tx, index, self) => 
            // Remove duplicates: keep only the first occurrence of each hash
            index === self.findIndex(t => t.hash === tx.hash)
          )
          .map((tx) => (
            <TransactionItem key={tx.hash} transaction={tx} />
          ))}
      </CardContent>
    </Card>
  )
}

function TransactionItem({ transaction }: { transaction: any }) {
  const statusMap: Record<string, Status> = {
    pending: "pending",
    success: "success",
    failed: "error"
  }

  const typeLabels: Record<string, string> = {
    deposit: "Deposit",
    swap: "Swap",
    withdraw: "Withdraw",
    mint: "Add Liquidity",
    burn: "Remove Liquidity",
    initialize: "Initialize Pool"
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-stark-darker border border-stark-gray/10 hover:border-stark-blue/30 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <Badge variant="outline" className="text-xs">
          {typeLabels[transaction.type] || transaction.type}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono truncate">
            {transaction.hash.slice(0, 10)}...{transaction.hash.slice(-8)}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(transaction.timestamp).toLocaleString()}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={statusMap[transaction.status] || "pending"} />
        <Link
          href={`https://sepolia.starkscan.co/tx/${transaction.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-stark-blue"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

