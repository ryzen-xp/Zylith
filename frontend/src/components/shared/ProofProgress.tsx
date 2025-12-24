"use client"

import { motion } from "framer-motion"
import { Check, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type ProofStep = 
  | "fetching_merkle" 
  | "generating_witness" 
  | "computing_proof" 
  | "formatting" 
  | "verifying" 
  | "complete" 
  | "error"

interface ProofProgressProps {
  currentStep: ProofStep
  steps?: { id: ProofStep; label: string }[]
  error?: string
  onCancel?: () => void
}

const DEFAULT_STEPS: { id: ProofStep; label: string; estimatedTime?: number }[] = [
  { id: "fetching_merkle", label: "Fetching Merkle Proof", estimatedTime: 1 },
  { id: "generating_witness", label: "Generating Witness", estimatedTime: 2 },
  { id: "computing_proof", label: "Computing Zero-Knowledge Proof", estimatedTime: 10 },
  { id: "formatting", label: "Formatting for Verifier", estimatedTime: 1 },
]

// Estimated total time in seconds
const ESTIMATED_TOTAL_TIME = DEFAULT_STEPS.reduce((sum, step) => sum + (step.estimatedTime || 0), 0)

export function ProofProgress({ 
  currentStep, 
  steps = DEFAULT_STEPS, 
  error,
  onCancel 
}: ProofProgressProps) {
  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  const isComplete = currentStep === "complete" || currentStep === "verifying"
  const isError = currentStep === "error"
  
  // Calculate estimated remaining time
  const completedSteps = currentStepIndex >= 0 ? currentStepIndex : 0
  const remainingSteps = steps.length - completedSteps
  const estimatedRemaining = steps
    .slice(completedSteps)
    .reduce((sum, step) => sum + (step.estimatedTime || 0), 0)

  return (
    <div className="w-full space-y-4 p-4 rounded-lg bg-stark-darker/50 border border-stark-blue/10">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Generating Private Proof</h3>
          {!isComplete && !isError && estimatedRemaining > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Estimated time: ~{estimatedRemaining}s
            </p>
          )}
        </div>
        {onCancel && !isComplete && !isError && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCancel}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-white"
          >
            Cancel
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => {
          let status: "pending" | "current" | "complete" | "error" = "pending"
          
          if (isError && index === currentStepIndex) status = "error" // Need to handle error index logic better if passed differently
          else if (isComplete) status = "complete"
          else if (currentStep === step.id) status = "current"
          else if (index < currentStepIndex || currentStepIndex === -1) status = "complete" // If verifying/complete not in list, assume all complete
          
          // Refine status logic:
          if (isError) {
             // If error, previous steps complete, current one error? 
             // We don't know exactly which step failed unless passed.
             // Simplification: if error, show error message below.
             status = "pending" // Placeholder
          }
          
          // Better logic:
          const isStepComplete = isComplete || (currentStepIndex > index && currentStepIndex !== -1)
          const isStepCurrent = currentStep === step.id
          
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] transition-colors",
                isStepComplete 
                  ? "border-stark-success bg-stark-success/20 text-stark-success"
                  : isStepCurrent
                    ? "border-stark-blue bg-stark-blue/20 text-stark-blue animate-pulse"
                    : "border-muted-foreground/30 text-muted-foreground"
              )}>
                {isStepComplete ? (
                  <Check className="h-3 w-3" />
                ) : isStepCurrent ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className={cn(
                "text-sm transition-colors",
                isStepComplete ? "text-white" : isStepCurrent ? "text-stark-blue font-medium" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {isError && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/20 p-2 rounded">
          <X className="h-4 w-4" />
          <span>{error || "An error occurred during proof generation"}</span>
        </div>
      )}
    </div>
  )
}

