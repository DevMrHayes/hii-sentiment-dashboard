# HII Sentiment Intelligence Dashboard

A deterministic, multi-audience sentiment intelligence and 6-month scenario forecasting platform for **Huntington Ingalls Industries (NYSE: HII)** spanning **2011–Present**.

🌐 **Live Production Deployment:** [https://hii-sentiment-intel.web.app](https://hii-sentiment-intel.web.app)  
🔐 **Access Control:** Single-tenant Google OAuth admin wall (`hayesorhaze@gmail.com`) with in-app access request queue and Cloud Firestore security rules.

---

## 🏛️ Executive Architecture & Key Capabilities

### 1. Four Stakeholder Perspectives + Weighted Composite
- **Executive Branch (`executive`)**: White House Executive Orders, Maritime Administration/Directorate directives, OMB President's Budget Requests, Title III Defense Production Act capital matching grants.
- **U.S. Congress (`congress`)**: HASC/SASC authorization hearings, Defense Appropriations markups, Continuing Resolutions, GAO shipbuilding supply chain audits, and Congressional Research Service (CRS) reports.
- **Department of the Navy (`navy`)**: SECNAV/CNO 30-Year Shipbuilding Plans, NAVSEA contract definitizations & multi-year procurements, INSURV sea trials, and Submarine Industrial Base (SIB) capital investments.
- **American Public & Capital Markets (`public`)**: NYSE:HII stock price trajectory vs. S&P Aerospace & Defense peers, quarterly earnings & Free Cash Flow guidance, Wall Street equity analyst ratings, labor union negotiations (USW Local 8888, Pascagoula Metal Trades), and national media sentiment.
- **Composite Score**: Real-time weighted index across all four stakeholder audiences with configurable weight profiles.

---

### 2. HII Business Division Breakdown (`/divisions`)
Dedicated operating division intelligence isolating performance across HII's three core reporting divisions:
- **Newport News Shipbuilding (NNS)** (55% operating footprint): Nuclear aircraft carriers (CVN 78 *Ford*, CVN 79 *Kennedy*, CVN 80 *Enterprise*), *Virginia*-class fast attack submarines, and *Columbia*-class ballistic missile submarine modules.
- **Ingalls Shipbuilding** (35% operating footprint): *Arleigh Burke*-class Flight III guided missile destroyers (DDG 51), *America*-class amphibious assault ships (LHA), and *San Antonio*-class amphibious transport docks (LPD).
- **Mission Technologies** (10% operating footprint): Defense AI, REMUS / LDUUV unmanned undersea systems, C5ISR, cyber operations, and live-virtual-constructive fleet training.
- **Program Impact Waterfall**: Direct causal tracking showing how individual program milestones or friction points (e.g. CVN 79 weapons elevators or supply-chain lead times) ripple into divisional and composite sentiment.
- **Enterprise Rollup Explainer**: Mathematical transparency detailing how division operational footprints roll into the enterprise composite score.

---

### 3. 100% Deterministic Scoring Engine (`engine-v1.0.0`)
- **Integer Basis-Point Math**: All sentiment computations, time-decay functions, and composite weights operate strictly with 64-bit integer basis points (`BigInt` Round-Half-To-Even) over an immutable, content-addressed Evidence Ledger.
- **Bit-Identical Reproducibility**: Regenerating scores over the same evidence produces bit-identical `ledgerHash` and `outputHash` values across any OS, browser, or runtime.
- **Retroactive Revision Auditing**: When new retroactive evidence or historical corrections are staged and approved, the engine automatically records an immutable `ScoreRevision` log attributing changes to specific periods and audiences.

---

### 4. Variable Time Granularity & 6-Month Forecast
- **Historical Timeline**:
  - **Annual Periods**: `2011` through `2025`
  - **Quarterly Periods**: `2026-Q1`, `2026-Q2`, `2026-Q3`
  - **Monthly Granularity**: `2026-10` and `2026-11` (Dynamic As-Of `2026-11-05`)
- **Deterministic 6-Month Forecast (`2026-12` – `2027-05`)**:
  - Expected Value (EV) trajectory coupled with analytic `[P10 – P90]` confidence envelopes driven by active catalyst probabilities.

---

### 5. Multi-Layer Fuzzy & Semantic Deduplication Engine
Integrated into both the Vertex AI automated Monday sweeps and frontend ledger ingestion:
- **Layer 1 (Exact SHA-256 ID)**: Bit-identical canonical JSON hash (`computeEventId`).
- **Layer 2 (Article Permalink URL Matching)**: Normalizes deep article URLs and rejects matching permalinks across the committed ledger and quarantine queue.
- **Layer 3 (±14-Day Date Window + Domain Entity / Quarter Collision)**:
  - Normalizes shipbuilding hull designations (`CVN-79`, `DDG-51`, `SSN-798`, `Q3 2026`, `FY 2027`) and strips corporate boilerplate.
  - Automatically identifies same fiscal-quarter earnings reports regardless of source categorization.
  - Computes Jaccard token similarity over significant domain keywords (blocking duplicates at `>= 40%` overlap).

---

### 6. Executive UI/UX & Mobile Responsiveness
- **High-Contrast Executive Slate Theme**: Balanced blend of White and Charcoal (`#24272a`) with Deep Sea (`#003b4d`), Sky Blue (`#75abd1`), Changing Sea (`#509ca2`), Steel (`#5b6670`), and Passion (`#ea7722`) as purposeful accents.
- **Official HII Brand Identity**: Authentic HII vector logo header with live audit proof hash indicator and dynamic As-Of date display.
- **Expandable Timeline Graph**: Wide-aspect timeline view that expands across page width without skews or vertical distortion.
- **Interactive Pinned Milestones**: Star and pin critical events directly onto the timeline curve with accurate basis-point pills (`+1.40 pts`) for executive briefings.
- **Dynamic Auto-Clearing Notification Badges**: Unread badge counters track viewed tabs and reset to `0` upon inspection.
- **Sanity Check Logging**: In-app audit module on the Weekly Research tab enabling users to log specific anomalies (e.g. Public vs. Stock Price divergence) for targeted deep research verification on the next agent run.

---

## 🚀 Live Deployment & Firebase Infrastructure

The application is deployed directly to **Google Cloud Firebase Hosting** under project `gen-lang-client-0353543048`.

- **Production URL**: [https://hii-sentiment-intel.web.app](https://hii-sentiment-intel.web.app)
- **Secondary Domain**: [https://hii-sentiment-intel.firebaseapp.com](https://hii-sentiment-intel.firebaseapp.com)
- **Security & Authorization**:
  - Google OAuth Authentication with Firebase Auth.
  - Primary Administrator: `hayesorhaze@gmail.com`.
  - Non-administrators are routed to an access request interface that records requests into Cloud Firestore (`access_requests/{uid}`).
  - Cloud Firestore Security Rules enforce strict authorization for ledger mutations, access approvals, and run dispatching.

---

## 🛠️ Development & Deployment Workflow

### Key Commands

```powershell
# 1. Install dependencies
npm install

# 2. Run automated test suite (15 Vitest tests across engine, division rollup & deduplication)
npm test

# 3. Compile production bundle
npm run build

# 4. Deploy directly to Firebase Hosting & Cloud Firestore rules
npm run deploy

# 5. Headless scoring verification (recomputes all historical & forecast scores via CLI)
npm run recompute

# 6. Generate audit-grade Markdown report
npm run export:md

# 7. Execute automated research & deduplication sweep (offline or Vertex AI surge)
py -3 research/run_research.py --mode deep_research
```

---

## 📁 Repository Structure

```
hii-sentiment-dashboard/
├── data/
│   ├── evidence_ledger.json       # 158 canonical evidence items with deep article permalinks
│   ├── settings.json              # Active weights, schedule, and As-Of date configuration
│   ├── catalysts.json             # 6-month scenario forecast catalysts
│   ├── budget_ledger.json         # Dedicated Tier B research spend ledger ($5.00/mo cap)
│   └── pending/pending_seed.json  # Staged quarantine discovery queue
├── research/
│   ├── run_research.py            # Monday 07:00 ET Vertex AI multi-agent research orchestrator
│   ├── extractor.py               # Fuzzy deduplicator & closed-rubric discrete extractor
│   └── query_packs.py             # Audience-specific search & discovery prompt packs
├── src/
│   ├── components/                # React 19 UI components (HeaderBar, TrendChart, DivisionSentimentView, etc.)
│   ├── context/                   # DashboardContext & AuthContext (Firebase Auth & Firestore state)
│   ├── engine/                    # Deterministic BigInt scoring engine, deduplicator, division rollup
│   └── config/firebase.ts         # Firebase SDK 11 client configuration
├── tests/
│   ├── engine.test.ts             # Vitest test suite (determinism, forecast, deduplication, revisions)
│   └── division.test.ts           # Division scoring, program waterfalls, and composite rollup tests
├── firebase.json                  # Firebase Hosting & Firestore rules configuration
├── firestore.rules                # Production security rules for Firestore access control
└── vite.config.ts                 # Vite 6 build configuration
```

---

## ⚖️ Governance & FinOps

- **Strict FinOps Budget Guard**: Governed by `scripts/gcp_budget_guard.py` and `research/run_research.py`. Research sweeps are capped at `$5.00/month` with automatic 80% downgrade protection from Argon to Flash-Lite.
- **Deep Source Integrity**: All 158 evidence records in `evidence_ledger.json` link directly to specific articles and documents (Defense News, USNI News, HII Newsroom, SEC EDGAR, GAO, CRS, US Navy releases) rather than generic root domains.
