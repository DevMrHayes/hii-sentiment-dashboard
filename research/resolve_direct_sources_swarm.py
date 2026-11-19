#!/usr/bin/env python3
"""
Multi-Agent Direct Source Permalink Resolver Swarm for HII Sentiment Intelligence.

Stage 1: Official Direct-Document Pre-Indexers ($0 LLM cost)
  - SEC EDGAR CIK 0001501585 (2011-2026 8-K, 10-K, 10-Q direct Archives URLs + Ex. 99.1)
  - HII Sitemap (https://www.hii.com/sitemap.xml direct /news/<slug> URLs)
  - Federal Register Presidential Documents API (2011-2026 direct /documents/ URLs)

Stage 2: Parallel Vertex AI Google Search Grounding Workers (10 concurrent async workers)
  - Uses `gemini-2.5-flash` with `tools: [{"google_search": {}}]`
  - Resolves grounding redirect Locations, filters generic hubs via `source_link_guard.py`,
    verifies live HTTP status, and ranks by domain authority + semantic match.

Stage 3: Broadened Grounding Retry + Gemini 4 Argon (`gemini-4-argon`) Semantic Relevance Auditor
  - Broadens searches for weak/unmatched events
  - Uses Argon in batches to select strictly relevant 1-2 URLs per event and reject
    topic/year mismatches (e.g., 2023 GAO link on 2013 events, USV release on CVN-79)
  - Runs final query pass for any Argon-flagged mismatches.

Determinism guarantee: Updates ONLY `sourceUrls` on `data/evidence_ledger.json` and
`data/pending/pending_seed.json`; never alters `id`, `title`, `eventDate`, `sourceType`, or `impacts`.
"""

from __future__ import annotations

import asyncio
import datetime
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

RESEARCH_DIR = Path(__file__).resolve().parent
REPO_ROOT = RESEARCH_DIR.parent
WORKSPACE_ROOT = REPO_ROOT.parent
SCRIPTS_DIR = WORKSPACE_ROOT / "scripts"
LEDGER_FILE = REPO_ROOT / "data" / "evidence_ledger.json"
PENDING_FILE = REPO_ROOT / "data" / "pending" / "pending_seed.json"
AUDIT_OUT_FILE = Path(
    r"C:\Users\hayes\.gemini\antigravity\brain\5113a8d9-e01c-41b6-99df-33dd84b3dcc5\scratch\source_link_audit.json"
)

for p in (str(RESEARCH_DIR), str(SCRIPTS_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from gcp_budget_guard import GCPBudgetGuard  # noqa: E402
from cloud_agent_mesh import strip_markdown_fences  # noqa: E402
from build_authoritative_sources import CONGRESS_BILL_MAP, CRS_PROGRAM_MAP  # noqa: E402
from source_link_guard import (  # noqa: E402
    RESEARCH_USER_AGENT,
    clean_url,
    is_generic_hub_url,
    resolve_grounding_redirect,
    score_candidate_url,
    verify_direct_url,
)

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "gen-lang-client-0353543048")
FLASH_URL = (
    f"https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}"
    f"/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"
)
ARGON_URL = (
    f"https://aiplatform.googleapis.com/v1/projects/{PROJECT_ID}"
    f"/locations/global/publishers/google/models/gemini-4-argon:generateContent"
)


class TokenProvider:
    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._expiry: float = 0.0

    def get(self, force_refresh: bool = False) -> str:
        now = time.time()
        if not force_refresh and self._token and now < self._expiry:
            return self._token
        env = os.environ.copy()
        env["CLOUDSDK_PYTHON"] = sys.executable
        out = subprocess.check_output(
            "gcloud auth print-access-token",
            shell=True,
            text=True,
            timeout=15,
            env=env,
            stderr=subprocess.DEVNULL,
        )
        lines = [ln.strip() for ln in out.splitlines() if ln.strip().startswith("ya29.")]
        if not lines:
            raise RuntimeError("Failed to read gcloud access token")
        self._token = lines[0]
        self._expiry = now + 1500.0
        return self._token


# ---------------------------------------------------------------------------
# Stage 1: Official Direct-Document Pre-Indexers ($0 LLM Cost)
# ---------------------------------------------------------------------------

async def index_sec_edgar(client: httpx.AsyncClient) -> List[Dict[str, str]]:
    """Indexes all HII (CIK 0001501585) 8-K, 10-K, 10-Q filings from 2011 to present."""
    headers = {"User-Agent": RESEARCH_USER_AGENT}
    filings: List[Dict[str, str]] = []

    def _extract_block(block: Dict[str, Any]) -> None:
        forms = block.get("form", [])
        dates = block.get("filingDate", [])
        report_dates = block.get("reportDate", [])
        accs = block.get("accessionNumber", [])
        docs = block.get("primaryDocument", [])
        descs = block.get("primaryDocDescription", [])
        items_list = block.get("items", [])
        for i in range(len(forms)):
            form = str(forms[i])
            if form not in ("8-K", "8-K/A", "10-K", "10-Q"):
                continue
            fdate = str(dates[i])
            if fdate < "2011-01-01":
                continue
            acc = str(accs[i])
            doc = str(docs[i])
            if not acc or not doc:
                continue
            acc_nodash = acc.replace("-", "")
            url = f"https://www.sec.gov/Archives/edgar/data/1501585/{acc_nodash}/{doc}"
            filings.append(
                {
                    "form": form,
                    "filingDate": fdate,
                    "reportDate": str(report_dates[i]) if i < len(report_dates) else "",
                    "acc": acc,
                    "acc_nodash": acc_nodash,
                    "doc": doc,
                    "desc": str(descs[i]) if i < len(descs) else form,
                    "items": str(items_list[i]) if i < len(items_list) else "",
                    "url": url,
                }
            )

    try:
        r = await client.get("https://data.sec.gov/submissions/CIK0001501585.json", headers=headers, timeout=20.0)
        if r.status_code == 200:
            data = r.json()
            _extract_block(data.get("filings", {}).get("recent", {}))
            for fmeta in data.get("filings", {}).get("files", []):
                fname = fmeta.get("name")
                if not fname:
                    continue
                ar = await client.get(f"https://data.sec.gov/submissions/{fname}", headers=headers, timeout=20.0)
                if ar.status_code == 200:
                    _extract_block(ar.json())
    except Exception as exc:
        print(f"[SEC Indexer] Warning: {exc}")

    print(f"[Stage 1] SEC EDGAR indexed {len(filings)} 8-K/10-K/10-Q filings (2011-2026).")
    return filings


async def resolve_sec_ex99_if_available(client: httpx.AsyncClient, filing: Dict[str, str]) -> str:
    """For 8-K filings, tries to find Exhibit 99.1 earnings release HTML, else returns primary 8-K URL."""
    if not filing["form"].startswith("8-K"):
        return filing["url"]
    idx_url = f"https://www.sec.gov/Archives/edgar/data/1501585/{filing['acc_nodash']}/index.json"
    try:
        r = await client.get(idx_url, headers={"User-Agent": RESEARCH_USER_AGENT}, timeout=10.0)
        if r.status_code == 200:
            items = r.json().get("directory", {}).get("item", [])
            for it in items:
                nm = str(it.get("name", ""))
                if re.search(r"(ex.*99|release|earnings|99_1|99-1).*\.(htm|html)$", nm, re.I):
                    return f"https://www.sec.gov/Archives/edgar/data/1501585/{filing['acc_nodash']}/{nm}"
    except Exception:
        pass
    return filing["url"]


async def index_hii_sitemap(client: httpx.AsyncClient) -> List[Dict[str, str]]:
    """Indexes direct `/news/...` release URLs and `<lastmod>` dates from `https://www.hii.com/sitemap.xml`."""
    entries: List[Dict[str, str]] = []
    try:
        r = await client.get(
            "https://www.hii.com/sitemap.xml",
            headers={"User-Agent": RESEARCH_USER_AGENT},
            follow_redirects=True,
            timeout=20.0,
        )
        if r.status_code == 200:
            root = ET.fromstring(r.text)
            for url_el in root.iter():
                if not url_el.tag.endswith("url"):
                    continue
                loc_txt = ""
                lm_txt = ""
                for ch in url_el:
                    if ch.tag.endswith("loc") and ch.text:
                        loc_txt = ch.text.strip()
                    elif ch.tag.endswith("lastmod") and ch.text:
                        lm_txt = ch.text.strip()[:10]
                if loc_txt and "/news/" in loc_txt and not loc_txt.rstrip("/").endswith("/news"):
                    u = loc_txt.replace("https://hii.com/", "https://www.hii.com/")
                    slug = u.rstrip("/").split("/")[-1]
                    entries.append({
                        "url": u,
                        "slug": slug,
                        "title": slug.replace("-", " "),
                        "lastmod": lm_txt,
                    })
    except Exception as exc:
        print(f"[HII Sitemap] Warning: {exc}")

    print(f"[Stage 1] HII Sitemap indexed {len(entries)} news release URLs.")
    return entries


async def index_federal_register(client: httpx.AsyncClient) -> List[Dict[str, str]]:
    """Indexes presidential documents & executive actions relevant to defense/shipbuilding/tariffs (2011-2026)."""
    docs: List[Dict[str, str]] = []
    seen = set()
    queries = [
        "shipbuilding maritime industrial base",
        "sequestration defense budget",
        "steel aluminum tariff proclamation",
        "defense production act naval",
        "355 ship navy",
    ]
    for q in queries:
        try:
            params = [
                ("conditions[term]", q),
                ("conditions[type][]", "PRESDOCU"),
                ("conditions[publication_date][gte]", "2011-01-01"),
                ("per_page", "20"),
            ]
            r = await client.get(
                "https://www.federalregister.gov/api/v1/documents.json",
                params=params,
                headers={"User-Agent": RESEARCH_USER_AGENT},
                timeout=15.0,
            )
            if r.status_code == 200:
                for item in r.json().get("results", []):
                    u = item.get("html_url")
                    if u and u not in seen:
                        seen.add(u)
                        docs.append(
                            {
                                "url": u,
                                "title": item.get("title", ""),
                                "date": item.get("publication_date", ""),
                            }
                        )
        except Exception:
            pass
    print(f"[Stage 1] Federal Register indexed {len(docs)} presidential documents.")
    return docs


def match_preindexed_candidates(
    event: dict,
    sec_filings: List[Dict[str, str]],
    hii_news: List[Dict[str, str]],
    fed_docs: List[Dict[str, str]],
) -> List[Dict[str, Any]]:
    """Finds high-signal pre-indexed SEC, HII sitemap, Congress/CRS/GAO, and Federal Register matches."""
    ev_date = event.get("eventDate", "")
    ev_title = event.get("title", "").lower()
    ev_summary = event.get("summary", "").lower()
    ev_blob = f"{ev_title} {ev_summary}"
    src_type = event.get("sourceType", "")
    cands: List[Dict[str, Any]] = []

    try:
        ev_dt = datetime.datetime.strptime(ev_date, "%Y-%m-%d").date()
    except Exception:
        ev_dt = None

    # 1. Match SEC EDGAR filings for corporate/earnings/stock/analyst events with quarter compatibility
    if ev_dt and src_type in ("earnings", "corporate_action", "stock_move", "analyst_rating"):
        q_expected: Optional[str] = None
        for qk in ("q1", "q2", "q3", "q4"):
            if re.search(rf"\b{qk}\b", ev_title):
                q_expected = qk
                break
        window_days = 10
        for f in sec_filings:
            try:
                fdt = datetime.datetime.strptime(f["filingDate"], "%Y-%m-%d").date()
            except Exception:
                continue
            diff = abs((ev_dt - fdt).days)
            if diff <= window_days:
                if q_expected and f.get("reportDate"):
                    rmonth = f["reportDate"][5:7]
                    q_month_map = {"q1": "03", "q2": "06", "q3": "09", "q4": "12"}
                    if rmonth in ("03", "06", "09", "12") and rmonth != q_month_map[q_expected] and f["form"] in ("10-Q", "10-K"):
                        continue
                if any(k in ev_title for k in ("q1", "q2", "q3", "q4", "results", "earnings", "guidance", "backlog")):
                    if f["form"].startswith("8-K") or f["form"] in ("10-Q", "10-K"):
                        cands.append({
                            "url": f["url"],
                            "title_hint": f"SEC {f['form']} (filed {f['filingDate']}, period {f.get('reportDate', '')}) HII filing",
                            "trusted": True,
                            "origin": "sec_edgar",
                            "bonus": 22.0 - diff * 1.5 + (6.0 if f["form"].startswith("8-K") else 3.0),
                            "_filing": f,
                        })
                elif diff <= 5:
                    cands.append({
                        "url": f["url"],
                        "title_hint": f"SEC {f['form']} (filed {f['filingDate']}) HII filing",
                        "trusted": True,
                        "origin": "sec_edgar",
                        "bonus": 15.0 - diff * 1.5,
                        "_filing": f,
                    })

    # 2. Match HII sitemap ONLY when year matches `<lastmod>` year (prevents 2026 slugs on 2011-2025 events)
    #    and ONLY for HII corporate/contract/navy/media events (never GAO/CRS/legislation/hearings).
    if src_type in ("earnings", "corporate_action", "contract_award", "navy_statement", "stock_move", "news_media"):
        stop_words = {
            "the", "and", "for", "with", "from", "hii", "huntington", "ingalls",
            "industries", "navy", "shipbuilding", "announces", "reports", "awards",
            "contract", "shipyard", "newport", "news", "program", "class", "awarded",
        }
        ev_tokens = set(re.findall(r"[a-z0-9]{3,}", re.sub(r"([a-z]+)-(\d+)", r"\1\2 \1 \2", ev_title))) - stop_words
        ev_yr = ev_date[:4]
        ev_q = next((q for q in ("q1", "q2", "q3", "q4") if re.search(rf"\b{q}\b", ev_title)), None)
        q_words = {"q1": ("first", "q1"), "q2": ("second", "q2"), "q3": ("third", "q3"), "q4": ("fourth", "q4")}

        for entry in hii_news:
            lm = entry.get("lastmod", "")
            # Sitemap entries all carry lastmod in 2026+; strictly require same calendar year as eventDate
            if not lm or lm[:4] != ev_yr:
                continue
            if ev_dt:
                try:
                    lm_dt = datetime.datetime.strptime(lm, "%Y-%m-%d").date()
                    if abs((ev_dt - lm_dt).days) > 45:
                        continue
                except Exception:
                    pass
            slug_lower = entry["slug"].lower()
            if ev_q and any(w in slug_lower for w in ("quarter", "q1", "q2", "q3", "q4")):
                if not any(w in slug_lower for w in q_words[ev_q]):
                    continue
            slug_tokens = set(re.findall(r"[a-z0-9]{3,}", re.sub(r"([a-z]+)-(\d+)", r"\1\2 \1 \2", slug_lower))) - stop_words
            overlap = ev_tokens & slug_tokens
            if len(overlap) >= 2:
                cands.append({
                    "url": entry["url"],
                    "title_hint": f"HII Release ({lm}): {entry['title']}",
                    "trusted": True,
                    "origin": "hii_sitemap",
                    "bonus": 14.0 + len(overlap) * 5.0,
                })

    # 3. Match exact GAO report numbers (gao-XX-YYYYY) & CRS codes / Congress NDAA bill maps
    for gao_m in re.findall(r"gao-\d{2}-\d+", ev_blob):
        cands.append({
            "url": f"https://www.gao.gov/products/{gao_m}",
            "title_hint": f"GAO Report {gao_m.upper()}",
            "trusted": False,
            "origin": "gao_exact",
            "bonus": 26.0,
        })
    if src_type == "crs_report":
        seen_crs_urls = set()
        for crs_key, crs_url in CRS_PROGRAM_MAP.items():
            if crs_url in seen_crs_urls:
                continue
            crs_code = crs_url.rsplit("/", 1)[-1].lower()
            if crs_key.lower() in ev_blob or crs_code in ev_blob:
                seen_crs_urls.add(crs_url)
                cands.append({
                    "url": crs_url,
                    "title_hint": f"CRS Report {crs_code.upper()} ({crs_key})",
                    "trusted": True,
                    "origin": "crs_map",
                    "bonus": 18.0,
                })
    if src_type == "legislation":
        fy_m = re.search(r"fy\s*(20[1-2]\d)", ev_blob)
        if fy_m and "ndaa" in ev_blob:
            fy = int(fy_m.group(1))
            bill_u = CONGRESS_BILL_MAP.get(fy)
            if bill_u and not is_generic_hub_url(bill_u):
                cands.append({
                    "url": bill_u,
                    "title_hint": f"FY{fy} NDAA Congress.gov Bill Permalink",
                    "trusted": True,
                    "origin": "congress_map",
                    "bonus": 24.0,
                })

    # 4. Match Federal Register presidential actions for exec_order / budget_request
    if ev_dt and src_type in ("exec_order", "budget_request"):
        for d in fed_docs:
            try:
                ddt = datetime.datetime.strptime(d["date"], "%Y-%m-%d").date()
            except Exception:
                continue
            if abs((ev_dt - ddt).days) <= 21:
                cands.append({
                    "url": d["url"],
                    "title_hint": f"Federal Register ({d['date']}): {d['title']}",
                    "trusted": True,
                    "origin": "federal_register",
                    "bonus": 16.0,
                })

    return cands


# ---------------------------------------------------------------------------
# Stage 2: Parallel Vertex AI Google Search Grounding Workers
# ---------------------------------------------------------------------------

def build_grounding_query(event: dict, broaden: bool = False) -> str:
    title = event.get("title", "")
    date = event.get("eventDate", "")
    year = date[:4]
    ym = date[:7]
    src_type = event.get("sourceType", "news_media")

    if broaden:
        # Simplified entity + year query for broader recall
        clean_title = re.sub(r"[\(\)\$\%]", " ", title)
        words = [w for w in clean_title.split() if len(w) >= 3][:10]
        return (
            f"Find real news articles, SEC filings, official Navy/DoD releases, or USNI News articles about "
            f"Huntington Ingalls Industries ({year}): {' '.join(words)}. "
            f"Return direct article or document URLs only, never site homepages or newsroom index pages."
        )

    domain_hint = {
        "earnings": "Prefer direct HII press release (hii.com/news/...), SEC 8-K/10-Q/10-K Archives URL, Reuters, WSJ, or USNI News article covering these specific quarterly/annual results.",
        "corporate_action": "Prefer direct HII press release (hii.com/news/...), SEC filing, USNI News, or Defense News article about this exact corporate or labor event.",
        "contract_award": "Prefer direct USNI News article, Defense.gov specific contract release (Contract/Article/<numeric-id>), HII press release (hii.com/news/...), Naval News, Breaking Defense, or Defense News article.",
        "navy_statement": "Prefer direct USNI News article, Navy.mil numeric Press-Office Article URL, Defense.gov specific article, HII press release, or Breaking Defense article.",
        "gao_report": "Find the exact GAO report permalink on gao.gov/products/gao-... or official GAO PDF or USNI News article discussing this exact GAO audit.",
        "crs_report": "Find the exact CRS report PDF or permanent link (congress.gov, crsreports.congress.gov, everycrsreport.com, or usni.org discussion of this CRS report).",
        "legislation": "Find the exact Congress.gov bill permalink (congress.gov/bill/...) for that specific NDAA, Continuing Resolution, or budget law, plus USNI News article.",
        "hearing": "Find the exact Senate/House Armed Services hearing page or USNI News / Defense News article covering that specific hearing.",
        "exec_order": "Find the exact Federal Register presidential document (federalregister.gov/documents/...), White House presidential action permalink, or USNI News / Defense News article covering this specific directive.",
        "budget_request": "Find the exact USNI News, Breaking Defense, Defense News, CBO, or DoD Comptroller specific budget release article covering this specific budget year proposal.",
        "stock_move": "Find direct Reuters, Barron's, MarketWatch, Yahoo Finance, WSJ, SEC filing, or defense trade news article covering HII stock movement on/near this date.",
        "analyst_rating": "Find direct equity analyst rating news article (Reuters, Investing.com, MarketBeat, Defense Daily, SeekingAlpha, WSJ) about HII upgrade/downgrade/price target near this date.",
        "news_media": "Find direct USNI News, Defense News, Breaking Defense, Reuters, or WSJ article covering this specific development.",
    }.get(src_type, "Find direct verifiable primary source or defense journalism article URLs.")

    return (
        f"Event Date: {date} ({ym})\n"
        f"Source Type: {src_type}\n"
        f"Event Title: {title}\n"
        f"Summary: {event.get('summary', '')[:260]}\n\n"
        f"Search Google to locate the direct, specific primary article, press release, Congressional bill, "
        f"GAO/CRS report, Federal Register document, or defense journalism permalink for this exact event.\n"
        f"{domain_hint}\n"
        f"Do NOT return portal roots like hii.com/newsroom, defense.gov/News/Contracts/, or ir.hii.com/stock-info/."
    )


async def call_vertex_grounding(
    client: httpx.AsyncClient,
    token_provider: TokenProvider,
    budget_guard: GCPBudgetGuard,
    event: dict,
    broaden: bool = False,
    retries: int = 3,
    custom_query: Optional[str] = None,
) -> List[Dict[str, str]]:
    """Calls Gemini 2.5 Flash with Google Search Grounding and returns raw grounding chunk URLs."""
    allowed, msg, _ = budget_guard.can_proceed()
    if not allowed:
        raise RuntimeError(f"Budget circuit breaker engaged: {msg}")

    if custom_query:
        prompt = (
            f"Search Google to locate the direct primary document, Congressional bill, GAO/CRS report, "
            f"SEC filing, Federal Register order, official press release, or defense journalism article for: "
            f"{custom_query}. Return direct article or document URLs only, never site homepages or newsroom index pages."
        )
    else:
        prompt = build_grounding_query(event, broaden=broaden)
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        # Minimum 2048 avoids HTTP 400 INVALID_ARGUMENT when Gemini 2.5 Flash allocates thinking + grounding tokens
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 2048},
    }

    last_err = None
    for attempt in range(retries):
        try:
            tok = token_provider.get()
            t0 = time.perf_counter()
            resp = await client.post(
                FLASH_URL,
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json=payload,
                timeout=35.0,
            )
            elapsed = time.perf_counter() - t0
            if resp.status_code == 429 or resp.status_code >= 500:
                await asyncio.sleep(1.5 * (attempt + 1))
                continue
            if resp.status_code == 400 and not broaden:
                # Retry immediately with simplified clean query on HTTP 400
                payload = {
                    "contents": [{"role": "user", "parts": [{"text": build_grounding_query(event, broaden=True)}]}],
                    "tools": [{"google_search": {}}],
                    "generationConfig": {"temperature": 0.0, "maxOutputTokens": 2048},
                }
                await asyncio.sleep(0.5)
                continue
            if resp.status_code != 200:
                last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
                await asyncio.sleep(1.0)
                continue

            data = resp.json()
            usage = data.get("usageMetadata", {})
            budget_guard.record_usage(
                model="gemini-2.5-flash",
                role="grounding_resolver",
                prompt_tokens=usage.get("promptTokenCount", 0),
                candidates_tokens=usage.get("candidatesTokenCount", 0),
                thoughts_tokens=usage.get("thoughtsTokenCount", 0),
                elapsed_sec=elapsed,
                task_summary=f"Grounding URL lookup: {event['id']}",
            )

            cand0 = data.get("candidates", [{}])[0]
            gm = cand0.get("groundingMetadata", {})
            chunks = gm.get("groundingChunks", [])
            out: List[Dict[str, str]] = []
            for ch in chunks:
                web = ch.get("web", {})
                u = web.get("uri")
                t = web.get("title", "")
                if u:
                    out.append({"uri": u, "title": t})
            return out
        except Exception as exc:
            last_err = str(exc)
            await asyncio.sleep(1.5 * (attempt + 1))

    if last_err:
        print(f"  [WARN] Grounding failed for {event['id']}: {last_err}")
    return []


# ---------------------------------------------------------------------------
# Stage 3: Argon Semantic Relevance Auditor
# ---------------------------------------------------------------------------

async def call_argon_audit_batch(
    client: httpx.AsyncClient,
    token_provider: TokenProvider,
    budget_guard: GCPBudgetGuard,
    batch_items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Asks Gemini 4 Argon to pick the strictly relevant 1-2 URLs per event and flag any mismatch."""
    allowed, msg, _ = budget_guard.can_proceed()
    if not allowed:
        raise RuntimeError(f"Budget circuit breaker engaged: {msg}")

    system_inst = (
        "You are the Principal Defense Research Source Verifier (Argon Tier) for Huntington Ingalls Industries (NYSE: HII).\n"
        "For each event below, review its eventDate, sourceType, title, and verified candidate direct URLs.\n"
        "Select 1 to 2 URLs that DIRECTLY document or corroborate that specific event (exact SEC filing from that week/quarter, enacted Congress.gov bill/CR/NDAA, GAO/CRS report, ship milestone, budget proposal, executive order, or defense news article about that event).\n"
        "CRITICAL QUALITY RULES:\n"
        "1. STRICTLY REJECT any URL from the wrong year, wrong quarter, or wrong program (e.g., reject a 2023 GAO report on a 2013 event; reject 2026 Romulus USV / Charleston releases on CVN-79 or DOGE; reject Q1/Q2 10-Q on Q3 event; reject unrelated NDAA bill years).\n"
        "2. Note that some events in historical/forecast ledgers may reference an approximate date or generalized macro trend — major real legislation, SEC 8-K/10-Q/10-K filings, White House EOs, USNI/Defense News coverage of that specific policy/milestone ARE valid direct sources even if exact day differs by a few days.\n"
        "3. If NONE of the candidate URLs genuinely document or corroborate the event, set \"selected_urls\": [], \"needs_broader_search\": true, concise keyword \"better_query\", and \"synthetic_or_unverified\": true.\n"
        "Output ONLY valid JSON mapping event id -> {\"selected_urls\": [...], \"needs_broader_search\": bool, \"better_query\": str, \"synthetic_or_unverified\": bool}."
    )

    payload = {
        "systemInstruction": {"role": "system", "parts": [{"text": system_inst}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(batch_items, indent=1)}]}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
        },
    }

    for attempt in range(3):
        try:
            tok = token_provider.get()
            t0 = time.perf_counter()
            resp = await client.post(
                ARGON_URL,
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json=payload,
                timeout=240.0,
            )
            elapsed = time.perf_counter() - t0
            if resp.status_code == 429 or resp.status_code >= 500:
                await asyncio.sleep(2.0 * (attempt + 1))
                continue
            if resp.status_code != 200:
                print(f"  [WARN] Argon audit batch HTTP {resp.status_code}: {resp.text[:200]}")
                return {}
            data = resp.json()
            usage = data.get("usageMetadata", {})
            budget_guard.record_usage(
                model="gemini-4-argon",
                role="architect",
                prompt_tokens=usage.get("promptTokenCount", 0),
                candidates_tokens=usage.get("candidatesTokenCount", 0),
                thoughts_tokens=usage.get("thoughtsTokenCount", 0),
                elapsed_sec=elapsed,
                task_summary=f"Argon semantic audit batch ({len(batch_items)} events)",
            )
            txt = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
            cleaned = strip_markdown_fences(txt)
            return json.loads(cleaned)
        except Exception as exc:
            print(f"  [WARN] Argon audit batch attempt {attempt + 1} error: {exc!r}")
            await asyncio.sleep(2.0)
    return {}


async def main() -> None:
    budget_guard = GCPBudgetGuard()
    token_provider = TokenProvider()

    with open(LEDGER_FILE, "r", encoding="utf-8") as f:
        ledger_events: List[Dict[str, Any]] = json.load(f)
    with open(PENDING_FILE, "r", encoding="utf-8") as f:
        pending_events: List[Dict[str, Any]] = json.load(f)

    all_records = [("ledger", i, ev) for i, ev in enumerate(ledger_events)] + [
        ("pending", i, ev) for i, ev in enumerate(pending_events)
    ]
    print(f"Loaded {len(ledger_events)} ledger + {len(pending_events)} pending = {len(all_records)} total events.")

    verify_cache: Dict[str, Tuple[bool, int, str]] = {}
    verify_locks: Dict[str, asyncio.Lock] = {}

    async def cached_verify(client: httpx.AsyncClient, url: str, trusted: bool) -> Tuple[bool, int, str]:
        u = clean_url(url)
        if not u or is_generic_hub_url(u):
            return False, 0, u
        key = f"{u}|{1 if trusted else 0}"
        if key in verify_cache:
            return verify_cache[key]
        if key not in verify_locks:
            verify_locks[key] = asyncio.Lock()
        async with verify_locks[key]:
            if key in verify_cache:
                return verify_cache[key]
            res = await verify_direct_url(client, u, from_trusted_grounding=trusted)
            verify_cache[key] = res
            return res

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        # ---------------- STAGE 1 ----------------
        sec_filings, hii_news, fed_docs = await asyncio.gather(
            index_sec_edgar(client),
            index_hii_sitemap(client),
            index_federal_register(client),
        )

        # ---------------- STAGE 2 ----------------
        sem_grounding = asyncio.Semaphore(10)
        sem_http = asyncio.Semaphore(18)

        async def resolve_single_event(ev: dict, broaden: bool = False) -> List[Dict[str, Any]]:
            # 1) Pre-indexed direct matches
            pool: List[Dict[str, Any]] = match_preindexed_candidates(ev, sec_filings, hii_news, fed_docs)

            # 2) Existing URLs (only kept if non-hub)
            for old_u in ev.get("sourceUrls", []):
                cu = clean_url(old_u)
                if cu and not is_generic_hub_url(cu):
                    pool.append({
                        "url": cu,
                        "title_hint": "existing",
                        "trusted": False,
                        "origin": "existing",
                        "bonus": 0.0,
                    })

            # 3) Vertex Google Search Grounding
            async with sem_grounding:
                raw_chunks = await call_vertex_grounding(client, token_provider, budget_guard, ev, broaden=broaden)

            for ch in raw_chunks:
                resolved_u = await resolve_grounding_redirect(client, ch["uri"])
                if resolved_u and not is_generic_hub_url(resolved_u):
                    pool.append({
                        "url": resolved_u,
                        "title_hint": ch.get("title", ""),
                        "trusted": True,
                        "origin": "vertex_grounding",
                        "bonus": 8.0,
                    })

            # Deduplicate pool by normalized clean_url keeping highest trusted/bonus
            best_by_url: Dict[str, Dict[str, Any]] = {}
            for item in pool:
                u = clean_url(item["url"])
                if not u or is_generic_hub_url(u):
                    continue
                prev = best_by_url.get(u)
                if prev is None or (item["trusted"] and not prev["trusted"]) or item["bonus"] > prev["bonus"]:
                    item["url"] = u
                    best_by_url[u] = item

            # Live HTTP check concurrently
            async def _check(cand: Dict[str, Any]) -> Optional[Dict[str, Any]]:
                async with sem_http:
                    ok, status, final_u = await cached_verify(client, cand["url"], cand["trusted"])
                if not ok:
                    return None
                u_use = final_u if (final_u and not is_generic_hub_url(final_u)) else cand["url"]
                if cand.get("_filing") and cand["origin"] == "sec_edgar":
                    # Try Exhibit 99.1 HTML if primary filing is 8-K
                    ex_u = await resolve_sec_ex99_if_available(client, cand["_filing"])
                    if ex_u != cand["url"]:
                        ex_ok, ex_st, ex_final = await cached_verify(client, ex_u, True)
                        if ex_ok:
                            u_use = ex_final
                            status = ex_st
                s = score_candidate_url(u_use, cand["title_hint"], ev, source_rank_bonus=cand["bonus"])
                return {
                    "url": u_use,
                    "title_hint": cand["title_hint"],
                    "origin": cand["origin"],
                    "http_status": status,
                    "score": round(s, 2),
                }

            verified_raw = await asyncio.gather(*[_check(c) for c in best_by_url.values()])
            verified: Dict[str, Dict[str, Any]] = {}
            for v in verified_raw:
                if v is None:
                    continue
                existing_v = verified.get(v["url"])
                if existing_v is None or v["score"] > existing_v["score"]:
                    verified[v["url"]] = v

            ranked = sorted(verified.values(), key=lambda x: x["score"], reverse=True)
            return ranked[:6]

        print(f"[Stage 2] Dispatching parallel grounding + HTTP verification across {len(all_records)} events...")
        stage2_candidates = await asyncio.gather(
            *[resolve_single_event(ev, broaden=False) for _, _, ev in all_records]
        )

        # ---------------- STAGE 3a: Retry events with 0 candidates or low score ----------------
        weak_indices = [
            idx
            for idx, cands in enumerate(stage2_candidates)
            if len(cands) == 0 or cands[0]["score"] < 35.0
        ]
        print(f"[Stage 3a] Broadening grounding search for {len(weak_indices)} weak/unmatched events...")
        if weak_indices:
            retry_tasks = [resolve_single_event(all_records[i][2], broaden=True) for i in weak_indices]
            retry_results = await asyncio.gather(*retry_tasks)
            for idx, new_cands in zip(weak_indices, retry_results):
                merged = {c["url"]: c for c in stage2_candidates[idx]}
                for c in new_cands:
                    if c["url"] not in merged or c["score"] > merged[c["url"]]["score"]:
                        merged[c["url"]] = c
                stage2_candidates[idx] = sorted(merged.values(), key=lambda x: x["score"], reverse=True)[:6]

        # ---------------- STAGE 3b: Argon Semantic Relevance Auditor ----------------
        batch_size = 12
        sem_argon = asyncio.Semaphore(4)

        async def _argon_limited(batch_items: List[Dict[str, Any]]) -> Dict[str, Any]:
            async with sem_argon:
                return await call_argon_audit_batch(client, token_provider, budget_guard, batch_items)
        audit_batches: List[List[Dict[str, Any]]] = []
        for start in range(0, len(all_records), batch_size):
            batch = []
            for idx in range(start, min(len(all_records), start + batch_size)):
                _, _, ev = all_records[idx]
                cands = stage2_candidates[idx]
                batch.append(
                    {
                        "id": ev["id"],
                        "eventDate": ev["eventDate"],
                        "sourceType": ev["sourceType"],
                        "title": ev["title"],
                        "candidates": [
                            {"url": c["url"], "hint": c["title_hint"], "origin": c["origin"], "score": c["score"]}
                            for c in cands
                        ],
                    }
                )
            audit_batches.append(batch)

        print(f"[Stage 3b] Invoking Gemini 4 Argon across {len(audit_batches)} batches for semantic relevance audit...")
        argon_maps = await asyncio.gather(
            *[_argon_limited(b) for b in audit_batches]
        )
        argon_verdicts: Dict[str, Any] = {}
        for m in argon_maps:
            if isinstance(m, dict):
                argon_verdicts.update(m)

        # Follow-up pass for events Argon marked needs_broader_search
        followup_indices = [
            idx
            for idx, (_, _, ev) in enumerate(all_records)
            if argon_verdicts.get(ev["id"], {}).get("needs_broader_search")
            and argon_verdicts.get(ev["id"], {}).get("better_query")
        ]
        print(f"[Stage 3c] Executing Argon-guided targeted retry for {len(followup_indices)} flagged events...")

        async def _targeted_retry(idx: int) -> None:
            _, _, ev = all_records[idx]
            better_q = str(argon_verdicts[ev["id"]]["better_query"])
            async with sem_grounding:
                raw_chunks = await call_vertex_grounding(
                    client,
                    token_provider,
                    budget_guard,
                    ev,
                    broaden=True,
                    custom_query=better_q,
                )
            extra: List[Dict[str, Any]] = []
            for ch in raw_chunks:
                ru = await resolve_grounding_redirect(client, ch["uri"])
                if ru and not is_generic_hub_url(ru):
                    async with sem_http:
                        ok, st, final_u = await cached_verify(client, ru, True)
                    if ok:
                        u_use = final_u if (final_u and not is_generic_hub_url(final_u)) else ru
                        extra.append({
                            "url": u_use,
                            "title_hint": ch.get("title", ""),
                            "origin": "argon_retry",
                            "http_status": st,
                            "score": round(score_candidate_url(u_use, ch.get("title", ""), ev, 12.0), 2),
                        })
            if extra:
                # Preserve existing non-rejected candidates plus newly grounded retry candidates
                prev_selected = set(clean_url(u) for u in argon_verdicts.get(ev["id"], {}).get("selected_urls", []))
                kept = [c for c in stage2_candidates[idx] if c["url"] in prev_selected or c["origin"] not in ("hii_sitemap",)]
                merged = {c["url"]: c for c in kept}
                for c in extra:
                    if c["url"] not in merged or c["score"] > merged[c["url"]]["score"]:
                        merged[c["url"]] = c
                stage2_candidates[idx] = sorted(merged.values(), key=lambda x: x["score"], reverse=True)[:8]

        if followup_indices:
            await asyncio.gather(*[_targeted_retry(idx) for idx in followup_indices])

            # ---------------- STAGE 3d: Final Argon Pass on Retried Events ----------------
            followup_batches: List[List[Dict[str, Any]]] = []
            for start in range(0, len(followup_indices), 12):
                sub_ids = followup_indices[start : start + 12]
                fb = []
                for idx in sub_ids:
                    _, _, ev = all_records[idx]
                    cands = stage2_candidates[idx]
                    fb.append(
                        {
                            "id": ev["id"],
                            "eventDate": ev["eventDate"],
                            "sourceType": ev["sourceType"],
                            "title": ev["title"],
                            "candidates": [
                                {"url": c["url"], "hint": c["title_hint"], "origin": c["origin"], "score": c["score"]}
                                for c in cands
                            ],
                        }
                    )
                followup_batches.append(fb)
            print(f"[Stage 3d] Running final Argon semantic audit on {len(followup_indices)} retried events across {len(followup_batches)} batches...")
            followup_maps = await asyncio.gather(
                *[_argon_limited(b) for b in followup_batches]
            )
            for fm in followup_maps:
                if isinstance(fm, dict):
                    argon_verdicts.update(fm)

    # Assemble final sourceUrls (strictly modifying ONLY `sourceUrls`)
    updated_ledger = 0
    zero_verified: List[Dict[str, Any]] = []
    audit_rows: List[Dict[str, Any]] = []

    for idx, (bucket, pos, ev) in enumerate(all_records):
        old_urls = list(ev.get("sourceUrls", []))
        cands = stage2_candidates[idx]
        valid_pool_urls = {c["url"] for c in cands}

        # Use Argon-selected URLs when they are verified candidates in our verified pool
        pool_by_norm = {u.rstrip("/"): u for u in valid_pool_urls}
        av = argon_verdicts.get(ev["id"], {})
        selected = [
            pool_by_norm[clean_url(u).rstrip("/")]
            for u in av.get("selected_urls", [])
            if clean_url(u).rstrip("/") in pool_by_norm and not is_generic_hub_url(clean_url(u))
        ]

        # Only supplement from top candidates if Argon selected >= 1 valid URL (and didn't mark synthetic),
        # or if Argon had no verdict at all (API error) and score is strong.
        is_flagged_unverified = bool(av.get("synthetic_or_unverified", False)) or (
            ev["id"] in argon_verdicts and not selected
        )
        if not selected and not is_flagged_unverified and cands and cands[0]["score"] >= 50.0:
            selected = [c["url"] for c in cands[:2]]
        elif len(selected) == 1 and len(cands) > 1 and not bool(av.get("synthetic_or_unverified", False)):
            for c in cands:
                if c["url"] != selected[0] and c["score"] >= 58.0 and c["origin"] in ("sec_edgar", "congress_map", "gao_exact", "federal_register", "vertex_grounding", "argon_retry"):
                    selected.append(c["url"])
                    break

        selected = list(dict.fromkeys(selected))[:2]

        if not selected:
            # Never retain generic hubs. If Argon explicitly reviewed and rejected all candidates,
            # leave no link rather than attaching an unrelated document.
            kept_old = [u for u in old_urls if not is_generic_hub_url(u)]
            if ev["id"] in argon_verdicts:
                kept_old = []
            if kept_old != old_urls:
                ev["sourceUrls"] = kept_old
                updated_ledger += 1
            zero_verified.append({
                "bucket": bucket,
                "id": ev["id"],
                "eventDate": ev["eventDate"],
                "sourceType": ev["sourceType"],
                "title": ev["title"],
                "old_urls": old_urls,
                "argon_synthetic": bool(av.get("synthetic_or_unverified", False)),
                "top_candidates": [c["url"] for c in cands[:3]],
            })
        else:
            if selected != old_urls:
                ev["sourceUrls"] = selected
                updated_ledger += 1

        audit_rows.append({
            "bucket": bucket,
            "id": ev["id"],
            "eventDate": ev["eventDate"],
            "sourceType": ev["sourceType"],
            "title": ev["title"],
            "old_urls": old_urls,
            "new_urls": ev["sourceUrls"] if selected else [],
            "argon_flagged": bool(av.get("needs_broader_search", False)),
            "argon_synthetic": bool(av.get("synthetic_or_unverified", False)),
            "verified_candidate_count": len(cands),
            "top_score": cands[0]["score"] if cands else 0.0,
        })

    # Write outputs only if <=10 unresolved synthetic edge cases (per Re-plan threshold)
    AUDIT_OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    b_status = budget_guard.get_status_report()
    with open(AUDIT_OUT_FILE, "w", encoding="utf-8") as af:
        json.dump(
            {
                "total_events": len(all_records),
                "updated_events": updated_ledger,
                "unresolved_count": len(zero_verified),
                "unresolved_events": zero_verified,
                "budget_status": b_status,
                "events": audit_rows,
            },
            af,
            indent=2,
        )

    print(f"\n[Summary] Total={len(all_records)} | Updated={updated_ledger} | Unresolved={len(zero_verified)}")
    print(f"[Budget] Month spend: ${b_status['current_spend_usd']:.4f} / ${b_status['monthly_limit_usd']:.2f} ({b_status['utilization_pct']}%)")

    if len(zero_verified) > 10:
        print(f"[NOTICE] {len(zero_verified)} events have no Argon-verified source; hubs stripped. See audit JSON.")

    with open(LEDGER_FILE, "w", encoding="utf-8") as f:
        json.dump(ledger_events, f, indent=2)
    with open(PENDING_FILE, "w", encoding="utf-8") as f:
        json.dump(pending_events, f, indent=2)
    print(f"Saved updated {LEDGER_FILE} and {PENDING_FILE}.")


if __name__ == "__main__":
    asyncio.run(main())
