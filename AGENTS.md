# HII Sentiment Intelligence Dashboard — Agent & Developer Guide

## Overview
`hii-sentiment-dashboard` is an audit-grade, strictly deterministic multi-audience sentiment intelligence platform tracking **Huntington Ingalls Industries (NYSE: HII)** from its March 31, 2011 spin-off through the present, with a 6-month scenario-based forecast.

It quantifies sentiment across **four primary stakeholder audiences** plus a weighted **Composite Index**:
1. **Executive Branch / Administration (`executive`)**: White House Executive Orders, Maritime Directorate, OMB President's Budget Requests, OSD/SecDef briefings.
2. **United States Congress (`congress`)**: HASC/SASC/Appropriations hearings, NDAA authorizations, Continuing Resolutions, GAO audits, and CRS reports.
3. **Department of the Navy (`navy`)**: SECNAV/CNO 30-Year Shipbuilding Plan, NAVSEA contract awards, INSURV sea trials, and Submarine Industrial Base (SIB) investments.
4. **American Public & Capital Markets (`public`)**: NYSE:HII relative stock performance vs. defense peers (`GD`, `LMT`, `NOC`, `ITA`), quarterly earnings & Free Cash Flow guidance, Wall Street analyst ratings, and defense/national media coverage.

---

## Strict Determinism Contract (`engine-v1.0.0` / `rubric-v1.0.0`)
To guarantee 100% bit-identical reproducibility:
- **LLMs are strictly isolated to Discovery & Rubric Classification**: Vertex AI / Gemini Deep Research agents discover candidate evidence and classify impacts into closed discrete enumerations at `temperature=0.0` (`direction in {-1,0,1}`, `magnitude in {1..5}`, `credibility in {1..4}`, `scope in {'program','company','industry','macro'}`, `persistence in {'transient','quarter','year','structural'}`).
- **Content-Addressed Evidence Ledger**: Every event is hashed (`evt_<16hex>` via FIPS 180-4 SHA-256 over canonical JSON).
- **64-Bit Integer Basis-Point Arithmetic**: All scoring and time decay in [`src/engine/`](./src/engine/) uses `BigInt` integer math with Round-Half-To-Even (`divRne`) and a pre-tabulated 65-point fixed-precision binary exponentiation lookup table (`TWO_NEG_FRAC_1E8`). Zero IEEE-754 floating-point instructions are used in the scoring path.
- **Retroactive Revision Tracking**: When a research run or analyst adds evidence dated in a closed historical period, [`detectRevisions`](./src/engine/revisions.ts) records an immutable `ScoreRevision` explaining which period and audience scores changed and why.

---

## HII Brand Color Palette
- `#24272a` — **Charcoal** (Primary background)
- `#003b4d` — **Deep Sea** (Elevated intelligence cards & header)
- `#75abd1` — **Sky Blue** (Executive line & primary data labels)
- `#509ca2` — **Changing Sea** (Congress line & positive delta badges)
- `#5b6670` — **Steel** (Borders & structural dividers)
- `#ea7722` — **Passion** (Key event star markers, forecast projection, primary CTAs, revision alerts)
- `#ffffff` — **White** (Bold Composite line & primary typography)

---

## Key Commands
```powershell
# Run automated Vitest determinism, forecast, and revision test suite
npm test

# Recompute all historical & forecast scores headlessly in CLI and verify SHA-256 hashes
npm run recompute

# Export full historical & forecast audit report to HII_Sentiment_Audit_Report.md
npm run export:md

# Trigger Vertex AI / Gemini Deep Research discovery pipeline
npm run research

# Promote pending quarantine discoveries into committed ledger
npm run promote

# Start local Vite development server + REST API middleware on port 5195
npm run dev

# Build production bundle
npm run build
```
