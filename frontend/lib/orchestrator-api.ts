const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface WorkflowStage {
  name: string
  agent: string
  status: "pending" | "running" | "complete" | "skipped" | "error"
  label: string
  elapsed_ms?: number
}

export interface ResponseSection {
  title: string
  content: string
  model_used: string
  task_type: string
  elapsed_ms?: number
  success: boolean
}

export interface Message {
  id: number
  role: "user" | "assistant"
  content: string
  task_type?: string
  model_used?: string
  confidence?: number
  tokens_saved?: number
  elapsed_ms?: number
  secondary_output?: string | null
  classification_reason?: string | null
  error?: string | null
  timestamp: string
  workflow_stages?: WorkflowStage[]
  sections?: ResponseSection[]
  memory_loaded?: boolean
  project_goal?: string
}

export interface RunResponse {
  success: boolean
  output: string
  task_type: string
  model_used: string
  confidence: number
  tokens_saved: number
  elapsed_ms: number
  user_id: string
  secondary_output: string | null
  error: string | null
  classification_reason: string
  workflow_stages: WorkflowStage[]
  sections: ResponseSection[]
  memory_loaded: boolean
  project_goal: string
}

export interface MemoryData {
  project_goal: string
  created_at?: string
  updated_at: string
  context: {
    has_backend: boolean
    has_frontend: boolean
    has_explanation: boolean
    backend_snippet: string
    frontend_snippet: string
    explanation_snippet: string
  }
  stats?: {
    total_prompts: number
    claude_calls: number
    gpt_calls: number
    frontend_calls: number
    tokens_saved: number
  }
}

export interface MemoryResponse {
  success: boolean
  user_id: string
  data: MemoryData | null
}

export interface StatsResponse {
  success: boolean
  stats: {
    total_prompts: number
    claude_calls: number
    gpt_calls: number
    frontend_calls: number
    tokens_saved: number
    estimated_cost_saved: string
    prompt_reduction_pct: number
    context_reuse_pct: number
    api_calls_saved: number
  } | null
  project_goal: string
}

export interface LogsSummaryResponse {
  date: string
  total_requests: number
  success_rate: string
  task_breakdown: Record<string, number>
  total_tokens_saved: number
  models_used: Record<string, number>
}

export interface ChatHistoryPrompt {
  id: string
  content: string
  task_type: string
  model_used: string
  timestamp: string
}

export interface ChatHistoryResponse {
  success: boolean
  user_id: string
  project_goal: string
  prompts: ChatHistoryPrompt[]
}

// SSE streaming callbacks
export interface StreamCallbacks {
  onStageUpdate?: (stage: WorkflowStage) => void
  onSectionDone?: (section: ResponseSection) => void
  onComplete?: (result: RunResponse) => void
  onError?: (error: string) => void
}

// Display label mapping
export function formatModel(model: string): string {
  if (!model) return ""
  const lower = model.toLowerCase()
  if (lower.includes("groq") || lower.includes("llama") || lower === "claude") return "Claude"
  if (lower.includes("gemini") || lower === "gemini") return "Gemini"
  if (lower.includes("gpt") || lower === "gpt") return "GPT"
  if (lower.includes("stitch") || lower.includes("frontend") || lower.includes("cursor")) return "Gemini"
  if (lower.includes("+")) {
    return model.split("+").map((p: string) => formatModel(p.trim())).join(" + ")
  }
  return model
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export function getTaskTypeColor(taskType: string): string {
  switch (taskType) {
    case "backend": return "blue"
    case "frontend": return "amber"
    case "explanation": return "emerald"
    case "full": return "violet"
    default: return "slate"
  }
}

/**
 * runPromptStreaming — uses SSE to stream live workflow stages.
 * 
 * Returns an AbortController so the caller can cancel the stream.
 * Calls onStageUpdate as each stage changes,
 * onSectionDone when an agent finishes,
 * onComplete when the full result is ready.
 */
export function runPromptStreaming(
  prompt: string,
  userId: string,
  callbacks: StreamCallbacks,
): AbortController {
  const controller = new AbortController()

  const run = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/run/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, user_id: userId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        callbacks.onError?.(`HTTP ${response.status}: ${response.statusText}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        callbacks.onError?.("No response body")
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        let eventType = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            const rawData = line.slice(6).trim()
            if (!rawData) continue
            try {
              const data = JSON.parse(rawData)
              if (eventType === "stage_update" || data.type === "stage_update") {
                callbacks.onStageUpdate?.(data.stage)
              } else if (eventType === "section_done" || data.type === "section_done") {
                callbacks.onSectionDone?.(data.section)
              } else if (eventType === "complete" || data.type === "complete") {
                callbacks.onComplete?.(data.result)
              } else if (eventType === "error" || data.type === "error") {
                callbacks.onError?.(data.error || "Unknown error")
              }
            } catch (e) {
              console.warn("Failed to parse SSE data:", rawData, e)
            }
            eventType = ""
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      callbacks.onError?.(err instanceof Error ? err.message : "Stream failed")
    }
  }

  run()
  return controller
}

// Fallback non-streaming version (kept for compatibility)
export async function runPrompt(prompt: string, userId: string): Promise<RunResponse> {
  const res = await fetch(`${BASE_URL}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, user_id: userId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getMemory(userId: string): Promise<MemoryResponse> {
  try {
    const res = await fetch(`${BASE_URL}/api/memory/${userId}`)
    if (res.status === 404) return { success: false, user_id: userId, data: null }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch {
    return { success: false, user_id: userId, data: null }
  }
}

export async function getStats(userId: string): Promise<StatsResponse> {
  try {
    const res = await fetch(`${BASE_URL}/api/stats/${userId}`)
    if (res.status === 404) return { success: false, stats: null, project_goal: "" }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch {
    return { success: false, stats: null, project_goal: "" }
  }
}

export async function resetMemory(userId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/api/reset/${userId}`, { method: "POST" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getLogsSummary(): Promise<LogsSummaryResponse> {
  const res = await fetch(`${BASE_URL}/api/logs/summary`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getChatHistory(userId: string): Promise<ChatHistoryResponse> {
  try {
    const res = await fetch(`${BASE_URL}/api/chat-history/${userId}`)
    if (!res.ok) return { success: false, user_id: userId, project_goal: "", prompts: [] }
    return res.json()
  } catch {
    return { success: false, user_id: userId, project_goal: "", prompts: [] }
  }
}
