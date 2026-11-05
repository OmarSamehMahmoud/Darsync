"""FastAPI application for Darsync.

Serves the learning SPA (frontend/) and a JSON API covering:
  * auth (login, me)
  * admin course management (course/subject/unit/topic + study materials)
  * PDF ingestion (streamed upload -> page extraction/OCR -> FTS indexing)
  * streaming lesson generation (SSE) scoped by the selected course topic
  * per-user lesson history
"""
from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import AsyncGenerator, Callable, List

import fitz
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import auth, config, database as db, memory, nvidia_client, qa, rag
from .database import now

logger = logging.getLogger(__name__)
app = FastAPI(title="Darsync", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init()
    db.exec(
        "UPDATE study_index_jobs SET status='failed', "
        "error='Indexing was interrupted by a server restart.', updated_at=? "
        "WHERE status IN ('queued','running')",
        now(),
    )
    rag.reconcile_legacy_indexes()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@app.post("/api/auth/login")
def login(payload: dict):
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    user = db.q1("SELECT * FROM users WHERE username = ?", username)
    if not user or not auth.verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "token": auth.create_token(user),
        "user": {"id": user["id"], "username": user["username"], "role": user["role"]},
    }


@app.post("/api/auth/signup")
def signup(payload: dict):
    """Self-service registration — creates a new regular user account."""
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    confirm = payload.get("confirm") or ""

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if password != confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if db.q1("SELECT id FROM users WHERE username = ?", username):
        raise HTTPException(status_code=409, detail="Username already taken")

    user_id = db.ex(
        "INSERT INTO users (username, password_hash, role, permissions, created_at) VALUES (?,?,?,?,?)",
        username, auth.hash_password(password), "user", json.dumps({"update_rag": False, "add_rag": False, "remove_rag": False}), now(),
    )
    user = db.q1("SELECT * FROM users WHERE id = ?", user_id)
    return {
        "token": auth.create_token(user),
        "user": {"id": user["id"], "username": user["username"], "role": user["role"]},
    }


@app.get("/api/auth/me")
def me(user: dict = Depends(auth.get_current_user)):
    return {"id": user["id"], "username": user["username"], "role": user["role"]}


def _default_permissions_for_role(role: str) -> dict:
    is_admin = role in {"admin", "super_admin"}
    return {
        "update_rag": is_admin,
        "add_rag": is_admin,
        "remove_rag": is_admin,
    }


def _normalize_permissions(raw) -> dict:
    base = _default_permissions_for_role("user")
    if raw is None:
        return base
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (TypeError, ValueError):
            return base
    if not isinstance(raw, dict):
        return base
    return {
        "update_rag": bool(raw.get("update_rag", False)),
        "add_rag": bool(raw.get("add_rag", False)),
        "remove_rag": bool(raw.get("remove_rag", False)),
    }


# ---------------------------------------------------------------------------
# Admin — User Management
# ---------------------------------------------------------------------------
@app.get("/api/admin/users")
def list_users(admin: dict = Depends(auth.require_super_admin)):
    rows = db.q(
        "SELECT id, username, role, permissions, created_at FROM users ORDER BY created_at DESC"
    )
    return {
        "items": [
            {
                "id": row["id"],
                "username": row["username"],
                "role": row["role"],
                "permissions": _normalize_permissions(row["permissions"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


@app.post("/api/admin/users")
def create_user(payload: dict, admin: dict = Depends(auth.require_super_admin)):
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    role = (payload.get("role") or "user").strip()
    permissions = _normalize_permissions(payload.get("permissions"))

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if role not in {"user", "admin"}:
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
    if db.q1("SELECT id FROM users WHERE username = ?", username):
        raise HTTPException(status_code=409, detail="Username already taken")

    user_id = db.ex(
        "INSERT INTO users (username, password_hash, role, permissions, created_at) VALUES (?,?,?,?,?)",
        username,
        auth.hash_password(password),
        role,
        json.dumps(permissions),
        now(),
    )
    return {"ok": True, "id": user_id, "role": role, "permissions": permissions}


@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, admin: dict = Depends(auth.require_super_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if not db.q1("SELECT id FROM users WHERE id = ?", user_id):
        raise HTTPException(status_code=404, detail="User not found")
    db.ex("DELETE FROM users WHERE id = ?", user_id)
    return {"ok": True}


@app.patch("/api/admin/users/{user_id}/role")
def update_user_role(user_id: int, payload: dict, admin: dict = Depends(auth.require_super_admin)):
    """Change a user's role (user/admin/super_admin) without touching the password."""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    new_role = (payload.get("role") or "").strip()
    if new_role not in ("user", "admin", "super_admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user', 'admin', or 'super_admin'")
    if new_role == "super_admin" and admin["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can grant super admin access")
    if not db.q1("SELECT id FROM users WHERE id = ?", user_id):
        raise HTTPException(status_code=404, detail="User not found")
    db.ex("UPDATE users SET role = ? WHERE id = ?", new_role, user_id)
    return {"ok": True, "role": new_role}


@app.patch("/api/admin/users/{user_id}/permissions")
def update_user_permissions(user_id: int, payload: dict, admin: dict = Depends(auth.require_super_admin)):
    if not db.q1("SELECT id FROM users WHERE id = ?", user_id):
        raise HTTPException(status_code=404, detail="User not found")
    permissions = _normalize_permissions(payload.get("permissions"))
    db.ex("UPDATE users SET permissions = ? WHERE id = ?", json.dumps(permissions), user_id)
    return {"ok": True, "permissions": permissions}


@app.get("/api/status")
def status():
    """NVIDIA API health for the UI status pill (no auth needed)."""
    return nvidia_client.health()


# ---------------------------------------------------------------------------
# Feedback / Suggestions
# ---------------------------------------------------------------------------
@app.post("/api/feedback")
def create_feedback(payload: dict, user: dict = Depends(auth.get_current_user)):
    kind = (payload.get("type") or "suggestion").strip().lower() or "suggestion"
    if kind not in {"feedback", "suggestion"}:
        kind = "suggestion"
    title = (payload.get("title") or "").strip()
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Feedback or suggestion text is required")

    feedback_id = db.ex(
        "INSERT INTO feedback (user_id, username, type, title, message, created_at) VALUES (?,?,?,?,?,?)",
        user["id"], user["username"], kind, title or None, message, now(),
    )
    return {"ok": True, "id": feedback_id, "type": kind}


@app.get("/api/feedback/my")
def my_feedback(user: dict = Depends(auth.get_current_user)):
    rows = db.q(
        "SELECT * FROM feedback WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
        user["id"],
    )
    return {
        "items": [
            {
                "id": row["id"],
                "type": row["type"],
                "title": row["title"],
                "message": row["message"],
                "admin_reply": row["admin_reply"],
                "read": bool(row["read_at"]),
                "created_at": row["created_at"],
                "read_at": row["read_at"],
                "replied_at": row["replied_at"],
            }
            for row in rows
        ]
    }


@app.get("/api/feedback")
def list_feedback(admin: dict = Depends(auth.require_admin)):
    rows = db.q(
        "SELECT * FROM feedback WHERE deleted_at IS NULL ORDER BY read_at IS NOT NULL, created_at DESC"
    )
    return {
        "items": [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "username": row["username"],
                "type": row["type"],
                "title": row["title"],
                "message": row["message"],
                "admin_reply": row["admin_reply"],
                "read": bool(row["read_at"]),
                "created_at": row["created_at"],
                "read_at": row["read_at"],
                "replied_at": row["replied_at"],
            }
            for row in rows
        ]
    }


@app.get("/api/feedback/unread-count")
def unread_feedback_count(admin: dict = Depends(auth.require_admin)):
    row = db.q1("SELECT COUNT(*) AS c FROM feedback WHERE read_at IS NULL AND deleted_at IS NULL")
    return {"count": row["c"] if row else 0}


@app.post("/api/feedback/{feedback_id}/read")
def mark_feedback_read(feedback_id: int, admin: dict = Depends(auth.require_admin)):
    if not db.q1("SELECT id FROM feedback WHERE id = ? AND deleted_at IS NULL", feedback_id):
        raise HTTPException(status_code=404, detail="Feedback item not found")
    db.ex("UPDATE feedback SET read_at = ? WHERE id = ? AND read_at IS NULL", now(), feedback_id)
    return {"ok": True}


@app.post("/api/feedback/{feedback_id}/reply")
def reply_to_feedback(feedback_id: int, payload: dict, admin: dict = Depends(auth.require_admin)):
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Reply text is required")
    if not db.q1("SELECT id FROM feedback WHERE id = ? AND deleted_at IS NULL", feedback_id):
        raise HTTPException(status_code=404, detail="Feedback item not found")

    db.ex(
        "UPDATE feedback SET admin_reply = ?, replied_at = ?, read_at = ? WHERE id = ?",
        message,
        now(),
        now(),
        feedback_id,
    )
    return {"ok": True, "reply": message}


@app.delete("/api/feedback/{feedback_id}")
def delete_feedback(feedback_id: int, admin: dict = Depends(auth.require_admin)):
    if not db.q1("SELECT id FROM feedback WHERE id = ?", feedback_id):
        raise HTTPException(status_code=404, detail="Feedback item not found")
    db.ex("UPDATE feedback SET deleted_at = ? WHERE id = ?", now(), feedback_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Taxonomy (admin manages the selection lists)
# ---------------------------------------------------------------------------
VALID_TYPES = {"country", "category", "subcategory", "test"}


@app.get("/api/taxonomy")
def get_taxonomy(user: dict = Depends(auth.get_current_user)):
    """Return the selection lists for building the cascading dropdowns."""
    out = {t: [] for t in VALID_TYPES}
    for row in db.q("SELECT * FROM taxonomy ORDER BY name"):
        if row["type"] in out:
            out[row["type"]].append({"id": row["id"], "name": row["name"]})
    return out


@app.post("/api/taxonomy")
def add_taxonomy_item(payload: dict, admin: dict = Depends(auth.require_admin)):
    t = (payload.get("type") or "").strip()
    name = (payload.get("name") or "").strip()
    if t not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Invalid taxonomy type")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    existing = db.q1("SELECT id FROM taxonomy WHERE type=? AND name=?", t, name)
    if existing:
        return {"id": existing["id"], "name": name}
    new_id = db.ex(
        "INSERT INTO taxonomy (type, name, created_at) VALUES (?,?,?)", t, name, now()
    )
    return {"id": new_id, "name": name}


@app.delete("/api/taxonomy/{item_id}")
def delete_taxonomy_item(item_id: int, admin: dict = Depends(auth.require_admin)):
    db.ex("DELETE FROM taxonomy WHERE id = ?", item_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Study files (PDFs managed by admin)
# ---------------------------------------------------------------------------
def _file_row(r: dict) -> dict:
    return {
        "id": r["id"],
        "filename": r["filename"],
        "size": r["size"],
        "country": r["country"],
        "category": r["category"],
        "subcategory": r["subcategory"],
        "test": r["test"],
        "clauses": r["clauses"],
        "ingested": bool(r["ingested"]),
        "created_at": r["created_at"],
    }


@app.get("/api/files")
def list_files(user: dict = Depends(auth.get_current_user)):
    rows = db.q("SELECT * FROM files ORDER BY created_at DESC")
    return {"files": [_file_row(r) for r in rows]}


@app.post("/api/files/upload")
async def upload_files(
    country: str = Form(""),
    category: str = Form(""),
    subcategory: str = Form(""),
    test: str = Form(""),
    files: List[UploadFile] = File(...),
    admin: dict = Depends(auth.require_admin),
):
    """Admin uploads one or more study PDFs for a course topic.

    Files are copied in bounded chunks so a large PDF is never loaded whole
    into server memory.
    """
    if not (country and category and subcategory and test):
        raise HTTPException(
            status_code=400,
            detail="Select a grade, subject, semester, and unit or lesson topic before uploading.",
        )
    staged = []
    staged_paths = []
    created_ids = []
    try:
        for file in files:
            original_name = file.filename or ""
            if not original_name.lower().endswith(".pdf"):
                continue
            doc_id = uuid.uuid4().hex[:16]
            safe_original_name = Path(original_name.replace("\\", "/")).name or "study.pdf"
            dest = config.UPLOAD_DIR / f"{doc_id}_{safe_original_name}"
            staged_paths.append(dest)
            size = 0
            with dest.open("wb") as target:
                while True:
                    chunk = await file.read(config.UPLOAD_CHUNK_BYTES)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > config.MAX_UPLOAD_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail=(
                                f'"{safe_original_name}" exceeds the '
                                f"{config.MAX_UPLOAD_BYTES // (1024 * 1024)} MB per-file limit."
                            ),
                        )
                    target.write(chunk)
            staged.append({
                "doc_id": doc_id,
                "filename": safe_original_name,
                "stored_path": str(dest),
                "size": size,
            })

        if not staged:
            raise HTTPException(status_code=400, detail="No valid PDF files were uploaded")

        uploaded = []
        for item in staged:
            file_id = db.ex(
                "INSERT INTO files (filename, stored_path, size, country, category, subcategory, test, uploaded_by, clauses, ingested, created_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,0,?)",
                item["filename"], item["stored_path"], item["size"], country, category,
                subcategory, test, admin["id"], 0, now(),
            )
            created_ids.append(file_id)
            uploaded.append({
                "id": file_id,
                "doc_id": item["doc_id"],
                "filename": item["filename"],
                "size": item["size"],
            })
        return {"uploaded": uploaded, "count": len(uploaded)}
    except Exception:
        for file_id in created_ids:
            db.ex("DELETE FROM files WHERE id=?", file_id)
        for path in staged_paths:
            path.unlink(missing_ok=True)
        raise
    finally:
        for file in files:
            await file.close()


def _doc_id_of(row: dict) -> str:
    return Path(row["stored_path"]).name.split("_")[0]


def _ingest_row(
    row: dict,
    progress_callback: Callable[[int, int], None] | None = None,
) -> int:
    """Extract and text-index a study PDF; return the number of indexed sections."""
    doc_id = _doc_id_of(row)
    metadata = {
        "file_id": row["id"],
        "source_file": row["filename"],
        "country": row["country"] or "",
        "category": row["category"] or "",
        "subcategory": row["subcategory"] or "",
        "test": row["test"] or "",
    }
    return rag.ingest_pdf(row["stored_path"], doc_id, metadata, progress_callback)


def _run_index_job(job_id: str, file_id: int) -> None:
    db.ex(
        "UPDATE study_index_jobs SET status='running', updated_at=? WHERE id=?",
        now(), job_id,
    )
    try:
        row = db.q1("SELECT * FROM files WHERE id=?", file_id)
        if not row:
            raise RuntimeError("The study file was deleted before indexing started.")
        page_total = rag.pdf_page_count(row["stored_path"])
        db.ex(
            "UPDATE study_index_jobs SET pages_total=?, updated_at=? WHERE id=?",
            page_total, now(), job_id,
        )

        def update_progress(processed: int, total: int) -> None:
            db.ex(
                "UPDATE study_index_jobs SET pages_processed=?, pages_total=?, updated_at=? WHERE id=?",
                processed, total, now(), job_id,
            )

        count = _ingest_row(row, update_progress)
        db.ex("UPDATE files SET clauses=?, ingested=1 WHERE id=?", count, file_id)
        db.ex(
            "UPDATE study_index_jobs SET status='completed', pages_processed=pages_total, "
            "updated_at=? WHERE id=?",
            now(), job_id,
        )
    except Exception as exc:
        logger.exception("Study PDF indexing job %s failed", job_id)
        db.ex(
            "UPDATE study_index_jobs SET status='failed', error=?, updated_at=? WHERE id=?",
            str(exc)[:1000], now(), job_id,
        )


def _start_index_job(file_id: int, background_tasks: BackgroundTasks, reindex: bool) -> dict:
    row = db.q1("SELECT * FROM files WHERE id=?", file_id)
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    if not reindex and row["ingested"] and rag.is_indexed(_doc_id_of(row)):
        return {"ok": True, "message": "Already indexed", "status": "completed"}

    active_job = db.q1(
        "SELECT id, status FROM study_index_jobs WHERE file_id=? "
        "AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1",
        file_id,
    )
    if active_job:
        return {"ok": True, "job_id": active_job["id"], "status": active_job["status"]}

    job_id = uuid.uuid4().hex
    timestamp = now()
    db.ex(
        "INSERT INTO study_index_jobs "
        "(id, file_id, status, pages_processed, pages_total, created_at, updated_at) "
        "VALUES (?,?, 'queued', 0, 0, ?, ?)",
        job_id, file_id, timestamp, timestamp,
    )
    background_tasks.add_task(_run_index_job, job_id, file_id)
    return {"ok": True, "job_id": job_id, "status": "queued"}


@app.post("/api/files/{file_id}/ingest")
def ingest_file(
    file_id: int,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(auth.require_admin),
):
    """Queue PDF extraction and text indexing without holding the request open."""
    return _start_index_job(file_id, background_tasks, reindex=False)


@app.post("/api/files/{file_id}/reindex")
def reindex_file(
    file_id: int,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(auth.require_admin),
):
    """Queue a fresh text index while keeping the previous index active until ready."""
    return _start_index_job(file_id, background_tasks, reindex=True)


@app.get("/api/files/{file_id}/index-jobs/{job_id}")
def get_index_job(
    file_id: int,
    job_id: str,
    admin: dict = Depends(auth.require_admin),
):
    job = db.q1(
        "SELECT j.id, j.file_id, j.status, j.pages_processed, j.pages_total, "
        "j.error, f.clauses FROM study_index_jobs j "
        "JOIN files f ON f.id=j.file_id WHERE j.id=? AND j.file_id=?",
        job_id, file_id,
    )
    if not job:
        raise HTTPException(status_code=404, detail="Indexing job not found")
    return job


@app.post("/api/files/{file_id}/scope")
def set_file_scope(file_id: int, payload: dict, admin: dict = Depends(auth.require_admin)):
    """Assign/re-assign a document's selection scope (fixes 'unscoped' docs).

    Updates the file row and indexed page metadata without reprocessing the PDF.
    """
    row = db.q1("SELECT * FROM files WHERE id = ?", file_id)
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    active_job = db.q1(
        "SELECT id FROM study_index_jobs WHERE file_id=? "
        "AND status IN ('queued','running') LIMIT 1",
        file_id,
    )
    if active_job:
        raise HTTPException(status_code=409, detail="Wait for PDF indexing to finish before changing its scope.")
    country = payload.get("country") or ""
    category = payload.get("category") or ""
    subcategory = payload.get("subcategory") or ""
    test = payload.get("test") or ""
    if not (country and category and subcategory and test):
        raise HTTPException(status_code=400, detail="All four parameters are required")

    db.ex(
        "UPDATE files SET country=?, category=?, subcategory=?, test=? WHERE id=?",
        country, category, subcategory, test, file_id,
    )
    metadata = {
        "source_file": row["filename"],
        "country": country, "category": category,
        "subcategory": subcategory, "test": test,
    }
    updated = rag.update_scope(_doc_id_of(row), metadata)
    return {"ok": True, "updated": updated}


@app.delete("/api/files/{file_id}")
def delete_file(file_id: int, admin: dict = Depends(auth.require_admin)):
    row = db.q1("SELECT * FROM files WHERE id = ?", file_id)
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    active_job = db.q1(
        "SELECT id FROM study_index_jobs WHERE file_id=? "
        "AND status IN ('queued','running') LIMIT 1",
        file_id,
    )
    if active_job:
        raise HTTPException(status_code=409, detail="Wait for PDF indexing to finish before deleting it.")
    doc_id = Path(row["stored_path"]).name.split("_")[0]
    rag.remove_document(doc_id)
    try:
        Path(row["stored_path"]).unlink(missing_ok=True)
    except OSError:
        pass
    db.ex("DELETE FROM files WHERE id = ?", file_id)
    return {"ok": True}


@app.get("/api/files/{file_id}/pages/{page_number}/preview")
def preview_pdf_page(
    file_id: int,
    page_number: int,
    _user: dict = Depends(auth.get_current_user),
    x0: float | None = Query(default=None, ge=0, le=1),
    y0: float | None = Query(default=None, ge=0, le=1),
    x1: float | None = Query(default=None, ge=0, le=1),
    y1: float | None = Query(default=None, ge=0, le=1),
):
    row = db.q1("SELECT stored_path, ingested FROM files WHERE id=?", file_id)
    if not row:
        raise HTTPException(status_code=404, detail="Study file not found")
    if not row["ingested"]:
        raise HTTPException(status_code=409, detail="Study file is not indexed yet")
    crop_values = (x0, y0, x1, y1)
    if any(value is not None for value in crop_values) and any(value is None for value in crop_values):
        raise HTTPException(status_code=422, detail="All four source excerpt crop coordinates are required.")
    if x0 is not None and y0 is not None and x1 is not None and y1 is not None:
        if x0 >= x1 or y0 >= y1:
            raise HTTPException(status_code=422, detail="Source excerpt crop coordinates must have positive area.")
    try:
        crop = None
        if x0 is not None and y0 is not None and x1 is not None and y1 is not None:
            crop = (x0, y0, x1, y1)
        image = rag.render_pdf_page(row["stored_path"], page_number, crop)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (FileNotFoundError, fitz.FileDataError) as exc:
        raise HTTPException(status_code=422, detail=f"Could not render the study PDF: {exc}") from exc
    return Response(
        content=image,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=60"},
    )


# ---------------------------------------------------------------------------
# Lesson history (stored in the legacy chat tables)
# ---------------------------------------------------------------------------
def _session_row(r: dict) -> dict:
    return {
        "id": r["id"],
        "country": r["country"],
        "category": r["category"],
        "subcategory": r["subcategory"],
        "test": r["test"],
        "title": r["title"] or "New lesson",
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


def _chat_meta(chat_id: int, user_id: int) -> dict:
    row = db.q1("SELECT * FROM chats WHERE id = ? AND user_id = ?", chat_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Chat not found")
    return row


@app.post("/api/chats")
def create_chat(payload: dict, user: dict = Depends(auth.get_current_user)):
    """Create a saved lesson for the selected course and topic."""
    country = payload.get("country") or ""
    category = payload.get("category") or ""
    subcategory = payload.get("subcategory") or ""
    test = payload.get("test") or ""

    if not (country and category and subcategory and test):
        raise HTTPException(status_code=400, detail="All four parameters are required")

    title = (payload.get("title") or f"{category} · {test}").strip()[:80]
    if not title:
        title = "New lesson"
    chat_id = db.ex(
        "INSERT INTO chats (user_id, country, category, subcategory, test, title, created_at, updated_at)"
        " VALUES (?,?,?,?,?,?,?,?)",
        user["id"], country, category, subcategory, test, title, now(), now(),
    )
    return _session_row(db.q1("SELECT * FROM chats WHERE id = ?", chat_id))


@app.get("/api/chats")
def list_chats(user: dict = Depends(auth.get_current_user)):
    rows = db.q("SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC", user["id"])
    return {"chats": [_session_row(r) for r in rows]}


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: int, user: dict = Depends(auth.get_current_user)):
    row = _chat_meta(chat_id, user["id"])
    msgs = db.q("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at", chat_id)
    return {
        "chat": _session_row(row),
        "messages": [
            {
                "id": m["id"],
                "role": m["role"],
                "content": m["content"],
                "sources": db.loads(m["sources"]) or [],
                "qa": db.loads(m["qa"]),
                "created_at": m["created_at"],
            }
            for m in msgs
        ],
    }


@app.patch("/api/chats/{chat_id}")
def rename_chat(chat_id: int, payload: dict, user: dict = Depends(auth.get_current_user)):
    _chat_meta(chat_id, user["id"])
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Chat title is required")
    db.ex("UPDATE chats SET title = ?, updated_at = ? WHERE id = ?", title[:80], now(), chat_id)
    return {"ok": True, "title": title[:80]}


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: int, user: dict = Depends(auth.get_current_user)):
    _chat_meta(chat_id, user["id"])
    db.ex("DELETE FROM messages WHERE chat_id = ?", chat_id)
    db.ex("DELETE FROM chats WHERE id = ?", chat_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Correction Memory (learned rules)
# ---------------------------------------------------------------------------
@app.get("/api/corrections")
def get_corrections(user: dict = Depends(auth.get_current_user)):
    return {"corrections": memory.list_corrections()}


@app.post("/api/corrections")
def create_correction(payload: dict, user: dict = Depends(auth.get_current_user)):
    text = payload.get("text") or ""
    scope = payload.get("scope") or {}
    source = payload.get("source") or ""
    try:
        row = memory.add_correction(text, scope, source, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return row


@app.patch("/api/corrections/{cid}")
def toggle_correction(cid: int, payload: dict, user: dict = Depends(auth.get_current_user)):
    memory.set_active(cid, bool(payload.get("active", True)))
    return {"ok": True}


@app.delete("/api/corrections/{cid}")
def remove_correction(cid: int, user: dict = Depends(auth.get_current_user)):
    memory.delete_correction(cid)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Streaming lesson generation (SSE)
# ---------------------------------------------------------------------------
@app.post("/api/chats/{chat_id}/stream")
def stream_chat(chat_id: int, payload: dict, user: dict = Depends(auth.get_current_user)):
    """Generate a grounded teacher explanation with live token streaming."""
    chat = _chat_meta(chat_id, user["id"])
    question = (payload.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    metadata = {
        "country": chat["country"] or "",
        "category": chat["category"] or "",
        "subcategory": chat["subcategory"] or "",
        "test": chat["test"] or "",
    }

    lesson_mode = payload.get("lesson_mode") is True
    retrieval_query = (payload.get("retrieval_query") or question).strip()
    hits = (
        rag.retrieve_lesson_context(metadata)
        if lesson_mode
        else rag.retrieve(retrieval_query, metadata)
    )
    if not hits:
        raise HTTPException(
            status_code=409,
            detail=(
                "No indexed PDF pages were found for this course selection. "
                "Add and index a study PDF for the selected grade, subject, semester, and unit, then retry."
            ),
        )

    history = []
    if not lesson_mode:
        history_rows = db.q(
            "SELECT role, content, qa FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 12",
            chat_id,
        )
        history = [
            {"role": row["role"], "content": row["content"]}
            for row in reversed(history_rows)
            if row["role"] != "assistant" or not (db.loads(row.get("qa")) or {}).get("rejected")
        ][-6:]
    if not lesson_mode:
        db.ex(
            "INSERT INTO messages (chat_id, role, content, sources, created_at) VALUES (?,?,?,?,?)",
            chat_id, "user", question, None, now(),
        )
        db.ex("UPDATE chats SET updated_at=? WHERE id=?", now(), chat_id)

    async def event_stream() -> AsyncGenerator[str, None]:
        import json

        sources = rag.format_sources(hits)
        yield f"event: sources\ndata: {json.dumps(sources, ensure_ascii=False)}\n\n"

        collected: list = []
        try:
            if lesson_mode:
                for segment_number, hit in enumerate(hits, start=1):
                    yield (
                        f"event: segment\ndata: "
                        f"{json.dumps({'index': segment_number, 'total': len(hits)}, ensure_ascii=False)}\n\n"
                    )
                    segment_hit = {**hit, "segment_number": segment_number}
                    segment_question = (
                        f"{question}\n\nTeach only source excerpt {segment_number}. Return exactly one "
                        f"segment and no other headings. Start with `SEGMENT {segment_number}: ` and a "
                        "brief navigation title on its own line. On the next line, give only the spoken "
                        "explanation."
                    )
                    segment_messages = rag.build_messages(
                        segment_question,
                        [segment_hit],
                        [],
                    )
                    if collected:
                        separator = "\n\n"
                        collected.append(separator)
                        yield f"event: token\ndata: {json.dumps(separator)}\n\n"
                    segment_tokens = []
                    async for delta in nvidia_client.chat_stream_async(segment_messages):
                        segment_tokens.append(delta)
                        collected.append(delta)
                        yield f"event: token\ndata: {json.dumps(delta, ensure_ascii=False)}\n\n"
                    if not "".join(segment_tokens).strip():
                        logger.warning(
                            "NVIDIA returned no streamed content for lesson segment %d; retrying without streaming",
                            segment_number,
                        )
                        fallback = (await nvidia_client.chat_once_async(segment_messages)).strip()
                        if not fallback:
                            raise nvidia_client.NVIDIAError(
                                f"NVIDIA returned an empty explanation for lesson segment {segment_number}, "
                                "including the non-streaming retry."
                            )
                        collected.append(fallback)
                        yield f"event: token\ndata: {json.dumps(fallback, ensure_ascii=False)}\n\n"
            else:
                messages = rag.build_messages(question, hits, history)
                async for delta in nvidia_client.chat_stream_async(messages):
                    collected.append(delta)
                    yield f"event: token\ndata: {json.dumps(delta, ensure_ascii=False)}\n\n"
        except nvidia_client.NVIDIAError as e:
            yield f"event: error\ndata: {json.dumps(str(e))}\n\n"
            return

        full_answer = "".join(collected)

        # Lessons must map one explanation to each supplied excerpt; QA remains for direct answers.
        qa_result = None
        page_issues = (
            rag.lesson_page_issues(full_answer, len(hits))
            if lesson_mode
            else []
        )
        if page_issues:
            qa_result = {
                "score": 0,
                "passed": False,
                "rejected": True,
                "flags": page_issues,
            }
        elif config.QA_ENABLED and full_answer.strip() and not lesson_mode:
            qa_result = qa.verify_answer(question, full_answer, hits)
            if qa_result is not None:
                if config.QA_AUTO_REJECT and not qa_result["passed"]:
                    qa_result["rejected"] = True
        if qa_result is not None:
            yield f"event: qa\ndata: {json.dumps(qa_result, ensure_ascii=False)}\n\n"

        if lesson_mode:
            db.ex(
                "INSERT INTO messages (chat_id, role, content, sources, created_at) VALUES (?,?,?,?,?)",
                chat_id, "user", question, None, now(),
            )
            db.ex("UPDATE chats SET updated_at=? WHERE id=?", now(), chat_id)
        db.ex(
            "INSERT INTO messages (chat_id, role, content, sources, qa, created_at) VALUES (?,?,?,?,?,?)",
            chat_id, "assistant", full_answer, db.dumps(sources),
            db.dumps(qa_result) if qa_result else None, now(),
        )
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Static SPA
# ---------------------------------------------------------------------------
tutor_assets_dir = config.WORKSPACE_ROOT / "Darsync1" / "public" / "assets"
if tutor_assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(tutor_assets_dir)), name="tutor-assets")

if config.FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(config.FRONTEND_DIR)), name="static")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    index = config.FRONTEND_DIR / "index.html"
    if full_path and (config.FRONTEND_DIR / full_path).is_file():
        return FileResponse(str(config.FRONTEND_DIR / full_path))
    if index.exists():
        return FileResponse(str(index))
    return {"detail": "Darsync API is running. Frontend not found."}


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.environ.get("PORT", "8900"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
