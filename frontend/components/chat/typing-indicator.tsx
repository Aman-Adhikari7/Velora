"use client"

import { useEffect, useState } from "react"

const ORCHESTRATION_STEPS = [
  "Analyzing your prompt...",
  "Routing to the right AI agent...",
  "Running sequential workflow...",
  "Updating project memory...",
]

export function TypingIndicator() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => (i + 1) % ORCHESTRATION_STEPS.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" className="text-primary/50" />
            <path d="M9 10 L16 22 L23 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
            <circle cx="16" cy="22" r="2" fill="currentColor" className="text-primary" />
          </svg>
        </div>
        <div className="rounded-2xl px-4 py-3 bg-card border border-border">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
            <p className="text-[10px] text-muted-foreground animate-in fade-in duration-300" key={stepIndex}>
              {ORCHESTRATION_STEPS[stepIndex]}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
