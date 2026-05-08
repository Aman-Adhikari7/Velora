"use client"

import { TrendingDown, RefreshCcw, Zap, BarChart3, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsData {
  total_prompts: number
  claude_calls: number
  gpt_calls: number
  frontend_calls: number
  tokens_saved: number
  estimated_cost_saved: string
  prompt_reduction_pct?: number
  context_reuse_pct?: number
  api_calls_saved?: number
}

interface StatsPanelProps {
  stats: StatsData | null
}

const modelLabels = [
  { key: "claude_calls",   label: "Claude · Backend",  color: "bg-blue-500" },
  { key: "gpt_calls",      label: "GPT · Orchestration",   color: "bg-violet-500" },
  { key: "frontend_calls", label: "Gemini · Frontend",  color: "bg-amber-500" },
]

export function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) {
    return (
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Efficiency Metrics</h3>
        </div>
        <p className="text-xs text-muted-foreground/60">Complete a prompt to see efficiency data.</p>
      </div>
    )
  }

  const total = stats.claude_calls + stats.gpt_calls + stats.frontend_calls || 1

  const efficiencyMetrics = [
    {
      icon: TrendingDown,
      label: "Prompt Reduction",
      value: `${stats.prompt_reduction_pct ?? 0}%`,
      sub: "vs. naive approach",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      icon: RefreshCcw,
      label: "Context Reuse",
      value: `${stats.context_reuse_pct ?? 0}%`,
      sub: "shared memory",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: Zap,
      label: "API Calls Saved",
      value: `${stats.api_calls_saved ?? 0}`,
      sub: "via smart routing",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ]

  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Efficiency Metrics</h3>
      </div>

      <div className="space-y-4">
        {/* Prompts count */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{stats.total_prompts}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">total prompts</p>
          </div>
        </div>

        {/* Model distribution */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">AI Agent Usage</p>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex">
            {modelLabels.map(m => {
              const count = stats[m.key as keyof StatsData] as number
              const pct = (count / total) * 100
              return pct > 0 ? (
                <div key={m.key} className={cn("h-full transition-all duration-700", m.color)} style={{ width: `${pct}%` }} />
              ) : null
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {modelLabels.map(m => (
              <span key={m.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={cn("w-1.5 h-1.5 rounded-full", m.color)} />
                {m.label} ({stats[m.key as keyof StatsData] as number})
              </span>
            ))}
          </div>
        </div>

        {/* Efficiency metrics */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Savings vs. Naive AI</p>
          <div className="space-y-2">
            {efficiencyMetrics.map((metric) => {
              const Icon = metric.icon
              return (
                <div key={metric.label} className={cn("flex items-center gap-2.5 p-2 rounded-lg", metric.bg)}>
                  <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", metric.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">{metric.label}</p>
                    <p className="text-[10px] text-muted-foreground/60">{metric.sub}</p>
                  </div>
                  <span className={cn("text-sm font-bold", metric.color)}>{metric.value}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tokens saved */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div>
            <p className="text-[10px] text-muted-foreground">Tokens saved</p>
            <p className="text-sm font-semibold">{stats.tokens_saved.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Est. cost saved</p>
            <p className="text-sm font-semibold text-emerald-400">{stats.estimated_cost_saved}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
