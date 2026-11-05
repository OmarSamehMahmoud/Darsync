"""Correction Memory — the post's "every correction is saved; the same mistake
never happens twice".

Admins/users teach the assistant *rules* (from corrections they make). Active
rules are injected into the system prompt of future chats so the agent applies
them automatically. Rules can be **global** (apply everywhere) or **scoped** to a
specific Country/Category/Sub Category/Test Type selection.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from . import database as db
from .database import now

SCOPE_KEYS = ("country", "category", "subcategory", "test")


def _row(r: dict) -> dict:
    scope = db.loads(r["scope"]) or {}
    return {
        "id": r["id"],
        "text": r["text"],
        "scope": scope,
        "global": not any(scope.get(k) for k in SCOPE_KEYS),
        "source": r["source"] or "",
        "active": bool(r["active"]),
        "created_at": r["created_at"],
    }


def add_correction(text: str, scope: Optional[Dict], source: str, user_id: int) -> dict:
    text = (text or "").strip()
    if not text:
        raise ValueError("Correction text is required")
    scope = scope or {}
    scope_clean = {k: (scope.get(k) or "") for k in SCOPE_KEYS}
    cid = db.ex(
        "INSERT INTO corrections (text, scope, source, active, created_by, created_at)"
        " VALUES (?,?,?,1,?,?)",
        text, db.dumps(scope_clean), source or "", user_id, now(),
    )
    return _row(db.q1("SELECT * FROM corrections WHERE id = ?", cid))


def list_corrections() -> List[dict]:
    rows = db.q("SELECT * FROM corrections ORDER BY created_at DESC")
    return [_row(r) for r in rows]


def set_active(cid: int, active: bool) -> None:
    db.ex("UPDATE corrections SET active=? WHERE id=?", 1 if active else 0, cid)


def delete_correction(cid: int) -> None:
    db.ex("DELETE FROM corrections WHERE id=?", cid)


def _scope_matches(scope: Dict, metadata: Dict) -> bool:
    """A global rule (no scope fields) matches everything; a scoped rule matches
    only if every non-empty scope field equals the chat's metadata."""
    if not any(scope.get(k) for k in SCOPE_KEYS):
        return True  # global
    for k in SCOPE_KEYS:
        want = scope.get(k)
        if want and want != (metadata.get(k) or ""):
            return False
    return True


def relevant_corrections(metadata: Dict, limit: int = 20) -> List[dict]:
    """Active rules that apply to the given selection (global + matching scope)."""
    rows = db.q("SELECT * FROM corrections WHERE active=1 ORDER BY created_at DESC")
    out = []
    for r in rows:
        scope = db.loads(r["scope"]) or {}
        if _scope_matches(scope, metadata or {}):
            out.append(_row(r))
        if len(out) >= limit:
            break
    return out


def build_memory_block(corrections: List[dict]) -> str:
    """Render learned rules into a prompt block (empty string if none)."""
    if not corrections:
        return ""
    lines = ["LEARNED RULES (from past corrections — follow these strictly):"]
    for i, c in enumerate(corrections, start=1):
        lines.append(f"{i}. {c['text']}")
    return "\n".join(lines)
