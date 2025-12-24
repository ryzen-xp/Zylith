"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion } from "framer-motion"
import { StatusBadge, Status } from "@/components/shared/StatusBadge"
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"

const FLOW_STEPS = [
  { id: "action", label: "User Action", icon: Clock },
  { id: "asp", label: "ASP Request", icon: Loader2 },
  { id: "proof", label: "Proof Generation", icon: Loader2 },
  { id: "contract", label: "Contract Call", icon: Loader2 },
  { id: "verify", label: "Verification", icon: Loader2 },
  { id: "execute", label: "Execution", icon: CheckCircle2 },
]

export function TransactionFlow() {
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  const handleStart = () => {
    setCurrentStep(null)
    setCompletedSteps([])
    
    FLOW_STEPS.forEach((step, index) => {
      setTimeout(() => {
        setCurrentStep(step.id)
        setTimeout(() => {
          setCompletedSteps(prev => [...prev, step.id])
          if (index === FLOW_STEPS.length - 1) {
            setCurrentStep(null)
          }
        }, 1500)
      }, index * 2000)
    })
  }

  const getStatus = (stepId: string): Status => {
    if (completedSteps.includes(stepId)) return "success"
    if (currentStep === stepId) return "executing"
    return "pending"
  }

  return (
    <Card className="bg-stark-dark border-stark-gray/10">
      <CardHeader>
        <CardTitle>Transaction Flow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-stark-gray/20" />
          
          <div className="space-y-6">
            {FLOW_STEPS.map((step, index) => {
              const status = getStatus(step.id)
              const Icon = step.icon
              
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative flex items-start gap-4"
                >
                  <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                    status === "success"
                      ? "bg-stark-success/20 border-stark-success"
                      : status === "executing"
                        ? "bg-stark-blue/20 border-stark-blue animate-pulse"
                        : "bg-stark-darker border-stark-gray/20"
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      status === "success"
                        ? "text-stark-success"
                        : status === "executing"
                          ? "text-stark-blue animate-spin"
                          : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{step.label}</h3>
                      <StatusBadge status={status} showLabel={false} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {status === "success" && "Completed"}
                      {status === "executing" && "In progress..."}
                      {status === "pending" && "Waiting..."}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <button
            onClick={handleStart}
            className="w-full py-2 px-4 rounded-lg bg-stark-blue hover:bg-stark-blue/90 text-white font-medium transition-colors"
          >
            Simulate Transaction
          </button>
        </motion.div>
      </CardContent>
    </Card>
  )
}

