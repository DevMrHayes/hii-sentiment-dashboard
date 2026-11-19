"""
Direct Source Link Guard & Validator for HII Sentiment Intelligence.

Ensures every event `sourceUrls` entry points to a specific, human-verifiable
article, filing, bill, GAO/CRS report, contract release, or Federal Register
document — never a generic portal root or search/index repository.
"""

from __future__ import annotations

import re
from typing import Iterable, Optional, Tuple
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx

RESEARCH_USER_AGENT = "HIISentimentDashboard/1.0 (research@hayeshub.local)"

# Authoritative domains allowed to pass ONLY when a URL was discovered via
# trusted Google Search Grounding and blocked by strict edge WAF (HTTP 403).
TRUSTED_403_ALLOWLIST = {
    "congress.gov",
    "gao.gov",
    "crsreports.congress.gov",
    "defense.gov",
    "war.gov",
    "navy.mil",
    "sec.gov",
    "reuters.com",
    "wsj.com",
    "bloomberg.com",
    "defensenews.com",
    "news.usni.org",
    "armed-services.senate.gov",
    "armedservices.house.gov",
    "whitehouse.gov",
    "federalregister.gov",
    "cbo.gov",
    "congress.gov",
    "bidenwhitehouse.archives.gov",
    "trumpwhitehouse.archives.gov",
}

TRACKING_QUERY_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "_ga",
    "cmpid",
}

# Explicit generic repository/hub URLs or synthetic non-numeric article slugs
GENERIC_OR_INVALID_PATTERNS = [
    r"^https?://ir\.hii\.com/?$",
    r"^https?://ir\.hii\.com/(news-releases|financial-information|sec-filings|stock-information)/?$",
    r"^https?://ir\.hii\.com/(stock-info|financials|news-releases)/.*default\.aspx$",
    r"^https?://(www\.)?hii\.com/(newsroom|news|investors|capabilities|what-we-do|who-we-are)/?$",
    r"^https?://(www\.)?defense\.gov/News/Contracts/?$",
    r"^https?://(www\.)?war\.gov/News/Contracts/?$",
    r"^https?://comptroller\.defense\.gov/Budget-Materials/?$",
    r"^https?://(www\.)?whitehouse\.gov/briefing-room/?(presidential-actions|statements-releases)?/?$",
    r"^https?://armedservices\.house\.gov/(committee-activity/hearings|hearings|news)/?$",
    r"^https?://(www\.)?armed-services\.senate\.gov/(hearings|press-releases)/?$",
    r"^https?://(www\.)?gao\.gov/(products|topics|defense|reports-testimonies)?/?$",
    r"^https?://(www\.)?congress\.gov/(search)?/?$",
    r"^https?://crsreports\.congress\.gov/?$",
    r"^https?://news\.usni\.org/?(category/.*)?$",
    r"^https?://(www\.)?defensenews\.com/?(naval|pentagon|industry|congress|land|air)?/?$",
    r"^https?://breakingdefense\.com/?(category/.*|tag/.*)?$",
    r"^https?://www\.maritime-executive\.com/?(magazine|features|editorials)?/?$",
    r"^https?://(www\.)?sec\.gov/edgar/(browse|searchedgar)/?",
    r"^https?://(www\.)?navy\.mil/?(Press-Office/?(News-Stories/?)?)?$",
    # Fabricated non-numeric Navy.mil slugs emitted by earlier local resolver
    r"^https?://(www\.)?navy\.mil/Press-Office/News-Stories/Article/20\d{2}-\d{2}-",
    # Dead synthetic HII subdomains from older seeds
    r"^https?://newsroom\.huntingtoningalls\.com/",
    r"^https?://ir\.huntingtoningalls\.com/",
    # Search / query endpoints
    r"/search/?(\?|$)",
    r"[?&]s=",
    r"^https?://vertexaisearch\.cloud\.google\.com/grounding-api-redirect/",
]

# Deep-link patterns that explicitly qualify a path even if short
VALID_DEEP_PATTERNS = [
    r"sec\.gov/Archives/edgar/data/",
    r"gao\.gov/products/gao-\d{2}-",
    r"congress\.gov/bill/\d+[a-z]{2}-congress/",
    r"congress\.gov/congressional-report/",
    r"federalregister\.gov/documents/\d{4}/",
    r"defense\.gov/News/(Contracts/Contract|Releases/Release|News-Stories/Article)/Article/\d+",
    r"navy\.mil/Press-Office/News-Stories/Article/\d+/",
    r"hii\.com/news/[a-z0-9-]+",
    r"news\.usni\.org/\d{4}/\d{2}/\d{2}/[a-z0-9-]+",
    r"everycrsreport\.com/files/",
    r"crsreports\.congress\.gov/product/pdf/",
    r"sgp\.fas\.org/crs/",
    r"cbo\.gov/publication/\d+",
    r"armed-services\.senate\.gov/hearings/[a-z0-9-]+",
    r"armedservices\.house\.gov/hearings/[a-z0-9-]+",
]


def clean_url(url: str) -> str:
    """Normalizes URL whitespace and strips analytics/tracking query parameters."""
    raw = (url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            return ""
        if parsed.query:
            filtered_qs = [
                (k, v)
                for k, v in parse_qsl(parsed.query, keep_blank_values=True)
                if k.lower() not in TRACKING_QUERY_PARAMS
            ]
            query = urlencode(filtered_qs)
        else:
            query = ""
        cleaned = parsed._replace(query=query, fragment="")
        return urlunparse(cleaned)
    except Exception:
        return ""


def _base_domain(netloc: str) -> str:
    host = (netloc or "").lower().split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    return host


def is_trusted_domain(url: str) -> bool:
    host = _base_domain(urlparse(url).netloc)
    if host in TRUSTED_403_ALLOWLIST:
        return True
    return any(host.endswith("." + d) for d in TRUSTED_403_ALLOWLIST)


def is_generic_hub_url(url: str) -> bool:
    """
    Returns True if a URL points to a generic portal/repository root, category/search
    index, or synthetic unresolvable slug instead of a direct article/document.
    """
    u = (url or "").strip()
    if not u:
        return True

    try:
        parsed = urlparse(u)
    except Exception:
        return True

    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return True

    for pat in GENERIC_OR_INVALID_PATTERNS:
        if re.search(pat, u, re.IGNORECASE):
            return True

    # Explicitly known deep-document shapes override short-segment heuristics
    for pat in VALID_DEEP_PATTERNS:
        if re.search(pat, u, re.IGNORECASE):
            return False

    path = parsed.path.rstrip("/")
    segments = [s for s in path.split("/") if s]
    # Root homepage or single-word top section without query/file identifier is a hub
    if len(segments) == 0:
        return True
    if len(segments) == 1 and not parsed.query:
        # Exceptions: direct article slugs at root only if clearly long article hyphenated slug (>=4 hyphens)
        if segments[0].count("-") >= 4 and len(segments[0]) >= 25:
            return False
        return True

    # Category/tag/archive index pages without an item slug
    lower_path = parsed.path.lower().rstrip("/")
    if any(
        lower_path.endswith(suffix)
        for suffix in (
            "/news",
            "/newsroom",
            "/press-releases",
            "/releases",
            "/articles",
            "/archive",
            "/archives",
            "/topics",
            "/products",
            "/reports",
            "/tag",
            "/category",
        )
    ):
        return True

    return False


async def resolve_grounding_redirect(client: httpx.AsyncClient, url: str) -> Optional[str]:
    """
    Resolves Vertex AI grounding redirect URIs to their true destination URL
    without downloading the destination page during redirect discovery.
    """
    u = (url or "").strip()
    if not u:
        return None
    if "vertexaisearch.cloud.google.com/grounding-api-redirect/" not in u:
        return clean_url(u) or None

    current = u
    try:
        for _ in range(3):
            resp = await client.get(
                current,
                follow_redirects=False,
                timeout=10.0,
                headers={"User-Agent": RESEARCH_USER_AGENT},
            )
            if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("location"):
                loc = clean_url(resp.headers["location"])
                if not loc:
                    return None
                if "vertexaisearch.cloud.google.com/grounding-api-redirect/" in loc:
                    current = loc
                    continue
                return loc
            return clean_url(str(resp.url)) or None
    except Exception:
        return None
    return None


def _looks_like_soft_404(html_snippet: str) -> bool:
    if not html_snippet:
        return False
    m = re.search(r"<title[^>]*>(.*?)</title>", html_snippet, re.IGNORECASE | re.DOTALL)
    if not m:
        return False
    title = re.sub(r"\s+", " ", m.group(1)).strip().lower()
    return any(
        bad in title
        for bad in (
            "404",
            "page not found",
            "not found",
            "document not found",
            "error 404",
            "410 gone",
        )
    )


async def verify_direct_url(
    client: httpx.AsyncClient,
    url: str,
    from_trusted_grounding: bool = False,
) -> Tuple[bool, int, str]:
    """
    Validates that `url` is a live, direct document/article permalink (never a 404 or generic hub).
    Returns: `(ok, http_status, final_url)`.
    """
    u = clean_url(url)
    if not u or is_generic_hub_url(u):
        return False, 0, u

    headers = {
        "User-Agent": RESEARCH_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    }

    try:
        resp = await client.head(u, follow_redirects=True, timeout=12.0, headers=headers)
        status = resp.status_code
        final_url = clean_url(str(resp.url)) or u

        # Many publishers reject HEAD (405) or block generic HEAD probes (403); verify with lightweight GET
        if status in (400, 403, 405, 406, 501):
            async with client.stream("GET", u, follow_redirects=True, timeout=12.0, headers=headers) as get_resp:
                status = get_resp.status_code
                final_url = clean_url(str(get_resp.url)) or u
                if is_generic_hub_url(final_url):
                    return False, status, final_url
                if status in (200, 206):
                    content_type = (get_resp.headers.get("content-type") or "").lower()
                    if "html" in content_type or not content_type:
                        chunk = b""
                        async for part in get_resp.aiter_bytes():
                            chunk += part
                            if len(chunk) >= 16384:
                                break
                        snippet = chunk.decode("utf-8", errors="replace")
                        if _looks_like_soft_404(snippet):
                            return False, 404, final_url
                    return True, status, final_url
                if status == 403 and from_trusted_grounding and is_trusted_domain(final_url):
                    return True, status, final_url
                return False, status, final_url

        if is_generic_hub_url(final_url):
            return False, status, final_url

        if status in (200, 206):
            return True, status, final_url

        if status == 403 and from_trusted_grounding and is_trusted_domain(final_url):
            return True, status, final_url

        return False, status, final_url
    except Exception:
        return False, 0, u


_SCORE_STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "into",
    "over",
    "under",
    "after",
    "before",
    "amid",
    "new",
    "reports",
    "announces",
    "announced",
    "awards",
    "awarded",
    "navy",
    "shipbuilding",
    "hii",
    "huntington",
    "ingalls",
    "industries",
}


def _tokenize(text: str) -> set[str]:
    s = (text or "").lower()
    s = re.sub(r"([a-z]+)-(\d+)", r"\1\2 \1 \2", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return {t for t in s.split() if len(t) >= 3 and t not in _SCORE_STOP_WORDS}


def score_candidate_url(
    url: str,
    title_hint: str,
    event: dict,
    source_rank_bonus: float = 0.0,
) -> float:
    """
    Scores how well a verified direct URL matches the event's domain authority,
    publication date/year, and technical/program keywords.
    """
    if not url or is_generic_hub_url(url):
        return -100.0

    parsed = urlparse(url)
    host = _base_domain(parsed.netloc)
    path_lower = parsed.path.lower()
    ev_title = str(event.get("title", ""))
    ev_date = str(event.get("eventDate", ""))
    ev_year = ev_date[:4] if len(ev_date) >= 4 else ""
    src_type = str(event.get("sourceType", ""))

    score = source_rank_bonus

    # Authority weighting aligned to institutional HII / USG primary sources
    if host == "hii.com" and "/news/" in path_lower:
        score += 38.0
    elif host == "sec.gov" and "/archives/edgar/data/" in path_lower:
        score += 36.0
    elif host == "gao.gov" and "/products/gao-" in path_lower:
        score += 40.0
    elif host == "congress.gov" and ("/bill/" in path_lower or "/congressional-report/" in path_lower):
        score += 36.0
    elif host == "federalregister.gov" and "/documents/" in path_lower:
        score += 36.0
    elif host in ("defense.gov", "war.gov") and "/article/" in path_lower:
        score += 36.0
    elif host == "navy.mil" and re.search(r"/article/\d+", path_lower):
        score += 35.0
    elif host == "news.usni.org":
        score += 32.0
    elif host in ("crsreports.congress.gov", "everycrsreport.com", "sgp.fas.org", "cbo.gov"):
        score += 34.0
    elif host in ("armed-services.senate.gov", "armedservices.house.gov"):
        score += 32.0
    elif host in ("whitehouse.gov", "bidenwhitehouse.archives.gov", "trumpwhitehouse.archives.gov"):
        score += 30.0
    elif host in ("defensenews.com", "breakingdefense.com", "maritime-executive.com", "navalnews.com", "reuters.com", "seapowermagazine.org"):
        score += 26.0
    elif host in ("prnewswire.com", "globenewswire.com", "businesswire.com"):
        score += 22.0
    elif "wikipedia.org" in host:
        score += 6.0
    else:
        score += 12.0

    # Date / year affinity & mismatch penalty
    if ev_year:
        url_years = set(re.findall(r"\b(20[1-2]\d)\b", url + " " + title_hint))
        gao_match = re.search(r"gao-(\d{2})-\d+", path_lower)
        if gao_match:
            gao_yr = "20" + gao_match.group(1)
            url_years.add(gao_yr)
        if ev_year in url_years:
            score += 18.0
        elif str(int(ev_year) + 1) in url_years and src_type in ("legislation", "budget_request", "gao_report"):
            score += 6.0
        elif url_years and src_type not in ("crs_report",):
            # Penalize clear multi-year drift unless timeless CRS explainer
            min_diff = min(abs(int(ev_year) - int(y)) for y in url_years)
            if min_diff >= 2:
                score -= min(28.0, float(min_diff * 5))

    # Semantic token overlap with event title & summary
    ev_tokens = _tokenize(ev_title + " " + str(event.get("summary", ""))[:200])
    cand_tokens = _tokenize(url.replace("-", " ").replace("/", " ") + " " + (title_hint or ""))
    overlap = ev_tokens & cand_tokens
    score += min(32.0, float(len(overlap) * 4.5))

    # Exact GAO number or NDAA congress number bonus
    ev_gao = re.search(r"gao-\d{2}-\d+", ev_title.lower())
    if ev_gao and ev_gao.group(0) in path_lower:
        score += 40.0

    # HII ticker/name presence boost
    if any(k in (url + " " + (title_hint or "")).lower() for k in ("huntington-ingalls", "huntington ingalls", "newport-news", "ingalls", "hii", "cvn", "virginia", "columbia", "ddg", "lha", "lpd", "romulus", "remus", "lionfish")):
        score += 10.0

    return score
