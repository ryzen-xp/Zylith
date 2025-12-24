"use client"

import { Shield, Lock } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"

interface PrivacyShieldProps {
  active?: boolean
  className?: string
}

export function PrivacyShield({ active = true, className }: PrivacyShieldProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div 
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-help",
              active 
                ? "bg-stark-purple/10 border-stark-purple/30 text-stark-purple" 
                : "bg-muted border-transparent text-muted-foreground",
              className
            )}
            initial={false}
            animate={{
              scale: active ? [1, 1.05, 1] : 1,
              borderColor: active ? "rgba(123, 97, 255, 0.3)" : "transparent"
            }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative">
              <Shield className="h-4 w-4" />
              {active && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-1 -right-1 bg-stark-dark rounded-full p-[1px]"
                >
                  <Lock className="h-2 w-2 text-stark-purple" />
                </motion.div>
              )}
            </div>
            <span className="text-xs font-medium">
              {active ? "Private" : "Public"}
            </span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent className="bg-stark-dark border-stark-purple/20 text-white max-w-xs">
          <p className="font-semibold mb-1">Shielded Transaction</p>
          <p className="text-xs text-stark-gray">
            Your transaction amount, routing, and balance are cryptographically hidden using ZK proofs.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

