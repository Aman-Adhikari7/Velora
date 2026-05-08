"use client"

import { useState } from "react"
import {
  MemoryData,
  ChatHistoryPrompt,
  formatRelativeTime,
} from "@/lib/orchestrator-api"
import {
  BookOpen,
  Clock,
  Code2,
  Layout,
  MessageSquare,
  GitBranch,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ProjectMemoryDemoProps {
  memory: MemoryData | null
  chatHistory: ChatHistoryPrompt[]
  projectGoal: string
  userId: string
  onRefresh: () => void
  isRefreshing?: boolean
}

const taskConfig: Record<string, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  agents: string[]
}> = {
  backend: {
    label: "Backend",
    icon: Code2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    agents: ["Claude"],
  },
  frontend: {
    label: "Frontend AI",
    icon: Layout,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    agents: ["Frontend AI Agent"],
  },
  explanation: {
    label: "Explanation",
    icon: MessageSquare,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    agents: ["GPT-4"],
  },
  full: {
    label: "Full Stack",
    icon: GitBranch,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    agents: ["Claude", "Frontend AI Agent", "GPT-4"],
  },
}

function MemoryStatusDots({ memory }: { memory: MemoryData | null }) {
  const items = [
    { key: "backend", label: "Backend", icon: Code2, color: "bg-blue-500", active: memory?.context.has_backend },
    { key: "frontend", label: "Frontend", icon: Layout, color: "bg-amber-500", active: memory?.context.has_frontend },
    { key: "explanation", label: "Explanation", icon: MessageSquare, color: "bg-emerald-500", active: memory?.context.has_explanation },
  ]

  return (
    <div className="flex gap-2">
      {items.map(item => (
        <div key={item.key} className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
          item.active
            ? "bg-secondary/60 text-foreground"
            : "bg-secondary/20 text-muted-foreground/40"
        )}>
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            item.active ? item.color : "bg-muted-foreground/20"
          )} />
          {item.label}
        </div>
      ))}
    </div>
  )
}

export function ProjectMemoryDemo({
  memory,
  chatHistory,
  projectGoal,
  userId,
  onRefresh,
  isRefreshing,
}: ProjectMemoryDemoProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const modelsUsed = Array.from(
    new Set(chatHistory.map(p => {
      const cfg = taskConfig[p.task_type]
      return cfg ? cfg.agents : ["GPT-4"]
    }).flat())
  )

  const hasHistory = chatHistory.length > 0
  const hasMemory = !!memory?.project_goal

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/20">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Project Memory</h3>
          {hasMemory && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] text-primary font-medium">
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              Active
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Project goal */}
        <div className={cn(
          "p-3 rounded-xl border transition-all",
          hasMemory
            ? "border-primary/20 bg-primary/5"
            : "border-dashed border-border/30 bg-secondary/10"
        )}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3 w-3 text-primary/70" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Current Project
            </span>
          </div>
          <p className="text-xs font-medium text-foreground leading-snug">
            {projectGoal || "No project started yet. Send a prompt to begin."}
          </p>

          {hasMemory && (
            <div className="mt-2.5">
              <MemoryStatusDots memory={memory} />
            </div>
          )}
        </div>

        {/* Models used summary */}
        {modelsUsed.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                Models Used
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {modelsUsed.map(model => {
                const colors: Record<string, string> = {
                  "Claude": "bg-blue-500/15 text-blue-400 border-blue-500/20",
                  "Frontend AI Agent": "bg-amber-500/15 text-amber-400 border-amber-500/20",
                  "GPT-4": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
                }
                return (
                  <span
                    key={model}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md border font-mono font-medium",
                      colors[model] || "bg-secondary text-muted-foreground border-border"
                    )}
                  >
                    {model}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Chat history list */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                Previous Prompts
              </span>
            </div>
            {hasHistory && (
              <span className="text-[10px] text-muted-foreground/40 font-mono">
                {chatHistory.length} total
              </span>
            )}
          </div>

          {!hasHistory ? (
            <div className="py-3 text-center">
              <p className="text-xs text-muted-foreground/40">
                Chat history appears here after each run.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
              {chatHistory.map((prompt, idx) => {
                const cfg = taskConfig[prompt.task_type] || taskConfig.explanation
                const Icon = cfg.icon
                const isExpanded = expandedIdx === idx

                return (
                  <div
                    key={prompt.id}
                    className={cn(
                      "rounded-lg border overflow-hidden transition-all cursor-pointer",
                      cfg.border,
                      isExpanded ? cfg.bg : "border-border/30 bg-secondary/10 hover:bg-secondary/30"
                    )}
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  >
                    <div className="flex items-start gap-2 p-2.5">
                      <div className={cn("p-1 rounded flex-shrink-0 mt-0.5", cfg.bg)}>
                        <Icon className={cn("h-3 w-3", cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-snug line-clamp-2">
                          {prompt.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-mono font-medium",
                            cfg.bg, cfg.color
                          )}>
                            {cfg.agents.join(" + ")}
                          </span>
                          <span className="text-[9px] text-muted-foreground/40 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatRelativeTime(prompt.timestamp)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {isExpanded
                          ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                        }
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-border/20">
                        <div className="space-y-1 pt-2">
                          <p className="text-[10px] text-muted-foreground/60 font-mono">
                            Task type: <span className={cfg.color}>{prompt.task_type}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 font-mono">
                            Models: <span className="text-foreground/70">{cfg.agents.join(", ")}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 font-mono">
                            Workspace: <span className="text-foreground/70">{userId}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
