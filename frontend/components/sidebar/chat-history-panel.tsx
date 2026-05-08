"use client"

import { useState, useEffect } from "react"
import { ChatHistoryPrompt, formatRelativeTime, formatModel } from "@/lib/orchestrator-api"
import { History, Code2, Layout, MessageSquare, GitBranch, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatHistoryPanelProps {
  userId: string
  prompts: ChatHistoryPrompt[]
  projectGoal: string
  onRefresh: () => void
  isRefreshing?: boolean
}

const taskConfig: Record<string, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  agentLabel: string
}> = {
  backend: {
    label: "Backend",
    icon: Code2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    agentLabel: "Claude (Backend)",
  },
  frontend: {
    label: "Frontend",
    icon: Layout,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    agentLabel: "Frontend AI Agent",
  },
  explanation: {
    label: "Explanation",
    icon: MessageSquare,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    agentLabel: "GPT-4 (Explanation)",
  },
  full: {
    label: "Full Stack",
    icon: GitBranch,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    agentLabel: "Claude + Frontend AI + GPT-4",
  },
}

function ModelTags({ modelUsed, taskType }: { modelUsed: string; taskType: string }) {
  const cfg = taskConfig[taskType]
  if (!cfg) return null

  // For full-stack, show individual agent tags
  if (taskType === "full") {
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {["Claude (Backend)", "Frontend AI Agent", "GPT-4 (Explanation)"].map(label => (
          <span key={label} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary border border-border/50 text-muted-foreground font-mono">
            {label}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-mono font-medium", cfg.bg, cfg.color)}>
        {cfg.agentLabel}
      </span>
    </div>
  )
}

export function ChatHistoryPanel({
  userId,
  prompts,
  projectGoal,
  onRefresh,
  isRefreshing,
}: ChatHistoryPanelProps) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Prompt History</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {prompts.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground/50 text-center py-3">
            No history yet.<br />Prompts appear here after each run.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {projectGoal && (
            <div className="px-2 py-1.5 rounded-lg bg-secondary/30 border border-border/30 mb-3">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Project</p>
              <p className="text-xs font-medium text-foreground truncate">{projectGoal}</p>
            </div>
          )}
          {prompts.map((prompt) => {
            const cfg = taskConfig[prompt.task_type] || taskConfig.explanation
            const Icon = cfg.icon
            return (
              <div
                key={prompt.id}
                className="p-2.5 rounded-lg border border-border/30 bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-default"
              >
                <div className="flex items-start gap-2">
                  <div className={cn("mt-0.5 p-1 rounded", cfg.bg)}>
                    <Icon className={cn("h-3 w-3", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug line-clamp-2">
                      {prompt.content}
                    </p>
                    <ModelTags modelUsed={prompt.model_used} taskType={prompt.task_type} />
                    <p className="text-[10px] text-muted-foreground/40 mt-1.5">
                      {formatRelativeTime(prompt.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
