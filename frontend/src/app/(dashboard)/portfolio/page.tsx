"use client"

import { BalanceDisplay } from "@/components/portfolio/BalanceDisplay"
import { NotesList } from "@/components/portfolio/NotesList"
import { TransactionHistory } from "@/components/portfolio/TransactionHistory"
import { DepositForm } from "@/components/portfolio/DepositForm"

export default function PortfolioPage() {
  return (
    <div className="container py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-stark-gray">
            Portfolio
          </h1>
          <p className="text-stark-gray">
            View your private balances and transaction history.
          </p>
        </div>

        <DepositForm />

        <div className="grid gap-6 md:grid-cols-2">
          <BalanceDisplay />
          <NotesList />
        </div>

        <TransactionHistory />
      </div>
    </div>
  )
}

