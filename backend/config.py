"""
config.py
---------
Single source of truth for all settings.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── AI Keys ───────────────────────────────────────────────────────────────────
GROQ_API_KEY     = os.getenv("GROQ_API_KEY", "")       # free — for backend/code tasks
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")     # free — for explanations/Q&A
FRONTEND_API_KEY = os.getenv("FRONTEND_API_KEY", "")
FRONTEND_BUILDER = os.getenv("FRONTEND_BUILDER", "skip")

# ── Model Names ───────────────────────────────────────────────────────────────
# Groq (free tier) — llama3-70b is excellent at code generation
GROQ_MODEL = "llama3-70b-8192"

# Gemini Flash (free tier) — fast, great at explanations and Q&A
GEMINI_MODEL = "gemini-1.5-flash"

# ── App ───────────────────────────────────────────────────────────────────────
APP_ENV   = os.getenv("APP_ENV", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "debug")

# ── Memory ────────────────────────────────────────────────────────────────────
MEMORY_DIR  = os.getenv("MEMORY_DIR", "memory/store")
MAX_HISTORY = int(os.getenv("MAX_HISTORY", "20"))

# ── Classifier keyword sets ───────────────────────────────────────────────────
# FIX: removed "jwt", "auth", "authentication" from BACKEND_KEYWORDS
# Those are concepts that get ASKED ABOUT — "what is jwt" should go to Gemini.
# They only go to Groq when paired with BUILD/CREATE/IMPLEMENT signals.
# Rule: if it's a question word prompt, explanation always wins.

BACKEND_KEYWORDS = {
    "api", "backend", "server", "database", "db", "endpoint", "route",
    "fastapi", "express", "django", "flask", "sql", "mongodb",
    "schema", "crud", "rest", "graphql",
    "python", "node", "function", "class", "logic", "algorithm",
    "migration", "query", "middleware", "validation",
    "build", "create", "implement", "write", "generate", "make",
    "code", "program", "develop", "deploy", "integrate",
}

FRONTEND_KEYWORDS = {
    "frontend", "ui", "ux", "component", "page", "screen", "design",
    "react", "vue", "html", "css", "button", "form", "layout", "navbar",
    "dashboard", "style", "tailwind", "responsive", "mobile", "web",
    "interface", "wireframe", "figma", "stitch", "cursor",
}

# FIX: added many natural question patterns so "what is jwt" correctly routes here
EXPLANATION_KEYWORDS = {
    "explain", "what", "why", "how", "describe", "tell me", "meaning",
    "difference", "compare", "summary", "overview", "understand",
    "definition", "concept", "simple", "basics", "introduction", "help",
    "clarify", "example", "demonstrate", "what is", "what are", "how does",
    "how do", "why is", "why does", "tell me about", "can you explain",
    "i want to know", "do you know", "give me", "show me", "teach me",
    "jwt", "oauth", "auth", "authentication", "token", "session",
    "security", "encryption", "hashing", "password", "cookie",
}
