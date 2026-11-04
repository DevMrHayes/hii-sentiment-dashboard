"""
Deterministic canonical SHA-256 Event ID & Rubric Validator for Python research scripts.
Matches src/engine/hash.ts (`computeEventId`) bit-for-bit.
"""
import hashlib
import json
import re
from typing import Any, Dict, List

VALID_AUDIENCES = {"executive", "congress", "navy", "public"}
VALID_SOURCE_TYPES = {
    "hearing",
    "gao_report",
    "crs_report",
    "exec_order",
    "budget_request",
    "navy_statement",
    "contract_award",
    "earnings",
    "stock_move",
    "analyst_rating",
    "news_media",
    "legislation",
    "corporate_action",
}
VALID_DIRECTIONS = {-1, 0, 1}
VALID_MAGNITUDES = {1, 2, 3, 4, 5}
VALID_CREDIBILITIES = {1, 2, 3, 4}
VALID_SCOPES = {"program", "company", "industry", "macro"}
VALID_PERSISTENCE = {"transient", "quarter", "year", "structural"}


def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip()).lower()


def canonical_json(value: Any) -> str:
    if value is None or isinstance(value, (bool, int, float, str)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list):
        return "[" + ",".join(canonical_json(v) for v in value) + "]"
    if isinstance(value, dict):
        keys = sorted(k for k, v in value.items() if v is not None)
        return "{" + ",".join(f"{json.dumps(k)}:{canonical_json(value[k])}" for k in keys) + "}"
    return json.dumps(str(value))


def compute_event_id(title: str, event_date: str, source_type: str) -> str:
    payload = canonical_json(
        {
            "eventDate": event_date.strip(),
            "sourceType": source_type.strip(),
            "title": normalize_title(title),
        }
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f"evt_{digest[:16]}"


def validate_and_normalize_candidate(raw: Dict[str, Any], run_id: str, discovered_at: str) -> Dict[str, Any]:
    title = str(raw.get("title", "")).strip()
    event_date = str(raw.get("eventDate", "2026-11-10")).strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", event_date):
        event_date = "2026-11-10"
    source_type = str(raw.get("sourceType", "news_media")).strip()
    if source_type not in VALID_SOURCE_TYPES:
        source_type = "news_media"

    impacts_in: List[Dict[str, Any]] = raw.get("impacts") or []
    seen_aud = set()
    impacts_out: List[Dict[str, Any]] = []
    for imp in impacts_in:
        aud = str(imp.get("audience", "")).lower().strip()
        aud_map = {"exec": "executive", "cong": "congress", "navy": "navy", "public": "public"}
        aud = aud_map.get(aud, aud)
        if aud not in VALID_AUDIENCES or aud in seen_aud:
            continue
        seen_aud.add(aud)
        direction = int(imp.get("direction", 0))
        if direction not in VALID_DIRECTIONS:
            direction = 1 if direction > 0 else (-1 if direction < 0 else 0)
        magnitude = max(1, min(5, int(imp.get("magnitude", 2))))
        credibility = max(1, min(4, int(imp.get("credibility", 3))))
        scope = str(imp.get("scope", "company")).lower().strip()
        if scope not in VALID_SCOPES:
            scope = "company"
        persistence = str(imp.get("persistence", "quarter")).lower().strip()
        if persistence not in VALID_PERSISTENCE:
            persistence = "quarter"
        impacts_out.append(
            {
                "audience": aud,
                "direction": direction,
                "magnitude": magnitude,
                "credibility": credibility,
                "scope": scope,
                "persistence": persistence,
            }
        )

    if not impacts_out:
        impacts_out.append(
            {
                "audience": "public",
                "direction": 1,
                "magnitude": 2,
                "credibility": 2,
                "scope": "company",
                "persistence": "quarter",
            }
        )

    event_id = compute_event_id(title, event_date, source_type)
    return {
        "id": event_id,
        "title": title,
        "eventDate": event_date,
        "discoveredAt": discovered_at,
        "sourceType": source_type,
        "sourceUrls": list(raw.get("sourceUrls") or ["https://hii.com/news/"]),
        "summary": str(raw.get("summary", "")).strip(),
        "impacts": impacts_out,
        "starred": bool(raw.get("starred", False)),
        "origin": "research",
        "verification": "verified",
        "runId": run_id,
        "editHistory": [],
        "pendingReason": str(
            raw.get(
                "pendingReason",
                f"Discovered by Vertex AI Research Run {run_id} (temperature=0.0 discrete rubric extraction)",
            )
        ),
    }
