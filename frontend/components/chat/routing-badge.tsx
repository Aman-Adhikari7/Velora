"use client"

import { cn } from "@/lib/utils"
import { formatModel } from "@/lib/orchestrator-api"

interface RoutingBadgeProps {
  taskType: string
  modelUsed: string
  confidence?: number
}

const taskTypeConfig: Record<string, { label: string; color: string }> = {
  backend:     { label: "Claude · Backend",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  explanation: { label: "GPT · Orchestration", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  frontend:    { label: "Gemini · Frontend",  color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  full:        { label: "Claude + Gemini + GPT · Full Build", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
}

const modelConfig: Record<string, { color: string; icon: string }> = {
  "Claude":  { color: "text-blue-400",   icon: "◆" },
  "Gemini":  { color: "text-amber-400",  icon: "✦" },
  "GPT":     { color: "text-violet-400", icon: "⬡" },
}

export function RoutingBadge({ taskType, modelUsed, confidence }: RoutingBadgeProps) {
  const cfg = taskTypeConfig[taskType]
  const displayModel = formatModel(modelUsed)
  const modelCfg = modelConfig[displayModel]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        cfg?.color || "bg-muted text-muted-foreground border-border"
      )}>
        {cfg?.label || taskType}
      </span>
      {displayModel && (
        <span className={cn("text-xs font-mono font-semibold", modelCfg?.color || "text-muted-foreground")}>
          {modelCfg?.icon} {displayModel}
        </span>
      )}
      {confidence !== undefined && (
        <span className="text-xs text-muted-foreground/60">
          {(confidence * 100).toFixed(0)}% confidence
        </span>
      )}
    </div>
  )
}
