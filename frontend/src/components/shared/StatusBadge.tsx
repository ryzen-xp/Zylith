import { cn } from "@/lib/utils"
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react"

export type Status = "pending" | "verifying" | "executing" | "success" | "error"

interface StatusBadgeProps {
  status: Status
  className?: string
  showLabel?: boolean
}

export function StatusBadge({ status, className, showLabel = true }: StatusBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      label: "Pending",
      color: "text-muted-foreground bg-muted/20 border-muted",
    },
    verifying: {
      icon: Loader2,
      label: "Verifying ZK Proof",
      color: "text-stark-purple bg-stark-purple/10 border-stark-purple/20",
      animate: true,
    },
    executing: {
      icon: Loader2,
      label: "Executing",
      color: "text-stark-blue bg-stark-blue/10 border-stark-blue/20",
      animate: true,
    },
    success: {
      icon: CheckCircle2,
      label: "Success",
      color: "text-stark-success bg-stark-success/10 border-stark-success/20",
    },
    error: {
      icon: XCircle,
      label: "Failed",
      color: "text-red-400 bg-red-950/20 border-red-900/50",
    },
  }

  const { icon: Icon, label, color, animate } = config[status]

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium",
      color,
      className
    )}>
      <Icon className={cn("h-3.5 w-3.5", animate && "animate-spin")} />
      {showLabel && <span>{label}</span>}
    </div>
  )
}

