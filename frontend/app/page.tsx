"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Header } from "@/components/header"
import { ChatPanel } from "@/components/chat/chat-panel"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { LoginScreen } from "@/components/login-screen"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import {
  Message,
  MemoryData,
  LogsSummaryResponse,
  WorkflowStage,
  ResponseSection,
  ChatHistoryPrompt,
  runPromptStreaming,
  getMemory,
  getStats,
  resetMemory,
  getLogsSummary,
  getChatHistory,
} from "@/lib/orchestrator-api"
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

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [userId, setUserId] = useState("default_user")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [memory, setMemory] = useState<MemoryData | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [logs, setLogs] = useState<LogsSummaryResponse | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isRefreshingMemory, setIsRefreshingMemory] = useState(false)
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false)
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>([])
  const [isOrchestrating, setIsOrchestrating] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatHistoryPrompt[]>([])
  const [projectGoal, setProjectGoal] = useState("")

  // Track the active stream so we can cancel it
  const activeStreamRef = useRef<AbortController | null>(null)
  // Track in-progress assistant message id
  const inProgressMsgIdRef = useRef<number | null>(null)

  const fetchMemoryAndStats = useCallback(async () => {
    try {
      const [memoryRes, statsRes] = await Promise.all([getMemory(userId), getStats(userId)])
      if (memoryRes.success && memoryRes.data) setMemory(memoryRes.data)
      if (statsRes.success && statsRes.stats) setStats(statsRes.stats)
    } catch (error) {
      console.error("[Velora] Error fetching memory/stats:", error)
    }
  }, [userId])

  const fetchLogs = useCallback(async () => {
    try {
      const logsRes = await getLogsSummary()
      setLogs(logsRes)
    } catch (error) {
      console.error("[Velora] Error fetching logs:", error)
    }
  }, [])

  const fetchChatHistory = useCallback(async () => {
    try {
      const res = await getChatHistory(userId)
      if (res.success) {
        setChatHistory(res.prompts)
        if (res.project_goal) setProjectGoal(res.project_goal)
      }
    } catch (error) {
      console.error("[Velora] Error fetching chat history:", error)
    }
  }, [userId])

  useEffect(() => {
    if (!loggedIn) return
    fetchMemoryAndStats()
    fetchLogs()
    fetchChatHistory()
  }, [loggedIn, fetchMemoryAndStats, fetchLogs, fetchChatHistory])

  useEffect(() => {
    if (!loggedIn) return
    const interval = setInterval(fetchLogs, 30000)
    return () => clearInterval(interval)
  }, [loggedIn, fetchLogs])

  const handleLogin = (id: string) => {
    setUserId(id)
    setLoggedIn(true)
  }

  const handleUserIdChange = (newUserId: string) => {
    // Cancel any active stream
    activeStreamRef.current?.abort()
    setUserId(newUserId)
    setMessages([])
    setMemory(null)
    setStats(null)
    setWorkflowStages([])
    setChatHistory([])
    setProjectGoal("")
  }

  const handleReset = async () => {
    setIsResetting(true)
    try {
      const res = await resetMemory(userId)
      if (res.success) {
        setMessages([])
        setMemory(null)
        setStats(null)
        setWorkflowStages([])
        setChatHistory([])
        setProjectGoal("")
        toast.success("Memory cleared. Velora starts fresh!")
      } else {
        toast.error("Failed to reset memory")
      }
    } catch {
      toast.error("Connection failed — is the server running?")
    } finally {
      setIsResetting(false)
    }
  }

  const handleSendMessage = async (prompt: string) => {
    // Cancel any existing stream
    activeStreamRef.current?.abort()

    // Add user message
    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setIsOrchestrating(true)
    setWorkflowStages([])

    // Create a placeholder assistant message that we'll update as sections arrive
    const assistantId = Date.now() + 1
    inProgressMsgIdRef.current = assistantId
    const placeholderMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      workflow_stages: [],
      sections: [],
    }
    setMessages((prev) => [...prev, placeholderMsg])

    // Accumulate live sections and stages
    const liveSections: ResponseSection[] = []
    const liveStages: WorkflowStage[] = []

    const controller = runPromptStreaming(prompt, userId, {
      onStageUpdate: (stage) => {
        // Upsert stage by name in liveStages
        const idx = liveStages.findIndex(s => s.name === stage.name)
        if (idx >= 0) {
          liveStages[idx] = stage
        } else {
          liveStages.push(stage)
        }
        // Update the sidebar workflow timeline live
        setWorkflowStages([...liveStages])
        // Also update the in-progress message's stages
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, workflow_stages: [...liveStages] }
            : m
        ))
      },

      onSectionDone: (section) => {
        liveSections.push(section)
        // Append the new section to the in-progress message — shows output as it arrives
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                sections: [...liveSections],
                // Build combined content from all sections so far
                content: liveSections.map(s =>
                  `── ${s.title.toUpperCase()} (${s.model_used}) ──\n${s.content}`
                ).join("\n\n"),
                task_type: section.task_type,
                model_used: section.model_used,
              }
            : m
        ))
      },

      onComplete: (result) => {
        setIsLoading(false)
        setIsOrchestrating(false)
        if (result.project_goal) setProjectGoal(result.project_goal)

        // Update the assistant message with the final complete result
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content: result.output || m.content,
                task_type: result.task_type,
                model_used: result.model_used,
                confidence: result.confidence,
                tokens_saved: result.tokens_saved,
                elapsed_ms: result.elapsed_ms,
                secondary_output: result.secondary_output,
                classification_reason: result.classification_reason,
                error: result.error,
                workflow_stages: result.workflow_stages?.length > 0
                  ? result.workflow_stages
                  : liveStages,
                sections: result.sections?.length > 0
                  ? result.sections
                  : liveSections,
                memory_loaded: result.memory_loaded,
                project_goal: result.project_goal,
              }
            : m
        ))

        if (result.workflow_stages?.length > 0) {
          setWorkflowStages(result.workflow_stages)
        }

        fetchMemoryAndStats()
        fetchLogs()
        fetchChatHistory()
      },

      onError: (error) => {
        setIsLoading(false)
        setIsOrchestrating(false)
        // Update the placeholder message with error
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, error: error || "Connection failed — is the Velora server running?" }
            : m
        ))
        toast.error("Connection failed — is the server running?")
      },
    })

    activeStreamRef.current = controller
  }

  const handleRefreshMemory = async () => {
    setIsRefreshingMemory(true)
    await fetchMemoryAndStats()
    setIsRefreshingMemory(false)
  }

  const handleRefreshLogs = async () => {
    setIsRefreshingLogs(true)
    await fetchLogs()
    setIsRefreshingLogs(false)
  }

  const handleRefreshHistory = async () => {
    setIsRefreshingHistory(true)
    await fetchChatHistory()
    setIsRefreshingHistory(false)
  }

  if (!loggedIn) {
    return (
      <>
        <Toaster position="top-center" />
        <LoginScreen onLogin={handleLogin} />
      </>
    )
  }

  const sidebarProps = {
    userId,
    memory,
    stats,
    logs,
    workflowStages,
    isOrchestrating,
    chatHistory,
    projectGoal,
    onRefreshMemory: handleRefreshMemory,
    onRefreshLogs: handleRefreshLogs,
    onRefreshHistory: handleRefreshHistory,
    isRefreshingMemory,
    isRefreshingLogs,
    isRefreshingHistory,
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden animate-in fade-in duration-500">
      <Toaster position="top-center" />

      <Header
        userId={userId}
        onUserIdChange={handleUserIdChange}
        onReset={handleReset}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
        isSidebarOpen={sidebarOpen}
        isResetting={isResetting}
      />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 min-w-0">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
          />
        </main>

        <aside
          className={cn(
            "hidden md:block w-80 transition-all duration-300 ease-in-out overflow-hidden",
            sidebarOpen ? "opacity-100" : "w-0 opacity-0"
          )}
        >
          <AppSidebar {...sidebarProps} />
        </aside>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="right" className="w-80 p-0">
            <AppSidebar {...sidebarProps} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
