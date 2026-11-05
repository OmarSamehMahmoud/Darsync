"""SQLite persistence layer for Darsync.

A single shared connection guarded by a re-entrant lock keeps the code simple
and is more than fast enough for this multi-user but low-QPS tool.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import unicodedata
from typing import Any, Iterable, Optional

from . import config

_lock = threading.RLock()
_conn = sqlite3.connect(str(config.DB_PATH), check_same_thread=False)
_conn.row_factory = sqlite3.Row
_ARABIC_SEARCH_TRANSLATION = str.maketrans({
    "\u0622": "\u0627",
    "\u0623": "\u0627",
    "\u0625": "\u0627",
    "\u0671": "\u0627",
    "\u0649": "\u064a",
})


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    permissions   TEXT NOT NULL DEFAULT '{"update_rag": false, "add_rag": false, "remove_rag": false}',
    created_at    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS taxonomy (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,            -- country | category | subcategory | test
    name       TEXT NOT NULL,
    created_at REAL NOT NULL,
    UNIQUE(type, name)
);

CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filename    TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    size        INTEGER NOT NULL,
    country     TEXT,
    category    TEXT,
    subcategory TEXT,
    test        TEXT,
    uploaded_by INTEGER,
    clauses     INTEGER DEFAULT 0,
    ingested    INTEGER DEFAULT 0,
    created_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    country     TEXT,
    category    TEXT,
    subcategory TEXT,
    test        TEXT,
    title       TEXT,
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id    INTEGER NOT NULL,
    role       TEXT NOT NULL,            -- user | assistant
    content    TEXT NOT NULL,
    sources    TEXT,                     -- JSON array of source dicts
    qa         TEXT,                     -- JSON QA-gate verdict for assistant msgs
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS corrections (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    text       TEXT NOT NULL,            -- the learned rule / correction
    scope      TEXT,                     -- JSON {country,category,subcategory,test} or NULL = global
    source     TEXT,                     -- optional: what triggered it
    active     INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    username    TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'suggestion',
    title       TEXT,
    message     TEXT NOT NULL,
    admin_reply TEXT,
    read_at     REAL,
    replied_at  REAL,
    deleted_at  REAL,
    created_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS study_documents (
    doc_id        TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS study_pages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id          TEXT NOT NULL,
    generation_id   TEXT NOT NULL,
    file_id         INTEGER NOT NULL,
    page            INTEGER NOT NULL,
    part            INTEGER NOT NULL,
    number          TEXT NOT NULL,
    title           TEXT NOT NULL,
    source_file     TEXT NOT NULL,
    country         TEXT NOT NULL,
    category        TEXT NOT NULL,
    subcategory     TEXT NOT NULL,
    test            TEXT NOT NULL,
    text            TEXT NOT NULL,
    region_json     TEXT NOT NULL DEFAULT '[]',
    search_text     TEXT NOT NULL DEFAULT '',
    UNIQUE(generation_id, page, part)
);

CREATE TABLE IF NOT EXISTS study_index_jobs (
    id              TEXT PRIMARY KEY,
    file_id         INTEGER NOT NULL,
    status          TEXT NOT NULL,
    pages_processed INTEGER NOT NULL DEFAULT 0,
    pages_total     INTEGER NOT NULL DEFAULT 0,
    error           TEXT,
    created_at      REAL NOT NULL,
    updated_at      REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_pages_scope
    ON study_pages(country, category, subcategory, test, generation_id);
CREATE INDEX IF NOT EXISTS idx_study_pages_file ON study_pages(file_id);
CREATE INDEX IF NOT EXISTS idx_study_pages_clause ON study_pages(number, doc_id, generation_id);
CREATE INDEX IF NOT EXISTS idx_study_jobs_file ON study_index_jobs(file_id, created_at);
CREATE VIRTUAL TABLE IF NOT EXISTS study_pages_fts
    USING fts5(title, text, search_text, content='study_pages', content_rowid='id', tokenize='unicode61');

CREATE TRIGGER IF NOT EXISTS study_pages_ai AFTER INSERT ON study_pages BEGIN
    INSERT INTO study_pages_fts(rowid, title, text, search_text)
    VALUES (new.id, new.title, new.text, new.search_text);
END;
CREATE TRIGGER IF NOT EXISTS study_pages_ad AFTER DELETE ON study_pages BEGIN
    INSERT INTO study_pages_fts(study_pages_fts, rowid, title, text, search_text)
    VALUES ('delete', old.id, old.title, old.text, old.search_text);
END;
CREATE TRIGGER IF NOT EXISTS study_pages_au AFTER UPDATE ON study_pages BEGIN
    INSERT INTO study_pages_fts(study_pages_fts, rowid, title, text, search_text)
    VALUES ('delete', old.id, old.title, old.text, old.search_text);
    INSERT INTO study_pages_fts(rowid, title, text, search_text)
    VALUES (new.id, new.title, new.text, new.search_text);
END;

CREATE INDEX IF NOT EXISTS idx_chats_user   ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_msg_chat     ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_tax_type     ON taxonomy(type);
"""


def init() -> None:
    """Create tables and seed defaults on first run."""
    import time

    from . import auth

    with _lock:
        rebuild_study_fts = _migrate_study_fts()
        _conn.executescript(SCHEMA)
        if rebuild_study_fts:
            _conn.execute("INSERT INTO study_pages_fts(study_pages_fts) VALUES ('rebuild')")
        _conn.commit()

        # Lightweight migration: add columns introduced after the first release
        # without wiping existing databases.
        msg_cols = {r["name"] for r in _conn.execute("PRAGMA table_info(messages)").fetchall()}
        if "qa" not in msg_cols:
            _conn.execute("ALTER TABLE messages ADD COLUMN qa TEXT")
            _conn.commit()

        page_cols = {r["name"] for r in _conn.execute("PRAGMA table_info(study_pages)").fetchall()}
        if "region_json" not in page_cols:
            _conn.execute("ALTER TABLE study_pages ADD COLUMN region_json TEXT NOT NULL DEFAULT '[]'")
            _conn.commit()

        feedback_cols = {r["name"] for r in _conn.execute("PRAGMA table_info(feedback)").fetchall()}
        for col_name, col_type in {
            "admin_reply": "TEXT",
            "replied_at": "REAL",
            "deleted_at": "REAL",
        }.items():
            if col_name not in feedback_cols:
                _conn.execute(f"ALTER TABLE feedback ADD COLUMN {col_name} {col_type}")
        _conn.commit()

        user_cols = {r["name"] for r in _conn.execute("PRAGMA table_info(users)").fetchall()}
        if "permissions" not in user_cols:
            _conn.execute(
                "ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '{\"update_rag\": false, \"add_rag\": false, \"remove_rag\": false}'"
            )
            _conn.commit()

        default_admin = _conn.execute(
            "SELECT * FROM users WHERE username = ?",
            (config.DEFAULT_ADMIN_USERNAME,),
        ).fetchone()
        if default_admin is None:
            _conn.execute(
                "INSERT INTO users (username, password_hash, role, permissions, created_at) VALUES (?,?,?,?,?)",
                (
                    config.DEFAULT_ADMIN_USERNAME,
                    auth.hash_password(config.DEFAULT_ADMIN_PASSWORD),
                    "super_admin",
                    json.dumps({"update_rag": True, "add_rag": True, "remove_rag": True}),
                    time.time(),
                ),
            )
        else:
            _conn.execute(
                "UPDATE users SET role = ?, permissions = ? WHERE username = ?",
                (
                    "super_admin",
                    json.dumps({"update_rag": True, "add_rag": True, "remove_rag": True}),
                    config.DEFAULT_ADMIN_USERNAME,
                ),
            )

        _seed_taxonomy(_conn, time.time())
        _conn.commit()


def _migrate_study_fts() -> bool:
    """Normalize legacy indexed text without changing its display text."""
    tables = {
        row["name"]
        for row in _conn.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
        ).fetchall()
    }
    if "study_pages" not in tables:
        return False

    page_columns = {
        row["name"] for row in _conn.execute("PRAGMA table_info(study_pages)").fetchall()
    }
    rebuild = False
    if "search_text" not in page_columns:
        _conn.execute("DROP TRIGGER IF EXISTS study_pages_ai")
        _conn.execute("DROP TRIGGER IF EXISTS study_pages_ad")
        _conn.execute("DROP TRIGGER IF EXISTS study_pages_au")
        _conn.execute("ALTER TABLE study_pages ADD COLUMN search_text TEXT NOT NULL DEFAULT ''")
        rows = _conn.execute("SELECT id, title, text FROM study_pages").fetchall()
        _conn.executemany(
            "UPDATE study_pages SET search_text=? WHERE id=?",
            (
                (normalize_search_text(f"{row['title']}\n{row['text']}"), row["id"])
                for row in rows
            ),
        )
        rebuild = True

    fts_exists = "study_pages_fts" in tables
    if fts_exists:
        fts_columns = {
            row["name"]
            for row in _conn.execute("PRAGMA table_info(study_pages_fts)").fetchall()
        }
        if not {"title", "text", "search_text"}.issubset(fts_columns):
            _conn.execute("DROP TRIGGER IF EXISTS study_pages_ai")
            _conn.execute("DROP TRIGGER IF EXISTS study_pages_ad")
            _conn.execute("DROP TRIGGER IF EXISTS study_pages_au")
            _conn.execute("DROP TABLE study_pages_fts")
            rebuild = True
    else:
        rebuild = True

    return rebuild


def normalize_search_text(text: str) -> str:
    """Canonicalize Arabic OCR forms for matching while preserving source text."""
    normalized = unicodedata.normalize("NFKC", text)
    output = []
    for character in normalized:
        if character == "\u0640" or unicodedata.category(character) == "Mn":
            continue
        output.append(character.translate(_ARABIC_SEARCH_TRANSLATION))
    return "".join(output)


def _seed_taxonomy(conn: sqlite3.Connection, created_at: float) -> None:
    """Apply the Egyptian-primary defaults once without altering saved records."""
    taxonomy_version = conn.execute(
        "SELECT value FROM app_settings WHERE key = ?",
        ("taxonomy_preset",),
    ).fetchone()
    if taxonomy_version is None:
        conn.execute("DELETE FROM taxonomy")
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?, ?)",
            ("taxonomy_preset", "egypt_primary_v1"),
        )

    for taxonomy_type, names in config.SEED_TAXONOMY.items():
        for name in names:
            conn.execute(
                "INSERT OR IGNORE INTO taxonomy (type, name, created_at) VALUES (?,?,?)",
                (taxonomy_type, name, created_at),
            )


# ---------------------------------------------------------------------------
# Low level helpers
# ---------------------------------------------------------------------------
def q(sql: str, *params: Any) -> list[dict]:
    with _lock:
        rows = _conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def q1(sql: str, *params: Any) -> Optional[dict]:
    rows = q(sql, *params)
    return rows[0] if rows else None


def ex(sql: str, *params: Any) -> int:
    """Execute a write statement, return lastrowid."""
    with _lock:
        cur = _conn.execute(sql, params)
        _conn.commit()
        return cur.lastrowid or 0


def exec(sql: str, *params: Any) -> int:
    """Execute a write statement and return the affected-row count."""
    with _lock:
        cur = _conn.execute(sql, params)
        _conn.commit()
        return cur.rowcount


def executemany(sql: str, rows: Iterable[Iterable[Any]]) -> int:
    with _lock:
        cur = _conn.executemany(sql, rows)
        _conn.commit()
        return cur.rowcount


def activate_study_generation(doc_id: str, generation_id: str) -> None:
    with _lock:
        try:
            _conn.execute(
                "INSERT INTO study_documents (doc_id, generation_id) VALUES (?,?) "
                "ON CONFLICT(doc_id) DO UPDATE SET generation_id=excluded.generation_id",
                (doc_id, generation_id),
            )
            _conn.execute(
                "DELETE FROM study_pages WHERE doc_id=? AND generation_id<>?",
                (doc_id, generation_id),
            )
            _conn.commit()
        except sqlite3.Error:
            _conn.rollback()
            raise


def now() -> float:
    import time

    return time.time()


def loads(value: Optional[str]) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return None


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


__all__ = [
    "init", "q", "q1", "ex", "exec", "executemany", "now", "loads", "dumps",
    "normalize_search_text",
]
