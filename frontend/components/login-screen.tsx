"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const AGENT_LINES = [
  { agent: "Velora Router", color: "text-violet-400", dot: "bg-violet-500", label: "Analyzing prompt..." },
  { agent: "Claude", color: "text-blue-400", dot: "bg-blue-500", label: "Generating backend..." },
  { agent: "Frontend AI", color: "text-amber-400", dot: "bg-amber-500", label: "Building UI components..." },
  { agent: "GPT-4", color: "text-emerald-400", dot: "bg-emerald-500", label: "Explaining architecture..." },
  { agent: "Velora Memory", color: "text-pink-400", dot: "bg-pink-500", label: "Persisting project context..." },
]

const DEMO_PROMPTS = [
  "Build a blog app with authentication",
  "Create a dashboard UI with charts",
  "Add payment integration to my app",
  "Explain how JWT authentication works",
]

function AnimatedTerminal() {
  const [visibleLines, setVisibleLines] = useState<number>(0)
  const [activePromptIdx, setActivePromptIdx] = useState(0)
  const [typing, setTyping] = useState("")
  const [typingDone, setTypingDone] = useState(false)

  useEffect(() => {
    // Cycle through prompts
    const interval = setInterval(() => {
      setActivePromptIdx(i => (i + 1) % DEMO_PROMPTS.length)
      setVisibleLines(0)
      setTyping("")
      setTypingDone(false)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const prompt = DEMO_PROMPTS[activePromptIdx]
    let charIdx = 0
    setTyping("")
    setTypingDone(false)
    setVisibleLines(0)

    const typeInterval = setInterval(() => {
      charIdx++
      setTyping(prompt.slice(0, charIdx))
      if (charIdx >= prompt.length) {
        clearInterval(typeInterval)
        setTypingDone(true)
      }
    }, 40)
    return () => clearInterval(typeInterval)
  }, [activePromptIdx])

  useEffect(() => {
    if (!typingDone) return
    let lineIdx = 0
    const lineInterval = setInterval(() => {
      lineIdx++
      setVisibleLines(lineIdx)
      if (lineIdx >= AGENT_LINES.length) clearInterval(lineInterval)
    }, 400)
    return () => clearInterval(lineInterval)
  }, [typingDone])

  return (
    <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/30">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-secondary/30">
        <span className="w-3 h-3 rounded-full bg-red-500/70" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-[11px] font-mono text-muted-foreground">velora — orchestration</span>
      </div>

      {/* Terminal body */}
      <div className="p-5 font-mono text-xs space-y-2 min-h-[220px]">
        <div className="flex items-center gap-2 text-muted-foreground/60">
          <span className="text-violet-400">❯</span>
          <span className="text-foreground/80">{typing}</span>
          {!typingDone && <span className="w-0.5 h-3.5 bg-primary animate-pulse" />}
        </div>

        {typingDone && visibleLines > 0 && (
          <div className="space-y-2 pt-1">
            {AGENT_LINES.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
              >
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", line.dot,
                  i === visibleLines - 1 && visibleLines < AGENT_LINES.length ? "animate-pulse" : ""
                )} />
                <span className={cn("font-semibold", line.color)}>[{line.agent}]</span>
                <span className="text-muted-foreground/70">{line.label}</span>
                {i < visibleLines - 1 && (
                  <span className="ml-auto text-emerald-500 text-[10px]">✓</span>
                )}
              </div>
            ))}
            {visibleLines >= AGENT_LINES.length && (
              <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-400 font-semibold">All agents complete</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50">
                  Project saved to memory
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface LoginScreenProps {
  onLogin: (userId: string) => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [userId, setUserId] = useState("")
  const [isEntering, setIsEntering] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const id = userId.trim() || "demo_user"
    setIsEntering(true)
    setTimeout(() => onLogin(id), 400)
  }

  const handleQuickStart = (name: string) => {
    setIsEntering(true)
    setTimeout(() => onLogin(name), 400)
  }

  return (
    <div className={cn(
      "h-screen flex overflow-hidden bg-background transition-opacity duration-500",
      mounted ? "opacity-100" : "opacity-0",
      isEntering && "opacity-0"
    )}>
      {/* Left: branding + terminal preview */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-secondary/20 border-r border-border px-12 gap-10 relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        />
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center space-y-2 mb-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <VeloraLogo size={40} />
            <h1 className="text-4xl font-bold tracking-tight">Velora</h1>
          </div>
          <p className="text-muted-foreground text-base max-w-xs leading-relaxed">
            A unified AI workspace where multiple agents collaborate through shared memory.
          </p>
        </div>

        <AnimatedTerminal />

        {/* Agent legend */}
        <div className="relative z-10 grid grid-cols-2 gap-2 w-full max-w-sm">
          {[
            { label: "Backend Tasks", agent: "Claude", color: "border-blue-500/30 bg-blue-500/5 text-blue-400", dot: "bg-blue-500" },
            { label: "UI Generation", agent: "Frontend AI", color: "border-amber-500/30 bg-amber-500/5 text-amber-400", dot: "bg-amber-500" },
            { label: "Explanations", agent: "GPT-4", color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400", dot: "bg-emerald-500" },
            { label: "Full Stack", agent: "All Agents", color: "border-violet-500/30 bg-violet-500/5 text-violet-400", dot: "bg-violet-500" },
          ].map(item => (
            <div key={item.label} className={cn("p-2.5 rounded-xl border text-xs", item.color)}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", item.dot)} />
                <span className="font-semibold">{item.agent}</span>
              </div>
              <p className="text-muted-foreground/80">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md mx-auto w-full lg:max-w-none">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <VeloraLogo size={32} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Velora</h1>
              <p className="text-xs text-muted-foreground">AI Orchestration</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Enter your workspace ID to continue your project.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Workspace ID</label>
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="e.g. my_project, john_dev"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground/50">
                Your memory and project history are tied to this ID.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              Enter Workspace
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground/50">or quick start</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {["demo_user", "hackathon", "alice", "bob"].map(name => (
              <button
                key={name}
                onClick={() => handleQuickStart(name)}
                className="py-2 px-3 rounded-lg border border-border/50 bg-secondary/20 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all text-left"
              >
                <span className="text-primary/60 font-mono">@</span> {name}
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-muted-foreground/40">
            Velora · Multi-Agent AI Orchestration
          </p>
        </div>
      </div>
    </div>
  )
}

function VeloraLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" className="text-primary/40" />
      <path d="M9 10 L16 22 L23 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      <circle cx="16" cy="22" r="2" fill="currentColor" className="text-primary" />
    </svg>
  )
}
