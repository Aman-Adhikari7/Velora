"use client"

import { useState } from "react"
import { RotateCcw, Menu, User, PanelRightClose, PanelRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

function VeloraLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" className="text-primary/40" />
      {/* V shape */}
      <path d="M9 10 L16 22 L23 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      {/* Center pulse dot */}
      <circle cx="16" cy="22" r="2" fill="currentColor" className="text-primary" />
    </svg>
  )
}

interface HeaderProps {
  userId: string
  onUserIdChange: (id: string) => void
  onReset: () => void
  onToggleSidebar: () => void
  onToggleMobileMenu: () => void
  isSidebarOpen: boolean
  isResetting?: boolean
}

export function Header({
  userId,
  onUserIdChange,
  onReset,
  onToggleSidebar,
  onToggleMobileMenu,
  isSidebarOpen,
  isResetting,
}: HeaderProps) {
  const [editingUserId, setEditingUserId] = useState(false)
  const [tempUserId, setTempUserId] = useState(userId)

  const handleUserIdSubmit = () => {
    if (tempUserId.trim()) {
      onUserIdChange(tempUserId.trim())
    }
    setEditingUserId(false)
  }

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleMobileMenu}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8">
            <VeloraLogo />
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm md:text-base leading-tight tracking-tight">Velora</h1>
            <span className="text-[9px] text-muted-foreground leading-none uppercase tracking-widest hidden md:block">
              Claude · Gemini · GPT
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2">
          {editingUserId ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleUserIdSubmit() }}
              className="flex items-center gap-1"
            >
              <Input
                value={tempUserId}
                onChange={(e) => setTempUserId(e.target.value)}
                className="h-8 w-32 text-xs"
                autoFocus
                onBlur={handleUserIdSubmit}
              />
            </form>
          ) : (
            <button
              onClick={() => { setTempUserId(userId); setEditingUserId(true) }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-secondary text-xs text-muted-foreground transition-colors"
            >
              <User className="h-3.5 w-3.5" />
              <span>{userId}</span>
            </button>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs gap-1.5" disabled={isResetting}>
              <RotateCcw className={cn("h-3.5 w-3.5", isResetting && "animate-spin")} />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Velora Memory?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all project memory and conversation history for &quot;{userId}&quot;. The AI models will lose context of your project. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onReset}>Reset Memory</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button variant="ghost" size="icon" className="hidden md:flex" onClick={onToggleSidebar}>
          {isSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}
