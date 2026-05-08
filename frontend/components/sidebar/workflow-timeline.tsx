"use client"

import { useEffect, useState } from "react"
import { WorkflowStage } from "@/lib/orchestrator-api"
import {
  GitBranch,
  CheckCircle2,
  Circle,
  AlertCircle,
  SkipForward,
  Loader2,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkflowTimelineProps {
  stages: WorkflowStage[]
  isLoading?: boolean
}

const agentColors: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  // 3-model system
  "GPT":            { dot: "bg-violet-500", text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  "Claude":         { dot: "bg-blue-500",   text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  "Gemini":         { dot: "bg-amber-500",  text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  // Legacy fallbacks
  "GPT-4":          { dot: "bg-violet-500", text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  "Frontend AI":    { dot: "bg-amber-500",  text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  "Velora Router":  { dot: "bg-violet-500", text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  "Velora Memory":  { dot: "bg-pink-500",   text: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/20" },
  "Filesystem":     { dot: "bg-slate-500",  text: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/20" },
}

function normalizeAgent(agent: string): string {
  if (agent === "Stitch" || agent === "Frontend AI") return "Gemini"
  if (agent === "GPT-4") return "GPT"
  if (agent === "Velora Router") return "GPT"
  return agent
}

function normalizeLabel(label: string): string {
  return label
    .replace(/\[Stitch\]/g, "[ GEMINI ]")
    .replace(/\[Frontend AI\]/g, "[ GEMINI ]")
    .replace(/\[GPT-4\]/g, "[ GPT ]")
    .replace(/\[Claude\]/g, "[ CLAUDE ]")
    .replace(/\[Planner\]/g, "[ GPT ORCHESTRATOR ]")
    .replace(/\[Router\]/g, "[ GPT ORCHESTRATOR ]")
}

const DEFAULT_STAGES: WorkflowStage[] = [
  { name: "[ GPT ORCHESTRATOR ]",   agent: "GPT",    status: "pending", label: "[ GPT ] Analyzing request → Planning architecture..." },
  { name: "Backend Generation",     agent: "Claude", status: "pending", label: "[ CLAUDE ] Backend engineering → APIs, DB, Auth..." },
  { name: "Frontend Generation",    agent: "Gemini", status: "pending", label: "[ GEMINI ] Frontend engineering → UI, Components, Design..." },
  { name: "Explanation Generation", agent: "GPT",    status: "pending", label: "[ GPT ] Orchestration → Architecture analysis, Deployment..." },
  { name: "Memory Update",          agent: "Velora Memory", status: "pending", label: "[ MEMORY ] Persisting project context..." },
]

function StageIcon({ status, isMemory }: { status: string; isMemory: boolean }) {
  if (status === "complete" && isMemory) return <span className="w-2 h-2 rounded-full bg-pink-500" />
  if (status === "complete") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (status === "error")    return <AlertCircle  className="h-3.5 w-3.5 text-destructive" />
  if (status === "skipped")  return <SkipForward  className="h-3.5 w-3.5 text-muted-foreground/30" />
  if (status === "running")  return <Loader2      className="h-3.5 w-3.5 text-primary animate-spin" />
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/15" />
}

export function WorkflowTimeline({ stages, isLoading }: WorkflowTimelineProps) {
  const [visibleStages, setVisibleStages] = useState<WorkflowStage[]>([])

  useEffect(() => {
    if (isLoading && stages.length === 0) {
      setVisibleStages(DEFAULT_STAGES)
      return
    }
    if (stages.length > 0) {
      stages.forEach((stage, i) => {
        setTimeout(() => {
          setVisibleStages(prev => {
            const next = [...prev]
            next[i] = stage
            return next
          })
        }, i * 120)
      })
    }
    if (!isLoading && stages.length === 0) {
      setVisibleStages([])
    }
  }, [stages, isLoading])

  const displayStages = visibleStages.length > 0 ? visibleStages : (isLoading ? DEFAULT_STAGES : [])
  const normalizedStages = displayStages.map(s => ({
    ...s,
    agent: normalizeAgent(s.agent),
    label: normalizeLabel(s.label),
  }))

  const completedCount = normalizedStages.filter(s => s.status === "complete").length
  const runningStage = normalizedStages.find(s => s.status === "running")

  if (!isLoading && displayStages.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Live Workflow</h3>
        </div>
        <div className="py-3 text-center">
          <p className="text-xs text-muted-foreground/40">Send a prompt to see the orchestration pipeline.</p>
          <div className="flex justify-center gap-1.5 mt-3">
            {["bg-violet-500","bg-blue-500","bg-amber-500","bg-emerald-500","bg-pink-500"].map((c,i) => (
              <span key={i} className={cn("w-1.5 h-1.5 rounded-full opacity-25", c)} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <GitBranch className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Live Workflow</h3>

        {isLoading && runningStage && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px]">
            <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", agentColors[runningStage.agent]?.dot || "bg-primary")} />
            <span className={agentColors[runningStage.agent]?.text || "text-primary"}>{runningStage.agent}</span>
          </span>
        )}
        {isLoading && !runningStage && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Orchestrating
          </span>
        )}
        {!isLoading && normalizedStages.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
            <Zap className="h-3 w-3" />
            {completedCount}/{normalizedStages.length} complete
          </span>
        )}
      </div>

      {isLoading && runningStage && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 border-b text-xs font-medium",
          agentColors[runningStage.agent]?.bg || "bg-primary/5",
          agentColors[runningStage.agent]?.border || "border-primary/20",
        )}>
          <Loader2 className={cn("h-3.5 w-3.5 animate-spin", agentColors[runningStage.agent]?.text)} />
          <span className={agentColors[runningStage.agent]?.text}>{runningStage.agent} running...</span>
        </div>
      )}

      <div className="p-4 space-y-0">
        {normalizedStages.map((stage, idx) => {
          const colors = agentColors[stage.agent] || { dot: "bg-muted", text: "text-muted-foreground", bg: "bg-muted/20", border: "border-border" }
          const isLast = idx === normalizedStages.length - 1
          const isPending = stage.status === "pending"
          const isMemory = stage.agent === "Velora Memory"
          const isRunning = stage.status === "running"

          return (
            <div key={`${stage.name}-${idx}`} className="flex gap-3 animate-in fade-in duration-300" style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500",
                  isRunning                               ? "bg-primary/15 ring-2 ring-primary/30 ring-offset-1 ring-offset-card" :
                  stage.status === "complete" && !isMemory ? "bg-emerald-500/15" :
                  stage.status === "complete" && isMemory  ? "bg-pink-500/15" :
                  stage.status === "skipped"               ? "bg-muted/20" :
                  stage.status === "error"                 ? "bg-destructive/15" :
                  "bg-muted/10"
                )}>
                  <StageIcon status={stage.status} isMemory={isMemory} />
                </div>
                {!isLast && (
                  <div className={cn(
                    "w-px flex-1 min-h-[18px] mt-1 mb-1 transition-all duration-700",
                    stage.status === "complete" ? "bg-emerald-500/25" : "bg-border/30"
                  )} />
                )}
              </div>

              <div className={cn("flex-1 pb-2.5", isLast && "pb-0")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className={cn("text-xs font-medium", isPending ? "text-muted-foreground/35" : "text-foreground")}>
                        {stage.name}
                      </span>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded font-medium",
                        isPending ? "bg-muted/20 text-muted-foreground/30" : cn(colors.bg, colors.text)
                      )}>
                        {stage.agent}
                      </span>
                    </div>
                    <p className={cn(
                      "text-[10px] leading-snug font-mono transition-opacity duration-300",
                      isPending ? "text-muted-foreground/20" : "text-muted-foreground/65"
                    )}>
                      {stage.label}
                    </p>

                    {stage.agent === "Velora Router" && stage.status === "complete" && (
                      <div className={cn(
                        "flex items-center gap-1.5 mt-1 px-2 py-1 rounded-md text-[10px] font-mono",
                        stage.label.includes("Memory Loaded")
                          ? "bg-violet-500/10 border border-violet-500/20 text-violet-400"
                          : "bg-secondary/40 border border-border/30 text-muted-foreground/60"
                      )}>
                        {stage.label.includes("Memory Loaded")
                          ? <><span className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" /> Context loaded</>
                          : <><span className="w-1 h-1 rounded-full bg-primary/60" /> Analyzing prompt</>
                        }
                      </div>
                    )}
                  </div>

                  {stage.elapsed_ms && stage.elapsed_ms > 0 && (
                    <span className="text-[9px] text-muted-foreground/35 flex-shrink-0 mt-0.5">
                      {stage.elapsed_ms.toFixed(0)}ms
                    </span>
                  )}
                </div>

                {isRunning && (
                  <div className="mt-1.5 h-0.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full opacity-60 animate-pulse", colors.dot)} style={{ width: "65%" }} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
