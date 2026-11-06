"""
Deterministic canonical SHA-256 Event ID & Rubric Validator for Python research scripts.
Matches src/engine/hash.ts (`computeEventId`) bit-for-bit.
"""
import datetime
import hashlib
import json
import re
from typing import Any, Dict, List, Optional

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


STOP_WORDS = {
    "the", "and", "for", "with", "from", "that", "this", "into", "over", "under", "after", "before",
    "hii", "huntington", "ingalls", "industries", "inc", "corp", "reports", "announces", "announced",
    "reported", "states", "says", "amid", "new", "update", "navy", "us", "u.s", "shipbuilding", "division",
}


def extract_significant_tokens(text: str) -> set[str]:
    s = text.lower()
    s = re.sub(r"cvn[\s-]?(\d+)", r"cvn\1", s)
    s = re.sub(r"ddg[\s-]?(\d+)", r"ddg\1", s)
    s = re.sub(r"ssn[\s-]?(\d+)", r"ssn\1", s)
    s = re.sub(r"lha[\s-]?(\d+)", r"lha\1", s)
    s = re.sub(r"lpd[\s-]?(\d+)", r"lpd\1", s)
    s = re.sub(r"q([1-4])\s*(20\d{2})", r"q\1_\2", s)
    s = re.sub(r"fy\s*(20\d{2})", r"fy\1", s)
    s = re.sub(r"[^a-z0-9_]+", " ", s)
    return {w for w in s.split() if len(w) >= 3 and w not in STOP_WORDS}


def _normalize_url(url: str) -> str:
    u = url.strip().lower()
    u = re.sub(r"^https?://(www\.)?", "", u)
    return u.rstrip("/")


def find_fuzzy_duplicate(cand: Dict[str, Any], pool: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Multi-layer duplicate check for Monday research runs:
      1. Exact SHA-256 content ID match
      2. Specific article permalink URL match (excluding generic root URLs)
      3. Within ±14 days: same fiscal quarter earnings report OR >= 0.40 Jaccard token overlap
    """
    cand_id = cand.get("id")
    for ev in pool:
        if ev.get("id") == cand_id:
            return ev

    cand_urls = {
        _normalize_url(u)
        for u in cand.get("sourceUrls", [])
        if u and "/" in _normalize_url(u) and len([p for p in _normalize_url(u).split("/") if p]) >= 2
    }
    try:
        cand_dt = datetime.datetime.strptime(cand.get("eventDate", ""), "%Y-%m-%d")
    except Exception:
        cand_dt = None

    cand_title = cand.get("title", "")
    cand_tokens = extract_significant_tokens(cand_title)
    cand_q = re.search(r"\bq([1-4])\s*(20\d{2})\b", cand_title.lower())
    cand_is_earnings = cand.get("sourceType") == "earnings" or bool(
        re.search(r"\b(earnings|revenue|eps|results|backlog)\b", cand_title, re.I)
    )

    for ev in pool:
        # Layer 2: Specific article permalink URL match
        if cand_urls and ev.get("sourceUrls"):
            for u in ev.get("sourceUrls", []):
                if _normalize_url(u) in cand_urls:
                    return ev

        # Layer 3: Date window (±14 days) + semantic/token overlap
        if cand_dt is not None:
            try:
                ev_dt = datetime.datetime.strptime(ev.get("eventDate", ""), "%Y-%m-%d")
                days_diff = abs((cand_dt - ev_dt).days)
            except Exception:
                days_diff = 9999

            if days_diff <= 14:
                ev_title = ev.get("title", "")
                ev_q = re.search(r"\bq([1-4])\s*(20\d{2})\b", ev_title.lower())
                ev_is_earnings = ev.get("sourceType") == "earnings" or bool(
                    re.search(r"\b(earnings|revenue|eps|results|backlog)\b", ev_title, re.I)
                )
                if cand_is_earnings and ev_is_earnings and cand_q and ev_q:
                    if cand_q.group(1) == ev_q.group(1) and cand_q.group(2) == ev_q.group(2):
                        return ev

                if len(cand_tokens) >= 2:
                    ev_tokens = extract_significant_tokens(ev_title)
                    if len(ev_tokens) >= 2:
                        inter = len(cand_tokens & ev_tokens)
                        union = len(cand_tokens | ev_tokens)
                        jaccard = inter / union if union > 0 else 0.0
                        min_ov = inter / min(len(cand_tokens), len(ev_tokens))
                        if jaccard >= 0.40 or (inter >= 3 and min_ov >= 0.50):
                            return ev

    return None
