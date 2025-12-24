"use client"

import { motion } from "framer-motion"
import { Shield, Lock, Zap, GitBranch, Eye, Code } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const FEATURES = [
  {
    icon: Shield,
    title: "Private Swaps",
    description: "Execute trades without revealing amounts, routing, or your identity. All transactions are cryptographically hidden using zero-knowledge proofs.",
    color: "text-stark-purple",
    bgColor: "bg-stark-purple/10",
    link: "/swap"
  },
  {
    icon: Lock,
    title: "Shielded Liquidity",
    description: "Provide liquidity anonymously. Your positions, earnings, and balance remain completely private from public view.",
    color: "text-stark-blue",
    bgColor: "bg-stark-blue/10",
    link: "/liquidity"
  },
  {
    icon: Zap,
    title: "Zero-Knowledge Proofs",
    description: "Built on Circom circuits and verified on-chain with Garaga. Your privacy is mathematically guaranteed.",
    color: "text-stark-success",
    bgColor: "bg-stark-success/10",
    link: "/demo"
  },
  {
    icon: GitBranch,
    title: "CLMM Precision",
    description: "Full concentrated liquidity market maker with Ekubo-compatible math. Efficient capital utilization with private positions.",
    color: "text-stark-blue",
    bgColor: "bg-stark-blue/10",
    link: "/docs"
  },
  {
    icon: Eye,
    title: "Merkle Tree Privacy",
    description: "Commitment-based ownership using Poseidon BN254 hashing. Depth 25 tree with historical root tracking for proof flexibility.",
    color: "text-stark-purple",
    bgColor: "bg-stark-purple/10",
    link: "/demo"
  },
  {
    icon: Code,
    title: "Starknet Native",
    description: "Built entirely on Starknet with Cairo contracts. Leverage Starknet's scalability and Ethereum security.",
    color: "text-stark-success",
    bgColor: "bg-stark-success/10",
    link: "/docs"
  }
]

export default function FeaturesPage() {
  return (
    <div className="container py-20">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-stark-gray"
          >
            Features
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-stark-gray max-w-2xl mx-auto"
          >
            Zylith combines the best of DeFi with complete privacy. 
            Trade, provide liquidity, and manage positions without revealing your identity or amounts.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <Card className="h-full bg-stark-dark border-stark-gray/10 hover:border-stark-blue/30 transition-all">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-4`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="text-stark-gray">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={feature.link}>
                    <Button variant="ghost" size="sm" className="w-full">
                      Learn More →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

