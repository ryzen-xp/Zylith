"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Loader2 } from "lucide-react"

const PROOF_STEPS = [
  { id: 1, label: "Input Note", description: "Secret, nullifier, amount" },
  { id: 2, label: "Merkle Path", description: "24 path elements" },
  { id: 3, label: "Witness Generation", description: "Circuit inputs" },
  { id: 4, label: "Proof Computation", description: "Groth16 proof" },
  { id: 5, label: "Format for Garaga", description: "BN254 format" },
]

export function ProofVisualizer() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setCurrentStep(0)
    
    for (let i = 0; i < PROOF_STEPS.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCurrentStep(i + 1)
    }
    
    setIsGenerating(false)
  }

  return (
    <Card className="bg-stark-dark border-stark-gray/10">
      <CardHeader>
        <CardTitle>ZK Proof Generation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {PROOF_STEPS.map((step, index) => {
            const isActive = index === currentStep - 1
            const isComplete = index < currentStep
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ 
                  opacity: isActive || isComplete ? 1 : 0.5,
                  x: 0
                }}
                className="flex items-center gap-4 p-4 rounded-lg bg-stark-darker border border-stark-gray/10"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  isComplete 
                    ? "border-stark-success bg-stark-success/20" 
                    : isActive
                      ? "border-stark-blue bg-stark-blue/20"
                      : "border-muted-foreground/30"
                }`}>
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-stark-success" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 text-stark-blue animate-spin" />
                  ) : (
                    <span className="text-sm">{step.id}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-stark-blue hover:bg-stark-blue/90"
        >
          {isGenerating ? "Generating Proof..." : "Generate Demo Proof"}
        </Button>
      </CardContent>
    </Card>
  )
}

