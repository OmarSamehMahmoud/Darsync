"""Central configuration for Darsync.

All paths are resolved relative to the workspace root so the app is portable.
Environment variables can override the important runtime values.
"""
from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = WORKSPACE_ROOT / "frontend"
DATA_DIR = WORKSPACE_ROOT / "data"
UPLOAD_DIR = WORKSPACE_ROOT / "uploads"
OCR_MODEL_DIR = DATA_DIR / "paddleocr"

DB_PATH = DATA_DIR / "photonx.db"

for _p in (DATA_DIR, UPLOAD_DIR, OCR_MODEL_DIR):
    _p.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
# Override in production via env var. Used to sign JWT session tokens.
JWT_SECRET = os.environ.get("PHOTONX_JWT_SECRET", "photonx-c2p-super-secret-change-me")
JWT_ALGORITHM = "HS256"
TOKEN_TTL_HOURS = int(os.environ.get("PHOTONX_TOKEN_TTL_HOURS", "72"))

# ---------------------------------------------------------------------------
# NVIDIA NIM
# ---------------------------------------------------------------------------
NVIDIA_API_URL = os.environ.get(
    "PHOTONX_NVIDIA_API_URL",
    "https://integrate.api.nvidia.com/v1/chat/completions",
).rstrip("/")
NVIDIA_API_KEY = os.environ.get(
    "NVIDIA_API_KEY",
    os.environ.get("PHOTONX_NVIDIA_API_KEY", ""),
).strip()
CHAT_MODEL = os.environ.get(
    "PHOTONX_CHAT_MODEL",
    "minimaxai/minimax-m3.1-flash",
)
CHAT_MAX_TOKENS = int(os.environ.get("PHOTONX_CHAT_MAX_TOKENS", "16384"))
CHAT_TEMPERATURE = float(os.environ.get("PHOTONX_CHAT_TEMPERATURE", "1"))
CHAT_TOP_P = float(os.environ.get("PHOTONX_CHAT_TOP_P", "0.95"))

# ---------------------------------------------------------------------------
# QA Gate (post concept: "QA Gate 95/100 — anything below the bar is rejected")
# ---------------------------------------------------------------------------
# After a lesson streams, a second "judge" pass scores how grounded it is in
# the retrieved study sections. Below the threshold it is flagged for review.
QA_ENABLED = os.environ.get("PHOTONX_QA_ENABLED", "1") == "1"
QA_THRESHOLD = int(os.environ.get("PHOTONX_QA_THRESHOLD", "95"))  # 0-100
# If true, low-score answers are hidden/blocked; default just warns + shows score.
QA_AUTO_REJECT = os.environ.get("PHOTONX_QA_AUTO_REJECT", "0") == "1"

HTTP_TIMEOUT = float(os.environ.get("PHOTONX_HTTP_TIMEOUT", "300"))

# ---------------------------------------------------------------------------
# PDF processing and text retrieval
# ---------------------------------------------------------------------------
MAX_UPLOAD_BYTES = int(os.environ.get("PHOTONX_MAX_UPLOAD_BYTES", str(1024**3)))
UPLOAD_CHUNK_BYTES = 1024 * 1024
OCR_LANGUAGE = os.environ.get("PHOTONX_OCR_LANGUAGE", "ar").strip()
OCR_THRESHOLD = 80
OCR_RENDER_DPI = 180
OCR_MAX_DIMENSION = 3000
PREVIEW_MAX_DIMENSION = 2000
INDEX_BATCH_SIZE = 64
RETRIEVAL_TOP_K = 6
MAX_CONTEXT_CLAUSES = 10
LESSON_CONTEXT_MAX_CHARS = 500000
LESSON_CONTEXT_MAX_PAGES = 5000
CHUNK_TARGET = 900
CHUNK_MAX = 1400
CHUNK_OVERLAP = 120

# ---------------------------------------------------------------------------
# Default course structure (used on first run so the UI is not empty)
# ---------------------------------------------------------------------------
SEED_TAXONOMY = {
    "country": [
        "الصف الأول الابتدائي",
        "الصف الثاني الابتدائي",
        "الصف الثالث الابتدائي",
        "الصف الرابع الابتدائي",
        "الصف الخامس الابتدائي",
        "الصف السادس الابتدائي",
    ],
    "category": [
        "اللغة العربية",
        "اللغة الإنجليزية",
        "الرياضيات",
        "اكتشف",
        "العلوم",
        "الدراسات الاجتماعية",
        "التربية الدينية الإسلامية",
        "التربية الدينية المسيحية",
        "تكنولوجيا المعلومات والاتصالات",
        "المهارات المهنية",
        "التربية الفنية",
        "التربية الرياضية",
    ],
    "subcategory": ["الفصل الدراسي الأول", "الفصل الدراسي الثاني"],
    "test": [
        "الوحدة الأولى",
        "الوحدة الثانية",
        "الوحدة الثالثة",
        "الوحدة الرابعة",
        "الوحدة الخامسة",
        "الوحدة السادسة",
        "مراجعة عامة",
    ],
}

# ---------------------------------------------------------------------------
# Default admin account (created on first run)
# ---------------------------------------------------------------------------
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"
