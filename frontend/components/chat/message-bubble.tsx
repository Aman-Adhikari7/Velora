"use client"

import { Message, ResponseSection, formatModel } from "@/lib/orchestrator-api"
import { CodeBlock } from "./code-block"
import { RoutingBadge } from "./routing-badge"
import { Zap, Database, AlertCircle, User, Code2, Layout, MessageSquare, ChevronDown, ChevronUp, MemoryStick } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

function VeloraAvatar() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" className="text-primary/50" />
      <path d="M9 10 L16 22 L23 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      <circle cx="16" cy="22" r="2" fill="currentColor" className="text-primary" />
    </svg>
  )
}

function parseContent(content: string) {
  const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = []
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: "code", content: match[2].trim(), language: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: "text" as const, content }]
}

// Section header config
const sectionConfig: Record<string, {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  dot: string
}> = {
  // Claude = Backend (blue)
  backend: {
    icon: Code2,
    color: "text-blue-400",
    bg: "bg-blue-500/5",
    border: "border-blue-500/20",
    dot: "bg-blue-500",
  },
  // Gemini = Frontend (amber)
  frontend: {
    icon: Layout,
    color: "text-amber-400",
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  // GPT = Orchestration (violet)
  explanation: {
    icon: MessageSquare,
    color: "text-violet-400",
    bg: "bg-violet-500/5",
    border: "border-violet-500/20",
    dot: "bg-violet-500",
  },
}

function SectionBlock({ section, index }: { section: ResponseSection; index: number }) {
  const [collapsed, setCollapsed] = useState(false)
  const cfg = sectionConfig[section.task_type] || sectionConfig.explanation
  const Icon = cfg.icon
  const contentParts = parseContent(section.content)

  return (
    <div className={cn("rounded-xl border overflow-hidden", cfg.border, cfg.bg)}>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/5 transition-colors"
      >
        <span className={cn("flex items-center gap-1.5", cfg.color)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Section {index + 1}</span>
        </span>
        <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
        <span className="text-xs font-medium text-foreground flex-1 text-left font-mono">{section.title}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium", cfg.bg, cfg.color, "border", cfg.border)}>
          {section.model_used}
        </span>
        {section.elapsed_ms && section.elapsed_ms > 0 && (
          <span className="text-[10px] text-muted-foreground/50">
            {section.elapsed_ms.toFixed(0)}ms
          </span>
        )}
        {collapsed
          ? <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
          : <ChevronUp className="h-3 w-3 text-muted-foreground/50" />
        }
      </button>

      {/* Section content */}
      {!collapsed && (
        <div className="px-4 pb-4 pt-1 border-t border-border/30">
          <div className="prose prose-sm prose-invert max-w-none">
            {contentParts.map((part, i) =>
              part.type === "code" ? (
                <CodeBlock key={i} code={part.content} language={part.language} />
              ) : (
                <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed m-0 text-foreground/90">
                  {part.content}
                </p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MemoryBanner() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 mb-3">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
      <span className="text-[10px] font-mono text-violet-400 font-medium">
        [Memory Loaded] → [Existing Project Context Detected] → [Continuing Workflow]
      </span>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"
  const isError = !!message.error

  if (isError) {
    return (
      <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="max-w-[85%] md:max-w-[75%] rounded-lg px-4 py-3 bg-destructive/10 border border-destructive/30">
          <div className="flex items-center gap-2 text-destructive mb-1">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Error</span>
          </div>
          <p className="text-sm text-destructive/90">{message.error}</p>
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex gap-3 flex-row-reverse max-w-[85%] md:max-w-[70%]">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <div className="rounded-lg px-4 py-3 bg-primary text-primary-foreground">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    )
  }

  // Determine if we have multi-section output
  const hasSections = message.sections && message.sections.length > 0

  return (
    <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex gap-3 w-full">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-secondary border border-border">
          <VeloraAvatar />
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* Memory continuity banner */}
          {message.memory_loaded && <MemoryBanner />}

          {hasSections ? (
            // ── Multi-section output (full / multi-agent) ──────────────────
            <div className="space-y-3">
              {message.sections!.map((section, i) => (
                <SectionBlock key={i} section={section} index={i} />
              ))}
            </div>
          ) : (
            // ── Single-section output (explanation only, or fallback) ──────
            <div className="text-foreground">
              <div className="prose prose-sm prose-invert max-w-none">
                {parseContent(message.content).map((part, index) =>
                  part.type === "code" ? (
                    <CodeBlock key={index} code={part.content} language={part.language} />
                  ) : (
                    <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed m-0">
                      {part.content}
                    </p>
                  )
                )}
              </div>

              {message.secondary_output && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Explanation (GPT-4)
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{message.secondary_output}</p>
                </div>
              )}
            </div>
          )}

          {/* Meta info footer */}
          {!isUser && message.task_type && (
            <div className="flex flex-col gap-1.5 px-1 mt-1">
              <RoutingBadge
                taskType={message.task_type}
                modelUsed={message.model_used || ""}
                confidence={message.confidence}
              />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {message.elapsed_ms !== undefined && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {message.elapsed_ms.toFixed(0)}ms total
                  </span>
                )}
                {message.tokens_saved !== undefined && message.tokens_saved > 0 && (
                  <span className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    {message.tokens_saved} tokens saved
                  </span>
                )}
                {hasSections && (
                  <span className="text-primary/60 font-mono text-[10px]">
                    {message.sections!.length} agents ran
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
