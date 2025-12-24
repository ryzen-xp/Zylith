"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Shield, Zap, Lock, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-stark-darker text-white selection:bg-stark-purple/30">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-32">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-stark-blue/10 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="container relative z-10 flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center rounded-full border border-stark-purple/30 bg-stark-purple/10 px-3 py-1 text-sm text-stark-purple backdrop-blur-sm"
            >
              <span className="mr-2 flex h-2 w-2 rounded-full bg-stark-purple"></span>
              Live on Starknet Sepolia
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70"
            >
              Private AMM on <span className="text-stark-blue">Starknet</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 max-w-2xl text-lg text-stark-gray"
            >
              Fully shielded swaps, liquidity, and positions. 
              Trade and earn with complete privacy using zero-knowledge proofs.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex flex-wrap justify-center gap-4"
            >
              <Link href="/swap">
                <Button size="lg" className="bg-stark-blue text-white hover:bg-stark-blue/80 h-12 px-8">
                  Launch App <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="h-12 px-8 border-stark-gray/20 text-white hover:bg-white/5">
                  Try Demo
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 border-t border-stark-gray/10 bg-stark-dark/50">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<Shield className="h-8 w-8 text-stark-purple" />}
                title="Private Swaps"
                description="Execute trades without revealing amounts or routes. Your financial privacy is guaranteed by ZK proofs."
              />
              <FeatureCard 
                icon={<Lock className="h-8 w-8 text-stark-blue" />}
                title="Shielded Liquidity"
                description="Provide liquidity anonymously. Your positions and earnings are hidden from public view."
              />
              <FeatureCard 
                icon={<Zap className="h-8 w-8 text-stark-success" />}
                title="Starknet Speed"
                description="Built on Starknet for blazing fast execution and low fees, with Ethereum-grade security."
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-stark-gray max-w-2xl mx-auto">
                Zylith uses advanced cryptography to break the link between your identity and your transactions.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-12 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-stark-blue/30 to-transparent" />
              
              <StepCard 
                number="1"
                title="Deposit"
                description="Deposit tokens to receive a private commitment note."
              />
              <StepCard 
                number="2"
                title="Generate Proof"
                description="Create a ZK proof locally in your browser."
              />
              <StepCard 
                number="3"
                title="Execute"
                description="Submit the proof to the contract anonymously."
              />
              <StepCard 
                number="4"
                title="Withdraw"
                description="Withdraw funds to a fresh address anytime."
              />
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl border border-stark-gray/10 bg-stark-dark hover:border-stark-blue/30 transition-colors">
      <div className="mb-4 p-3 bg-stark-darker rounded-xl w-fit border border-stark-gray/10">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-stark-gray leading-relaxed">
        {description}
      </p>
    </div>
  )
}

function StepCard({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <div className="w-24 h-24 rounded-full bg-stark-dark border border-stark-blue/30 flex items-center justify-center mb-6 relative z-10">
        <span className="text-3xl font-bold text-stark-blue">{number}</span>
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-stark-gray">
        {description}
      </p>
    </div>
  )
}
