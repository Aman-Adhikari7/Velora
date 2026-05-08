"""
main.py
-------
Velora — Multi-AI Orchestration Platform
FastAPI entry point.

To run:
    uvicorn main:app --reload --port 8000
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import APP_ENV, MEMORY_DIR

os.makedirs(MEMORY_DIR, exist_ok=True)
os.makedirs("logs", exist_ok=True)

app = FastAPI(
    title="Velora — Multi-AI Orchestration Platform",
    description="Unified AI workspace with intelligent routing and shared memory.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "running",
        "app": "Velora",
        "version": "2.0.0",
        "env": APP_ENV,
        "docs": "/docs",
    }

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": "Velora"}

from routes.orchestrator_routes import router as orchestrator_router
app.include_router(orchestrator_router, prefix="/api")

from fastapi import APIRouter
from logger.workflow_logger import read_today_logs, read_logs_summary

logs_router = APIRouter(tags=["Logs"])

@logs_router.get("/logs/summary", summary="Today's activity summary")
async def logs_summary():
    return read_logs_summary()

@logs_router.get("/logs/today", summary="Raw log entries from today")
async def logs_today(limit: int = 20):
    return {"success": True, "entries": read_today_logs(limit=limit)}

app.include_router(logs_router, prefix="/api")
