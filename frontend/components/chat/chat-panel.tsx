"use client"

import { useRef, useEffect, useState } from "react"
import { Message } from "@/lib/orchestrator-api"
import { MessageBubble } from "./message-bubble"
import { PromptInput } from "./prompt-input"
import { TypingIndicator } from "./typing-indicator"
import { ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  onSendMessage: (prompt: string) => void
}

function VeloraEmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" className="text-primary/40" />
          <path d="M9 10 L16 22 L23 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
          <circle cx="16" cy="22" r="2" fill="currentColor" className="text-primary" />
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2 tracking-tight">Welcome to Velora</h2>
      <p className="text-muted-foreground max-w-md leading-relaxed text-sm mb-6">
        Your unified AI workspace. Velora intelligently routes your prompt to the right AI model and maintains project memory across every session.
      </p>
      <div className="grid grid-cols-3 gap-3 max-w-lg w-full text-left">
        {[
          { label: "Backend Tasks", agent: "Claude", color: "border-blue-500/30 bg-blue-500/5", dot: "bg-blue-500" },
          { label: "UI Generation", agent: "Frontend AI", color: "border-amber-500/30 bg-amber-500/5", dot: "bg-amber-500" },
          { label: "Explanations",  agent: "GPT-4",  color: "border-emerald-500/30 bg-emerald-500/5", dot: "bg-emerald-500" },
        ].map(item => (
          <div key={item.label} className={`p-3 rounded-xl border ${item.color}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.agent}</span>
            </div>
            <p className="text-xs font-medium">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChatPanel({ messages, isLoading, onSendMessage }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }

  return (
    <div className="flex flex-col h-full relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-6"
      >
        {messages.length === 0 ? (
          <VeloraEmptyState />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {showScrollButton && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-32 right-6 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}

      <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <PromptInput onSend={onSendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}
