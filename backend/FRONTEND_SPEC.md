# FRONTEND BUILD SPEC
# Multi-AI Orchestrator — Complete UI Specification
# Version: 1.0 | Backend: FastAPI + Python | Target: React 18 + Tailwind CSS
# ═══════════════════════════════════════════════════════════════════════════════

## PROJECT OVERVIEW

You are building the frontend for a **Multi-AI Orchestrator** — a system that
automatically routes user prompts to the right AI model:

- **Claude Sonnet** → backend code (APIs, databases, logic)
- **GPT-4o-mini** → explanations, questions, concepts
- **Stitch/Cursor spec** → frontend UI tasks

The UI should feel like a premium AI chat interface (think Claude.ai) with a
sidebar showing live memory/routing metadata.

---

## TECH STACK

```
Framework:   React 18 (functional components + hooks)
Styling:     Tailwind CSS (utility-first, no custom CSS files)
HTTP:        fetch() with async/await
State:       useState + useEffect (no Redux needed)
Icons:       lucide-react
Fonts:       Inter (already available via Tailwind)
No TypeScript. Plain JSX only.
```

---

## BACKEND API

**Base URL:** `http://localhost:8000`
**Swagger docs:** `http://localhost:8000/docs`

All endpoints return `{ success: bool, ...data }`.
Errors return `{ success: false, error: "message" }`.

### Endpoints

#### POST /api/run
The main endpoint. Send a prompt, get a response.

**Request:**
```json
{
  "prompt": "Build a FastAPI /login endpoint with JWT auth",
  "user_id": "user_123"
}
```

**Response:**
```json
{
  "success": true,
  "output": "Here is the /login endpoint...",
  "task_type": "backend",
  "model_used": "claude-sonnet-4-20250514",
  "confidence": 0.75,
  "tokens_saved": 120,
  "elapsed_ms": 1420.5,
  "user_id": "user_123",
  "secondary_output": null,
  "error": null,
  "classification_reason": "Backend keywords matched: [api, fastapi, jwt]"
}
```

`task_type` values: `"backend"` | `"frontend"` | `"explanation"` | `"full"`
`secondary_output` is non-null only when `task_type === "full"` (contains GPT explanation)

---

#### GET /api/memory/{user_id}
View current memory snapshot.

**Response:**
```json
{
  "success": true,
  "user_id": "user_123",
  "data": {
    "project_goal": "Build a login system",
    "created_at": "2025-01-15T10:00:00",
    "updated_at": "2025-01-15T10:05:00",
    "context": {
      "has_backend": true,
      "has_frontend": false,
      "has_explanation": true,
      "backend_snippet": "from fastapi import ...",
      "frontend_snippet": "",
      "explanation_snippet": "JWT works by..."
    },
    "stats": {
      "total_prompts": 3,
      "claude_calls": 1,
      "gpt_calls": 2,
      "frontend_calls": 0,
      "tokens_saved": 340
    }
  }
}
```

---

#### GET /api/history/{user_id}?limit=20
Full conversation history.

**Response:**
```json
{
  "success": true,
  "user_id": "user_123",
  "total_count": 10,
  "returned": 10,
  "messages": [
    {
      "id": "a3f9b2c1",
      "role": "user",
      "content": "Build a /login endpoint...",
      "full_length": 42,
      "task_type": "backend",
      "model_used": "claude-sonnet-4-20250514",
      "timestamp": "2025-01-15T10:00:00",
      "tokens_saved": 0
    }
  ]
}
```

---

#### POST /api/reset/{user_id}
Wipe memory and start fresh.

**Response:**
```json
{
  "success": true,
  "user_id": "user_123",
  "message": "Memory wiped. Next prompt starts fresh.",
  "had_memory": true
}
```

---

#### GET /api/stats/{user_id}
Token savings and usage stats.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_prompts": 5,
    "claude_calls": 2,
    "gpt_calls": 3,
    "frontend_calls": 0,
    "tokens_saved": 560,
    "estimated_cost_saved": "$0.0008"
  },
  "project_goal": "Build a login system"
}
```

---

#### GET /api/logs/summary
Today's activity summary.

**Response:**
```json
{
  "date": "2025-01-15",
  "total_requests": 12,
  "success_rate": "91.7%",
  "task_breakdown": { "backend": 5, "explanation": 4, "frontend": 2, "full": 1 },
  "total_tokens_saved": 1240,
  "models_used": { "claude-sonnet-4-20250514": 5, "gpt-4o-mini": 6 }
}
```

---

## UI LAYOUT

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: "Multi-AI Orchestrator"  [user_id input]  [Reset button]   │
├──────────────────────────────────────┬──────────────────────────────┤
│                                      │  SIDEBAR                     │
│  CHAT PANEL                          │  ┌─────────────────────────┐ │
│                                      │  │ 🧠 Memory Panel         │ │
│  [Message bubbles]                   │  │ Project: "Build login"  │ │
│                                      │  │ ✓ Backend  ✓ Explain    │ │
│  User: "Build a /login endpoint"     │  │ ✗ Frontend              │ │
│                                      │  └─────────────────────────┘ │
│  Assistant (Claude):                 │  ┌─────────────────────────┐ │
│  [code block]                        │  │ 📊 Stats                │ │
│  Routing: backend → Claude (0.75)    │  │ 3 prompts               │ │
│                                      │  │ 120 tokens saved        │ │
│                                      │  │ $0.0002 saved           │ │
│                                      │  └─────────────────────────┘ │
│                                      │  ┌─────────────────────────┐ │
│                                      │  │ 📋 Today's Logs         │ │
│                                      │  │ backend | 142ms | ✓     │ │
│                                      │  │ explain | 89ms  | ✓     │ │
│                                      │  └─────────────────────────┘ │
├──────────────────────────────────────┴──────────────────────────────┤
│  INPUT: [textarea]  [Send button]  [Ctrl+Enter to send]             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## COMPONENTS TO BUILD

### 1. `App.jsx` — Root component
```
State:
  - userId (string, default "default_user")
  - messages (array)
  - isLoading (bool)
  - memory (object | null)
  - stats (object | null)

On mount: fetch memory + stats for current userId
Layout: Header + flex row (ChatPanel + Sidebar)
```

---

### 2. `Header.jsx`
```
Shows: App title, userId input (editable), Reset button

On userId change: clear messages, re-fetch memory
On Reset click: POST /api/reset/{userId}, clear everything, show toast
```

---

### 3. `ChatPanel.jsx`
```
Props: messages[], isLoading, onSendMessage(prompt)

Shows:
  - Scrollable message list (auto-scroll to bottom on new message)
  - MessageBubble for each message
  - PromptInput at the bottom

Empty state: "Ask anything — I'll route it to the right AI automatically."
```

---

### 4. `MessageBubble.jsx`
```
Props: message { role, content, task_type, model_used, confidence,
                 tokens_saved, elapsed_ms, secondary_output,
                 classification_reason, error }

User bubble: right-aligned, blue background
Assistant bubble: left-aligned, dark card

Assistant bubble MUST show (below the content):
  ┌─────────────────────────────────────────────┐
  │  🏷 backend  •  claude-sonnet  •  conf: 0.75  │
  │  ⚡ 142ms  •  💾 120 tokens saved             │
  │  reason: "Backend keywords matched: [api...]" │
  └─────────────────────────────────────────────┘

If task_type === "full" AND secondary_output exists:
  Show two sections: "Code (Claude)" and "Explanation (GPT)"
  with a divider between them

Content rendering:
  - Detect code blocks (``` wrapped content) → render with syntax highlighting
  - Use a <pre><code> block with a copy button
  - Non-code content → render as markdown (use react-markdown or manual parsing)

Error state: red bubble with error message
```

---

### 5. `PromptInput.jsx`
```
Props: onSend(prompt), isLoading

UI:
  - Textarea (auto-resize, 3 rows default, max 8 rows)
  - Send button (disabled when loading or empty)
  - Ctrl+Enter shortcut to submit
  - Loading spinner in button when isLoading

Quick prompt chips below input:
  - "Build a FastAPI endpoint"
  - "Explain JWT authentication"
  - "Create a React dashboard"
  - "What is async/await?"

Clicking a chip fills the textarea (lets user edit before sending)
```

---

### 6. `MemoryPanel.jsx`
```
Props: memory (object | null), userId

Shows:
  - Project goal (or "No project yet")
  - Context indicators:
      ✓ Backend context saved   (green if has_backend)
      ✓ Explanation saved       (green if has_explanation)
      ○ Frontend spec pending   (grey if no frontend)
  - Last update time (relative: "2 minutes ago")

On click "View snippet" → expand to show snippet text
Refresh button → re-fetch memory
```

---

### 7. `StatsPanel.jsx`
```
Props: stats (object | null)

Shows:
  - Total prompts count (large number, prominent)
  - Mini bar chart: Claude vs GPT vs Frontend call distribution
    (use simple div widths, no chart library needed)
  - Tokens saved (with animated counter on update)
  - Estimated cost saved ($X.XXXX)

Update: refresh after every successful /api/run call
```

---

### 8. `LogsPanel.jsx`
```
Fetches: GET /api/logs/summary on mount + after each run

Shows:
  - Today's date
  - Success rate (e.g., "91.7%")
  - Task breakdown (backend: 5, explain: 4, etc.)
  - Mini list of recent entries from GET /api/logs/today?limit=5
    Each entry: task_type badge | elapsed ms | ✓ or ✗

Auto-refresh: every 30 seconds
```

---

### 9. `RoutingBadge.jsx`
```
Props: task_type, model_used, confidence

A small pill/badge component used inside MessageBubble.

task_type colors:
  backend     → blue   (#3B82F6)
  explanation → green  (#10B981)
  frontend    → purple (#8B5CF6)
  full        → orange (#F59E0B)

Shows model name abbreviated:
  "claude-sonnet-4-20250514" → "Claude Sonnet"
  "gpt-4o-mini"              → "GPT-4o mini"
  "stitch-spec"              → "Stitch spec"
  "claude-sonnet + gpt-4o-mini" → "Claude + GPT"
```

---

### 10. `CodeBlock.jsx`
```
Props: code (string), language (string, optional)

Shows:
  - Dark code block with monospace font
  - Copy to clipboard button (top right)
  - Language label (top left, if provided)
  - Horizontal scroll for long lines

Copy button: changes to "Copied!" for 2 seconds after click
```

---

## STATE MANAGEMENT

```javascript
// Message shape stored in state:
{
  id: Date.now(),           // unique key for React
  role: "user" | "assistant",
  content: string,
  task_type: string,        // from API
  model_used: string,       // from API
  confidence: number,       // from API
  tokens_saved: number,     // from API
  elapsed_ms: number,       // from API
  secondary_output: string | null,
  classification_reason: string | null,
  error: string | null,
  timestamp: new Date().toISOString(),
}
```

```javascript
// Send flow:
async function handleSend(prompt) {
  // 1. Add user message to state immediately (optimistic)
  setMessages(prev => [...prev, { role: "user", content: prompt, id: Date.now() }])
  setIsLoading(true)

  // 2. Call API
  const res = await fetch("http://localhost:8000/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, user_id: userId })
  })
  const data = await res.json()

  // 3. Add assistant message
  setMessages(prev => [...prev, {
    role: "assistant",
    id: Date.now() + 1,
    content: data.output || "",
    task_type: data.task_type,
    model_used: data.model_used,
    confidence: data.confidence,
    tokens_saved: data.tokens_saved,
    elapsed_ms: data.elapsed_ms,
    secondary_output: data.secondary_output,
    classification_reason: data.classification_reason,
    error: data.error,
  }])

  // 4. Refresh memory + stats
  await refreshMemoryAndStats()
  setIsLoading(false)
}
```

---

## DESIGN TOKENS

```
Background:     #0F172A  (slate-900)
Surface:        #1E293B  (slate-800)
Surface raised: #334155  (slate-700)
Border:         #475569  (slate-600)
Text primary:   #F1F5F9  (slate-100)
Text secondary: #94A3B8  (slate-400)
Text muted:     #64748B  (slate-500)
Accent blue:    #3B82F6  (blue-500)
Accent green:   #10B981  (emerald-500)
Accent purple:  #8B5CF6  (violet-500)
Accent orange:  #F59E0B  (amber-500)
Accent red:     #EF4444  (red-500)

Font: Inter (system default via Tailwind)
Code font: JetBrains Mono or Fira Code (via Google Fonts CDN)
Border radius: 8px cards, 4px badges, 9999px chips/tags
```

---

## RESPONSIVE BEHAVIOR

```
Mobile (< 768px):
  - Sidebar hidden by default
  - Toggle button (bottom right) to show/hide as overlay
  - Full-width chat panel

Tablet (768px – 1024px):
  - Sidebar collapsed (icons only) — click to expand
  - Chat panel takes remaining width

Desktop (> 1024px):
  - Sidebar always visible (280px wide)
  - Chat panel fills remaining width (max-width: 800px centered)
```

---

## UX DETAILS

**Loading state:**
- Typing indicator in chat (3 animated dots) while waiting for API
- Sidebar stats show skeleton loaders

**Scroll behavior:**
- Auto-scroll to bottom when new message arrives
- User can scroll up to read history without being hijacked
- Scroll-to-bottom button appears when user scrolls up

**Error handling:**
- API error → red error bubble in chat with the error message
- Network error → toast notification "Connection failed — is the server running?"
- Empty response → "The AI returned an empty response. Please try again."

**Toast notifications:**
- Memory reset → "Memory cleared. Starting fresh!"
- Copy to clipboard → "Copied!"
- API errors → red toast, auto-dismiss after 4 seconds

**Animations:**
- Message bubbles fade+slide in (100ms ease-out)
- Stats numbers animate when they update
- Typing dots bounce (CSS animation)
- Sidebar panels collapse/expand smoothly

---

## FILE STRUCTURE

```
src/
├── App.jsx                    ← root, state, layout
├── api/
│   └── orchestratorApi.js     ← all fetch() calls, one file
├── components/
│   ├── Header.jsx
│   ├── ChatPanel.jsx
│   ├── MessageBubble.jsx
│   ├── PromptInput.jsx
│   ├── RoutingBadge.jsx
│   ├── CodeBlock.jsx
│   └── sidebar/
│       ├── Sidebar.jsx        ← wrapper for all panels
│       ├── MemoryPanel.jsx
│       ├── StatsPanel.jsx
│       └── LogsPanel.jsx
├── hooks/
│   ├── useOrchestrator.js     ← handleSend logic
│   └── useMemory.js           ← memory + stats fetching
└── utils/
    └── formatters.js          ← formatModel(), formatRelativeTime(), etc.
```

---

## QUICK START INSTRUCTIONS FOR THE AI BUILDING THIS

1. Create a new React app: `npx create-react-app ai-orchestrator-ui` (or Vite)
2. Install Tailwind CSS following official docs
3. Install: `npm install lucide-react`
4. Build `api/orchestratorApi.js` first — all API calls in one place
5. Build `App.jsx` with layout skeleton and hardcoded mock data
6. Build `ChatPanel` + `MessageBubble` — core interaction loop
7. Build `PromptInput` — send logic
8. Wire to real API (replace mock data)
9. Build sidebar panels: Memory → Stats → Logs
10. Polish: animations, responsive, error states, empty states

**Most important thing:** The routing metadata (task_type badge, model used,
confidence, tokens saved) is the KEY differentiator of this UI. Make it
prominent, beautiful, and informative. This is what makes the demo impressive.

---

## DEMO SCRIPT (what to show in the demo)

1. Send: "What is JWT authentication?" → shows GPT badge, explanation
2. Send: "Build a FastAPI /login endpoint with JWT" → shows Claude badge, code
3. Send: "Add a React login form for that endpoint" → shows Stitch/frontend badge
4. Send: "Build a full user registration system with React + FastAPI" → shows FULL badge (Claude + GPT)
5. Show sidebar: memory has context of all 4 steps, stats show tokens saved
6. Click Reset → memory cleared → start over

This shows all 4 routing paths and the memory continuity in one demo run.
