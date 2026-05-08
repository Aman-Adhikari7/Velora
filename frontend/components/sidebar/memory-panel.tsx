"use client"

import { useState } from "react"
import { MemoryData, formatRelativeTime } from "@/lib/orchestrator-api"
import { Brain, CheckCircle2, Circle, ChevronDown, ChevronUp, RefreshCw, Target, Code2, Layout, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MemoryPanelProps {
  memory: MemoryData | null
  onRefresh: () => void
  isRefreshing?: boolean
}

const contextConfig = [
  { key: "backend",     label: "Backend Generated",     snippet: "backend_snippet",     has: "has_backend",     icon: Code2,         color: "text-blue-400",    activeBg: "bg-blue-500/10" },
  { key: "frontend",    label: "Frontend Generated",    snippet: "frontend_snippet",    has: "has_frontend",    icon: Layout,        color: "text-amber-400",   activeBg: "bg-amber-500/10" },
  { key: "explanation", label: "Explanation Generated", snippet: "explanation_snippet", has: "has_explanation", icon: MessageSquare, color: "text-emerald-400", activeBg: "bg-emerald-500/10" },
] as const

export function MemoryPanel({ memory, onRefresh, isRefreshing }: MemoryPanelProps) {
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>(null)

  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Unified Project Memory</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {memory ? (
        <div className="space-y-3">
          {/* Project Goal */}
          <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-3 w-3 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Project Goal</span>
            </div>
            <p className="text-xs font-medium text-foreground leading-snug">
              {memory.project_goal || "Waiting for first prompt..."}
            </p>
          </div>

          {/* Context Items */}
          <div className="space-y-1.5">
            {contextConfig.map((item) => {
              const hasData = memory.context[item.has as keyof typeof memory.context] as boolean
              const snippet = memory.context[item.snippet as keyof typeof memory.context] as string
              const Icon = item.icon
              const isExpanded = expandedSnippet === item.key

              return (
                <div key={item.key}>
                  <button
                    onClick={() => setExpandedSnippet(isExpanded ? null : item.key)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-lg transition-all duration-200 text-left",
                      hasData ? cn("hover:bg-secondary/50", item.activeBg) : "opacity-50 cursor-default"
                    )}
                    disabled={!hasData}
                  >
                    <div className="flex items-center gap-2">
                      {hasData ? (
                        <CheckCircle2 className={cn("h-3.5 w-3.5", item.color)} />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />
                      )}
                      <Icon className={cn("h-3 w-3", hasData ? item.color : "text-muted-foreground/30")} />
                      <span className={cn("text-xs", hasData ? "text-foreground" : "text-muted-foreground/50")}>
                        {item.label}
                      </span>
                    </div>
                    {hasData && snippet && (
                      isExpanded
                        ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                        : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && snippet && (
                    <div className="mt-1 mx-1 p-2 rounded-md bg-secondary/50 text-[10px] font-mono text-muted-foreground overflow-x-auto leading-relaxed border border-border/30">
                      {snippet.slice(0, 250)}…
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {memory.updated_at && (
            <p className="text-[10px] text-muted-foreground/50 text-right">
              Updated {formatRelativeTime(memory.updated_at)}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg bg-secondary/20 border border-dashed border-border/30">
            <p className="text-xs text-muted-foreground/60 text-center">
              No project memory yet.<br />Send a prompt to begin.
            </p>
          </div>
          {contextConfig.map(item => (
            <div key={item.key} className="flex items-center gap-2 px-2 py-1 opacity-30">
              <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />
              <span className="text-xs text-muted-foreground/50">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
