#!/usr/bin/env python3
"""
Vertex AI Agentic Surge: Division Sentiment Engine, Program Waterfall & Pinned Chart Presentation
"""

import asyncio
import os
import sys
from pathlib import Path

DASHBOARD_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = DASHBOARD_ROOT.parent
sys.path.insert(0, str(WORKSPACE_ROOT / "scripts"))

from cloud_agent_mesh import CloudAgentMesh

DIVISION_ENGINE_PROMPT = """
You are an expert TypeScript financial software engineer specializing in deterministic defense analytics.
We need the module `src/engine/division.ts` for Huntington Ingalls Industries (NYSE: HII).

It must implement:
1. Division types:
   export type DivisionId = 'nns' | 'ingalls' | 'mission_tech';
   export type ProgramId =
     | 'cvn_ford'
     | 'cvn_rcoh'
     | 'virginia_ssn'
     | 'columbia_ssbn'
     | 'ddg_51'
     | 'lpd_amphib'
     | 'lha_amphib'
     | 'nsc_cutter'
     | 'uuv_unmanned'
     | 'c5isr_tech'
     | 'commercial_energy'
     | 'corporate_macro';

2. Program metadata:
   export const PROGRAM_META: Record<ProgramId, { name: string; division: DivisionId | 'shared'; shipClass: string; desc: string }>;

3. Heuristic / explicit tagging function:
   export function inferEventDivisionAndPrograms(event: { title: string; summary: string; id: string }): {
     division: DivisionId | 'corporate';
     programs: ProgramId[];
   };

4. Deterministic Division Scoring function:
   export interface DivisionScoreResult {
     divisionId: DivisionId;
     asOfDate: string;
     latest: {
       compositeScoreCenti: number;
       audiences: Record<AudienceId, number>; // in scoreCenti
     };
     timeline: Array<{
       periodId: string;
       label: string;
       compositeScoreCenti: number;
       audiences: Record<AudienceId, number>;
     }>;
     programWaterfall: Array<{
       programId: ProgramId;
       name: string;
       netImpactBps: number;
       netImpactPoints: number; // decimal for display
       direction: -1 | 0 | 1;
       topEventTitle: string;
       eventCount: number;
     }>;
   }

   export function computeDivisionScores(
     events: ImpactEvent[],
     divisionId: DivisionId,
     settings: DashboardSettings
   ): DivisionScoreResult;

Strict rules:
- Zero floats in scoring paths; uses BigInt or divRne integer arithmetic.
- Deterministic output.
- Program waterfall accurately identifies which programs drag down (negative) or lift (positive) that division.

Output ONLY clean TypeScript code for `src/engine/division.ts`.
"""

HII_LOGO_PROMPT = """
Write a clean React component in TypeScript for `src/components/HIILogo.tsx`.
It renders the official Huntington Ingalls Industries (HII) dual-chevron / sail emblem in SVG along with stylized typography.
Colors:
#003b4d (Deep Sea / Navy Blue)
#75abd1 (Sky Blue)
#ea7722 (Passion Orange accent)
#24272a (Charcoal)
white

Supports props:
- className?: string
- size?: 'sm' | 'md' | 'lg'
- showWordmark?: boolean
- variant?: 'dark' | 'light'

Output ONLY valid TypeScript React code for `src/components/HIILogo.tsx`.
"""

async def main():
    mesh = CloudAgentMesh(
        coder_model="gemini-3.8-flash",
        architect_model="gemini-4-argon",
    )
    print("[Vertex AI Surge] Dispatching division engine and logo tasks in parallel...")

    subtasks = [
        {"id": "division_engine", "role": "coder", "prompt": DIVISION_ENGINE_PROMPT},
        {"id": "hii_logo", "role": "coder", "prompt": HII_LOGO_PROMPT},
    ]

    results = await mesh.run_parallel_fanout(subtasks)

    for res in results:
        sub_id = res["id"]
        raw = (res.get("result") or "").strip()
        if raw.startswith("```"):
            lines = raw.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            raw = "\n".join(lines).strip()

        if sub_id == "division_engine":
            p = DASHBOARD_ROOT / "src" / "engine" / "division.ts"
            p.write_text(raw, encoding="utf-8")
            print(f"Wrote {p} ({len(raw)} chars)")
        elif sub_id == "hii_logo":
            p = DASHBOARD_ROOT / "src" / "components" / "HIILogo.tsx"
            p.write_text(raw, encoding="utf-8")
            print(f"Wrote {p} ({len(raw)} chars)")

    cost_usd = sum(float(ev.get("cost_usd", 0.0)) for ev in getattr(mesh, "session_history", []))
    print(f"[Vertex AI Surge] Complete! Cost: ${cost_usd:.5f}")


if __name__ == "__main__":
    asyncio.run(main())
