"use client"

import { MemoryData, LogsSummaryResponse, WorkflowStage, ChatHistoryPrompt } from "@/lib/orchestrator-api"
import { MemoryPanel } from "./memory-panel"
import { StatsPanel } from "./stats-panel"
import { LogsPanel } from "./logs-panel"
import { WorkflowTimeline } from "./workflow-timeline"
import { ProjectMemoryDemo } from "./project-memory-demo"

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

interface AppSidebarProps {
  userId: string
  memory: MemoryData | null
  stats: StatsData | null
  logs: LogsSummaryResponse | null
  workflowStages: WorkflowStage[]
  isOrchestrating?: boolean
  chatHistory: ChatHistoryPrompt[]
  projectGoal: string
  onRefreshMemory: () => void
  onRefreshLogs: () => void
  onRefreshHistory: () => void
  isRefreshingMemory?: boolean
  isRefreshingLogs?: boolean
  isRefreshingHistory?: boolean
}

export function AppSidebar({
  userId,
  memory,
  stats,
  logs,
  workflowStages,
  isOrchestrating,
  chatHistory,
  projectGoal,
  onRefreshMemory,
  onRefreshLogs,
  onRefreshHistory,
  isRefreshingMemory,
  isRefreshingLogs,
  isRefreshingHistory,
}: AppSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-background border-l border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4 pb-4">
          <WorkflowTimeline stages={workflowStages} isLoading={isOrchestrating} />
          <ProjectMemoryDemo
            memory={memory}
            chatHistory={chatHistory}
            projectGoal={projectGoal}
            userId={userId}
            onRefresh={onRefreshHistory}
            isRefreshing={isRefreshingHistory}
          />
          <MemoryPanel memory={memory} onRefresh={onRefreshMemory} isRefreshing={isRefreshingMemory} />
          <StatsPanel stats={stats} />
          <LogsPanel logs={logs} onRefresh={onRefreshLogs} isRefreshing={isRefreshingLogs} />
        </div>
      </div>
    </div>
  )
}
