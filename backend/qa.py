"""QA Gate — a second-pass verifier for teacher explanations.

Implements the "QA Gate 95/100" idea from the source post: after an answer is
generated, a strict judge model scores how *grounded* it is in the retrieved study-material
context. Anything below the threshold is flagged (or rejected).

The judge returns structured JSON:
    {"score": 0-100, "grounded": bool, "issues": [...], "verdict": "..."}

If the model can't produce valid JSON, we fall back to a citation-coverage
heuristic (do the sections the explanation cites exist in the context?).
"""
from __future__ import annotations

import json
import re
from typing import Dict, List

from . import config, nvidia_client, rag

JUDGE_SYSTEM = """You are a strict QA auditor for an AI teacher.
You are given the STUDY-MATERIAL CONTEXT that was supplied to the teacher, and
the TEACHER EXPLANATION. Judge whether the explanation is fully grounded in
that context — no invented facts or incorrect source citations.

Audit checklist:
1. HALLUCINATION — flag any statement NOT supported by the context.
2. CITATION ACCURACY — flag any cited section number that is not in the context.
3. OVERREACH — flag explanations that go beyond what the source material states.

Scoring: 100 = every claim is supported and all citations are correct.
Deduct heavily for invented facts or wrong citations.

Return ONLY a JSON object, no prose, exactly this shape:
{"score": <integer 0-100>, "grounded": <true|false>,
 "issues": ["<specific unsupported claim or wrong citation>", ...],
 "verdict": "<one short sentence>"}"""


def _extract_json(text: str) -> Dict | None:
    """Best-effort extraction of a JSON object from model output."""
    if not text:
        return None
    # Strip code fences if present.
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?|```$", "", cleaned, flags=re.MULTILINE).strip()
    # Find the first {...} block.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    snippet = cleaned[start : end + 1]
    try:
        data = json.loads(snippet)
        if isinstance(data, dict):
            return data
    except ValueError:
        return None
    return None


def _heuristic_score(answer: str, hits: List[Dict]) -> Dict:
    """Fallback when the judge can't return JSON.

    Approximate grounding by checking that section numbers cited in the answer
    actually exist among the retrieved context sections.
    """
    context_numbers = {h.get("number", "") for h in hits}
    # Section-like tokens in the explanation, e.g. 7.3, 11.8, Annex A.
    cited = set(re.findall(r"\b\d{1,2}(?:\.\d{1,3}){1,4}\b", answer))
    cited |= set(re.findall(r"Annex\s+[A-Z]", answer, flags=re.IGNORECASE))
    if not cited:
        # No citations to verify — neutral-mid score.
        return {"score": 60, "grounded": False,
                "issues": ["No section citations found to verify against context."],
                "verdict": "Heuristic check (judge unavailable): no citations detected."}
    bad = [c for c in cited if c not in context_numbers]
    ratio = 1 - (len(bad) / max(len(cited), 1))
    score = int(round(ratio * 100))
    issues = [f"Cited section {c} not present in retrieved context." for c in bad]
    return {
        "score": score,
        "grounded": not bad,
        "issues": issues,
        "verdict": "Heuristic check (judge unavailable): citation coverage only.",
    }


def verify_answer(question: str, answer: str, hits: List[Dict]) -> Dict:
    """Run the QA judge; return a normalized verdict dict."""
    context = rag.build_context_block(hits)
    user = (
        f"STUDY-MATERIAL CONTEXT:\n{context}\n\n"
        f"---\nSTUDENT REQUEST:\n{question}\n\n"
        f"---\nTEACHER EXPLANATION:\n{answer}\n"
    )
    messages = [
        {"role": "system", "content": JUDGE_SYSTEM},
        {"role": "user", "content": user},
    ]

    try:
        raw = nvidia_client.chat_once(messages, json_mode=True)
        data = _extract_json(raw)
    except nvidia_client.NVIDIAError:
        data = None

    if not data:
        data = _heuristic_score(answer, hits)

    # Normalize + clamp.
    try:
        score = int(data.get("score", 0))
    except (TypeError, ValueError):
        score = 0
    score = max(0, min(100, score))
    grounded = bool(data.get("grounded", score >= config.QA_THRESHOLD))
    issues = data.get("issues") or []
    if not isinstance(issues, list):
        issues = [str(issues)]
    verdict = str(data.get("verdict") or "").strip() or "QA verification complete."

    return {
        "score": score,
        "grounded": grounded,
        "passed": score >= config.QA_THRESHOLD,
        "threshold": config.QA_THRESHOLD,
        "issues": issues,
        "verdict": verdict,
    }
