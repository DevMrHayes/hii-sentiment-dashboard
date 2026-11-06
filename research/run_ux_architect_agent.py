#!/usr/bin/env python3
"""
run_ux_architect_agent.py - Vertex AI UX Architect Agent for HII Sentiment Intelligence.

Takes a comprehensive domain summary prompt of the HII Sentiment Analysis platform
and synthesizes a state-of-the-art conceptual UX/UI design blueprint of what the app
could look like, comparing design paradigms, visual hierarchy, and executive workflows.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root and scripts to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT.parent))

from scripts.cloud_agent_mesh import CloudAgentMesh

APP_SUMMARY_PROMPT = """You are a World-Class Executive UX Architect & Principal Design Director specializing in Defense Aerospace Intelligence, Mission Command Centers, and high-concurrency decision platforms (e.g. Palantir Gotham/Foundry, Bloomberg Terminal, McKinsey IT Transformation suites, and Pentagon C4ISR consoles).

You have been tasked with designing the conceptual UX/UI Architecture for the **Huntington Ingalls Industries (NYSE: HII) Multi-Audience Sentiment Intelligence & Forecasting Platform**.

### DOMAIN & PLATFORM SUMMARY:
1. **Subject**: Huntington Ingalls Industries (NYSE: HII), America's largest military shipbuilder (sole nuclear aircraft carrier builder, sole amphibious assault ship builder, co-builder of nuclear fast attack and ballistic missile submarines, surface combatants, and autonomous unmanned undersea systems).
2. **Core Stakeholder Audiences**:
   - Executive Branch (White House, DoD, OMB, SECNAV)
   - Congress (HASC, SASC, HAC-D, SAC-D, Shipbuilding Caucuses)
   - Department of the Navy (NAVSEA, PEO Carriers, PEO Submarines, PEO Ships, Fleet Forces)
   - American Public & Capital Markets (Equity analysts, defense media, labor unions USW Local 8888, shipyard communities)
3. **Core Business Divisions**:
   - Newport News Shipbuilding (NNS) — CVN 78/79/80/81 carriers, Virginia-class SSN, Columbia-class SSBN, carrier RCOH.
   - Ingalls Shipbuilding — Arleigh Burke DDG-51 Flight III destroyers, America-class LHA, San Antonio-class LPD, Legend-class NSC.
   - Mission Technologies — REMUS & Lionfish UUVs, C5ISR, synthetic AI training, fleet cyber.
4. **Key Features & Capabilities**:
   - Deterministic 15-Year Longitudinal Timeline (2011–2025 Annual -> 2026 Quarterly -> 2026 Monthly -> 6-Month Forward Forecast with 80% P10/P90 confidence fan).
   - Executive Pinned Milestone Deck (pinning starred milestones like BCA sequestration, COVID disruptions, 2-carrier contract award, Q3 2024 earnings shock, Trump Golden Fleet BBGN order).
   - Division Sentiment & Program Impact Waterfall (drilling into individual defense programs like CVN 79 elevator delays or DDG-51 multi-year awards to explain division lift vs drag).
   - Monday Automated Multi-Agent Research Sweep ($5.00/month FinOps circuit breaker, staged progress telemetry, sanity check queue).
   - Evidence Ledger with 159+ SHA-256 content-addressed historical events, full source attribution (hearings, GAO audits, press releases, defense media, labor union CBAs).
   - Single-Tenant Google OAuth Wall with Role-Based Access Control and Access Request approval queue.
   - Deterministic mathematical auditability (bit-identical 64-bit integer engine, SHA-256 output hash).

### YOUR DELIVERABLE:
Synthesize an exhaustive, publication-grade **UX/UI Conceptual Design Blueprint** of what the ideal version of this platform looks like. Format in beautiful GitHub markdown with:
1. **Design Philosophy & Visual Language**: Color palette (#24272a charcoal, #003b4d deep sea, #509ca2 changing sea, #75abd1 sky blue, #ea7722 passion orange), typography hierarchy (JetBrains Mono + Inter/Geist), dark slate vs sunlight-readable high-contrast modes, information density principles (command center vs executive briefing).
2. **Global Navigation & Layout Wireframe**: Top command rail, breadcrumbs, real-time telemetry pills, FinOps budget circuit breaker indicator, tenant access badge.
3. **Primary Experience Layers (Screens & Views)**:
   - *Layer 1: The Executive 30-Second Glance* (Composite KPI, Audience pulse delta, 6-month forecast trajectory, top catalyst alert).
   - *Layer 2: The Multi-Audience Timeline & Presentation Canvas* (Interactive timeline scrubber, phase delimiters, pinned presentation callout rack, confidence corridor).
   - *Layer 3: Division & Program Attribution Studio* (Shipyard division selector, program waterfall matrix, program drag vs lift attribution, corporate diversification rollup comparison).
   - *Layer 4: Deep Research, Weekly Sweep & Sanity Check Radar* (Multi-agent stage visualization, FinOps budget gauge, pending evidence review drawer, sanity check investigation queue).
   - *Layer 5: Evidence Ledger & Audit Trail* (Full filterable event cards, source type pills, discrete rubric inspection, SHA-256 cryptographic provenance).
4. **Mobile & Cross-Device Ergonomics**: Touch targets for executive iPads and sideline phones, responsive breakpoints, presentation mode projector optimizations.
5. **Micro-Interactions & Trust Indicators**: How deterministic audit hashes, retroactive revision markers, and source credibility badges establish unassailable trust with C-suite and Pentagon decision-makers.

Make this thorough, authoritative, and visually vivid.
"""

async def main():
    mesh = CloudAgentMesh()
    print(f"Initiating Vertex AI Tier 1 Architect UX Agent on {mesh.project} (us-central1)...", flush=True)

    text, metrics = await mesh._post_vertex_generate(
        model="gemini-2.5-pro",
        role="architect",
        contents=[{"role": "user", "parts": [{"text": APP_SUMMARY_PROMPT}]}],
        system_instruction="You are a World-Class Executive UX Architect & Defense Intelligence Product Designer.",
        temperature=0.2,
        task_summary="Synthesize HII Sentiment UX Architecture Blueprint",
    )
    print(f"[Cloud-Architect] Completed in {metrics['elapsed']:.2f}s ({metrics['speed_tps']:.1f} t/s | Cost: ${metrics['cost_usd']:.5f})", flush=True)
    response = text

    out_file = REPO_ROOT / "hii-sentiment-dashboard" / "docs" / "design" / "UX_AGENT_CONCEPTUAL_DESIGN.md"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(response, encoding="utf-8")
    print(f"\n[Success] UX Agent Blueprint saved to: {out_file}", flush=True)
    print(f"Characters: {len(response)} | File size: {out_file.stat().st_size} bytes", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
