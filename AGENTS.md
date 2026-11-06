# HII Sentiment Intelligence Dashboard — Agent & Developer Guide

## Overview
`hii-sentiment-dashboard` is an audit-grade, strictly deterministic multi-audience sentiment intelligence platform tracking **Huntington Ingalls Industries (NYSE: HII)** from its March 31, 2011 spin-off through the present, featuring a 6-month scenario-based forecast and business division breakdown.

🌐 **Production Deployment**: [https://hii-sentiment-intel.web.app](https://hii-sentiment-intel.web.app) (GCP Project: `gen-lang-client-0353543048`)  
🔒 **Access Control**: Google OAuth via Firebase Authentication. Dedicated administrator: `hayesorhaze@gmail.com`.

---

## 🏛️ Core Architecture & Capabilities

### 1. Multi-Audience + Division Framework
Quantifies sentiment across **four primary stakeholder audiences** plus a weighted **Composite Index**:
1. **Executive Branch / Administration (`executive`)**: White House Executive Orders, Maritime Directorate directives, OMB President's Budget Requests, Title III DPA capital grants.
2. **United States Congress (`congress`)**: HASC/SASC hearings, NDAA authorizations, Continuing Resolutions, GAO audits, and CRS reports.
3. **Department of the Navy (`navy`)**: SECNAV/CNO 30-Year Shipbuilding Plans, NAVSEA contract definitizations, INSURV sea trials, and Submarine Industrial Base (SIB) investments.
4. **American Public & Capital Markets (`public`)**: NYSE:HII relative stock performance, quarterly earnings & Free Cash Flow, Wall Street analyst ratings, labor union contracts (USW Local 8888, Pascagoula Metal Trades), and defense journalism.

**Business Division Sentiment (`/divisions`)**:
- **Newport News Shipbuilding (NNS)**: 55% operating footprint (CVN 78/79/80 carriers, Virginia-class SSN, Columbia-class SSBN modules).
- **Ingalls Shipbuilding**: 35% operating footprint (DDG 51 Flight III destroyers, LHA amphibious assault ships, LPD amphibious transport docks).
- **Mission Technologies**: 10% operating footprint (Fleet autonomy, REMUS/LDUUV, C5ISR, cyber operations).
- **Program Impact Waterfall**: Direct causal tracking showing individual program friction or breakthroughs affecting divisional and composite scores.

---

### 2. Strict Determinism Contract (`engine-v1.0.0` / `rubric-v1.0.0`)
- **LLM Boundary**: Vertex AI agents are strictly isolated to evidence gathering and closed-rubric classification at `temperature=0.0`. Scoring is 100% deterministic code.
- **64-Bit Integer Basis-Point Arithmetic**: Pure integer basis points (`BigInt` Round-Half-To-Even via `divRne`) and pre-tabulated 65-point fixed-precision decay tables (`TWO_NEG_FRAC_1E8`). Zero IEEE-754 floats in the scoring path.
- **Immutable Evidence Ledger**: Every event is hashed (`evt_<16hex>` via SHA-256 over canonical JSON).
- **Retroactive Revision Auditing**: [`detectRevisions`](./src/engine/revisions.ts) records an immutable `ScoreRevision` log whenever historical evidence is staged, approved, or edited.

---

### 3. 3-Layer Fuzzy & Semantic Deduplication Engine
Integrated into Monday 07:00 ET sweeps ([`research/run_research.py`](./research/run_research.py), [`research/extractor.py`](./research/extractor.py)) and frontend ingestion ([`src/engine/ledger.ts`](./src/engine/ledger.ts), [`src/context/DashboardContext.tsx`](./src/context/DashboardContext.tsx)):
- **Layer 1 (Exact SHA-256 ID)**: Content hash over `{ eventDate, sourceType, title }`.
- **Layer 2 (Article Permalink URL Matching)**: Normalizes deep article URLs and flags identical articles regardless of headline phrasing.
- **Layer 3 (±14-Day Date Window + Entity/Quarter Collision)**:
  - Normalizes shipbuilding hull designations (`CVN-79`, `DDG-51`, `SSN-798`, `Q3 2026`, `FY 2027`) and strips corporate boilerplate.
  - Detects duplicate fiscal-quarter earnings reports within ±14 days.
  - Computes Jaccard token similarity over significant domain keywords (`>= 40%` overlap rejected or flagged).

---

### 4. User Experience & Design Standard
- **Theme**: Balanced blend of White and Charcoal (`#24272a`) with Deep Sea (`#003b4d`), Sky Blue (`#75abd1`), Changing Sea (`#509ca2`), Steel (`#5b6670`), and Passion (`#ea7722`) as accents.
- **Official HII Brand Logo Header**: Replaces generic icons with the official HII logo, live audit proof hash indicator, and dynamic As-Of date (`2026-11-05`).
- **Mobile-First Responsive Layout**: Optimized for phones, tablets, and wide executive displays.
- **Expanded Line Graph**: Page-width responsive timeline expansion preserving perspective.
- **Pinned Milestone Calling**: Starred key events can be pinned directly onto the historical curve with properly scaled basis-point tags (`+1.40 pts`).
- **Read-Tracking Notification Badges**: Tab badges track unread revisions/catalysts and automatically clear to `0` upon viewing.
- **Sanity Check Queue**: In-app audit mechanism in the Research tab allowing users to log specific anomalies for prioritized research on the next Vertex AI run.

---

### 5. Deployment & Security Architecture
- **Primary Hosting Target**: Google Cloud Firebase Hosting (`https://hii-sentiment-intel.web.app`).
- **Cloud Firestore Security Rules**: Enforces authorization rules authored by `firestore-rules-author` subagent in `firestore.rules`.
- **Authentication**: Firebase Authentication with Google OAuth provider.
- **Single Admin Principle**: Only `hayesorhaze@gmail.com` has administrator privileges. Other authenticated users can submit an access request through the UI which creates a document in `access_requests/{uid}` for the administrator to approve.
- **Cross-Origin Opener Policy**: Configured in `firebase.json` (`same-origin-allow-popups`) to support seamless Google OAuth popups.

---

## 🛠️ Key Developer & Agent Commands

```powershell
# Run automated Vitest test suite (15 tests: determinism, forecast, deduplication, division rollups)
npm test

# Recompute all historical & forecast scores headlessly in CLI and verify SHA-256 output hashes
npm run recompute

# Export full historical & forecast audit report to HII_Sentiment_Audit_Report.md
npm run export:md

# Build production bundle
npm run build

# Deploy directly to Firebase Hosting & Firestore Security Rules
npm run deploy

# Run local development Vite server (fallback only - production deployments go to Firebase)
npm run dev

# Execute Tier B Vertex AI research & deduplication sweep
py -3 research/run_research.py --mode deep_research
```

---

## 📋 Agent Operational Guidelines

1. **Production Deployment Target**: Always deploy to Firebase via `npm run deploy`. Do not deploy to a standalone local server as the primary runtime.
2. **Deterministic Integrity**: Any modifications to [`src/engine/`](./src/engine/) must preserve bit-identical determinism and pass `npm test`.
3. **Firestore Security Rules**: If modifying `firestore.rules`, ALWAYS delegate rule design and modifications to the mandatory `firestore-rules-author` subagent.
4. **Git Remote Synchronization**: Always commit and push changes back to `origin/main` after verifying builds and tests.
