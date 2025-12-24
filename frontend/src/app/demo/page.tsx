"use client"

import { PrivacyComparison } from "@/components/demo/PrivacyComparison"
import { ProofVisualizer } from "@/components/demo/ProofVisualizer"
import { MerkleTreeExplorer } from "@/components/demo/MerkleTreeExplorer"
import { TransactionFlow } from "@/components/demo/TransactionFlow"

export default function DemoPage() {
  return (
    <div className="container py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-stark-blue to-stark-purple">
            Interactive Demo
          </h1>
          <p className="text-stark-gray max-w-2xl mx-auto">
            Explore how Zylith's privacy features work. See the difference between public and private transactions.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <PrivacyComparison />
          <ProofVisualizer />
          <MerkleTreeExplorer />
          <TransactionFlow />
        </div>
      </div>
    </div>
  )
}

