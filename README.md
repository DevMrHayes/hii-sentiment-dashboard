# HII Sentiment Intelligence Dashboard

A deterministic, multi-audience sentiment analysis and 6-month scenario forecasting platform for **Huntington Ingalls Industries (NYSE: HII)** spanning **2011–Present**.

## Key Capabilities
- **Four Stakeholder Perspectives + Weighted Composite**:
  - **Executive Branch (`executive`)**
  - **U.S. Congress (`congress`)**
  - **Department of the Navy (`navy`)**
  - **American Public & Capital Markets (`public`)**
- **100% Deterministic Scoring Engine (`engine-v1.0.0`)**:
  - Pure integer basis-point arithmetic (`BigInt` Round-Half-To-Even) over a SHA-256 content-addressed Evidence Ledger. Regenerating scores over the same evidence produces bit-identical `ledgerHash` and `outputHash` values across any OS or runtime.
- **Variable Time Granularity**:
  - **Annual** (`2011`–`2025`), **Quarterly** (`2026-Q1`–`2026-Q3`), **Monthly** (`2026-10`, `2026-11`), plus **6-Month Scenario Forecast** (`2026-12`–`2027-05`) with Expected Value and analytic `[P10 – P90]` confidence band.
- **Control & Rubric Studio**:
  - Interactive audience composite weight sliders & presets, manual event entry, key event starring (`#ea7722` Passion markers), and forecast catalyst probability adjustment.
- **Vertex AI & Gemini Deep Research Pipeline**:
  - Audience-specific query packs (`research/run_research.py`) governed by the `$15.00/month` GCP FinOps circuit breaker, Pending Quarantine review queue, and automatic **Retroactive Score Revision** detection and attribution.
- **Audit-Grade Markdown Export**:
  - One-click Markdown export in the UI or via `npm run export:md`.

## Quick Start
```powershell
npm install
npm test
npm run recompute
npm run dev
```
Open `http://localhost:5195`.
