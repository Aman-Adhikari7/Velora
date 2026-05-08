"use client"

import { LogsSummaryResponse } from "@/lib/orchestrator-api"
import { ScrollText, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LogsPanelProps {
  logs: LogsSummaryResponse | null
  onRefresh: () => void
  isRefreshing?: boolean
}

const taskTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  backend:     { label: "Backend Dev",     color: "text-blue-400",    bg: "bg-blue-500/15" },
  explanation: { label: "Explanation",     color: "text-emerald-400", bg: "bg-emerald-500/15" },
  frontend:    { label: "UI Generation",   color: "text-amber-400",   bg: "bg-amber-500/15" },
  full:        { label: "Full Stack",      color: "text-violet-400",  bg: "bg-violet-500/15" },
}

export function LogsPanel({ logs, onRefresh, isRefreshing }: LogsPanelProps) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Session Logs</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {logs ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{logs.date}</span>
            <span className="text-emerald-400 font-medium">{logs.success_rate} success</span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total requests</span>
            <span className="font-medium text-foreground">{logs.total_requests}</span>
          </div>

          {/* Task breakdown */}
          {Object.keys(logs.task_breakdown).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Task Breakdown</p>
              {Object.entries(logs.task_breakdown).map(([task, count]) => {
                const cfg = taskTypeConfig[task]
                return (
                  <div key={task} className="flex items-center justify-between">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium", cfg?.bg || "bg-muted", cfg?.color || "text-muted-foreground")}>
                      {cfg?.label || task}
                    </span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tokens saved</span>
              <span className="font-medium text-foreground">{logs.total_tokens_saved.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/60">No session logs yet.</p>
      )}
    </div>
  )
}
