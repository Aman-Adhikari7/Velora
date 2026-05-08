"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { Send, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PromptInputProps {
  onSend: (prompt: string) => void
  isLoading: boolean
}

// 3-model system quick prompts
const quickPrompts = [
  { label: "Build a blog app", hint: "Claude + Gemini + GPT", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20" },
  { label: "Create a SaaS dashboard", hint: "Claude + Gemini + GPT", color: "text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20" },
  { label: "Build a REST API", hint: "Claude · Backend", color: "text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20" },
  { label: "Design a landing page", hint: "Gemini · Frontend", color: "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20" },
  { label: "Explain the architecture", hint: "GPT · Orchestration", color: "text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20" },
]

export function PromptInput({ onSend, isLoading }: PromptInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      const newHeight = Math.min(textarea.scrollHeight, 200)
      textarea.style.height = `${newHeight}px`
    }
  }

  useEffect(() => {
    adjustHeight()
  }, [value])

  const handleSubmit = () => {
    if (value.trim() && !isLoading) {
      onSend(value.trim())
      setValue("")
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-3">
      {/* Demo quick prompts */}
      <div className="flex flex-wrap gap-1.5">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => setValue(prompt.label)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg border font-medium transition-all",
              prompt.color
            )}
          >
            <Sparkles className="h-2.5 w-2.5 opacity-70" />
            {prompt.label}
            <span className="opacity-50 text-[9px] hidden sm:inline">· {prompt.hint}</span>
          </button>
        ))}
      </div>

      <div className="relative flex items-end gap-2 p-2 rounded-2xl bg-card border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Build a blog app, Create a SaaS, Make a dashboard... the 3-model system handles the rest."
          rows={1}
          disabled={isLoading}
          className={cn(
            "flex-1 resize-none bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
            "min-h-[44px] max-h-[200px]"
          )}
        />
        <Button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          size="icon"
          className="h-10 w-10 rounded-xl shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground/50">
        Press <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">Enter</kbd> to send
      </p>
    </div>
  )
}
