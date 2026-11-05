#!/usr/bin/env python3
"""
Vertex AI Agentic Surge: HII Authentic Logo & Presentation Chart De-Cluttering & Full-Width Expansion
"""

import asyncio
import os
import sys
from pathlib import Path

DASHBOARD_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = DASHBOARD_ROOT.parent
sys.path.insert(0, str(WORKSPACE_ROOT / "scripts"))

from cloud_agent_mesh import CloudAgentMesh

HII_LOGO_PROMPT = """
You are a senior UI and SVG design engineer.
Generate the complete, authentic TypeScript React component `src/components/HIILogo.tsx` for Huntington Ingalls Industries (NYSE: HII).

The authentic HII brand logo is composed of:
1. Left: An emblem square in Deep Sea (#003b4d) containing three vertical white cutout slots:
   - Left slot: A vertical cutout with a rectangular tab/notch extending rightward in the vertical middle.
   - Middle slot: A straight vertical rectangular cutout.
   - Right slot: A vertical cutout with a rectangular tab/notch extending leftward in the vertical middle.
   Dimensions in viewBox="0 0 270 148":
   - Outer emblem box: x=0, y=16, width=118, height=116, rx=3
   - Left cutout path: M 18 31 H 35 V 63 H 45 V 85 H 35 V 117 H 18 Z
   - Middle cutout: rect x="50" y="31" width="18" height="86"
   - Right cutout path: M 83 31 H 100 V 117 H 83 V 85 H 73 V 63 H 83 Z
   (All cutouts rendered in white #ffffff or cut out with fillRule="evenodd")

2. Right: The bold sans-serif monogram "HII":
   - Letter "H": x=155 to 210, y=39 to 108.
     Left stem: rect x="155" y="39" width="11" height="70"
     Crossbar: rect x="166" y="69" width="34" height="10"
     Right stem: rect x="200" y="39" width="11" height="70"
   - Letter "I" (first): rect x="227" y="39" width="11" height="70"
   - Letter "I" (second): rect x="254" y="39" width="11" height="70"

Props:
- `className?: string`
- `size?: 'sm' | 'md' | 'lg'` (sm: h-7, md: h-9, lg: h-12)
- `showWordmark?: boolean` (default: true)
- `variant?: 'dark' | 'light' | 'color'` (for dark backgrounds, text is white, emblem is deep sea #003b4d with white cutouts; for light backgrounds, text and emblem are #003b4d)
- `subtitle?: boolean` (optional tiny subtext "HUNTINGTON INGALLS INDUSTRIES" below wordmark or omitted for clean look)

Output ONLY valid TypeScript React code without extra commentary.
"""

TREND_CHART_PROMPT = """
You are a principal React / Data Visualization engineer.
We need to upgrade `src/components/TrendChart.tsx` in the Huntington Ingalls Industries sentiment dashboard to resolve three major UX/presentation issues:

1. Full Width Presentation Mode (Width expansion instead of vertical distortion):
   - When `isChartExpanded` is true, the chart expands to 100% full width across the screen, allowing the 2011–2027 timeline to stretch horizontally with maximum breathing room.
   - Keep the canvas height balanced and proportional (e.g. `h-[440px]` or `h-[460px]` instead of stretching vertically to skew perspective).
   - The toggle button clearly indicates "Full Width Presentation" / "Standard Width".

2. Fix Overlapping "Monthly" and "6-Mo Forecast" text:
   - Currently, adjacent ReferenceLines at `2026-10` ('Monthly →') and `2026-11` ('6-Mo Forecast →') have labels at position 'top', crashing into each other.
   - Replace this with a clean, dedicated Timeline Phase Legend track right above the chart canvas:
     - 2011–2025 Annual (15Y) in steel silver (#8b98a5)
     - 2026 Q1–Q3 Quarterly in Changing Sea (#509ca2)
     - 2026-10 Monthly in Sky Blue (#75abd1)
     - 2026-11–2027-05 6-Mo Forecast in Passion Orange (#ea7722)
   - On the chart itself, the transition lines (2026-Q1, 2026-10, 2026-11) use subtle dashed colored vertical lines without competing, overlapping text labels.

3. Clean up crowded pinned events:
   - Currently, long text titles (e.g. `📌 2013: Budget Control Act Sequestr... 2019: Navy Awards...`) are all crammed at the top of the chart, colliding horribly.
   - Revamp this:
     a) On the chart canvas:
        - Pinned events render a clean vertical dashed line (`stroke="#ea7722" strokeDasharray="3 3"`).
        - At the top of the line, show ONLY a neat, compact numbered badge indicator (e.g., `①`, `②`, `③`, etc.) or date tag.
     b) Below the chart canvas:
        - Render an **Executive Pinned Milestones Deck**:
          A horizontal flex/grid row of clean presentation cards for each pinned event!
          Each card shows:
          - Number badge matching the chart line: e.g. `[ 1 ]`
          - Date stamp: e.g. `2013-03-01`
          - Title: e.g. `Budget Control Act Sequestration Enacted`
          - Audience impact pills (Executive, Congress, Navy, Public with colored +/- bps badges)
          - 1-click unpin button
          - Clicking the card selects and highlights that period!
   - This keeps the chart canvas 100% clean, elegant, and executive-ready while presenting full detail in the presentation deck.

Output ONLY valid, complete TypeScript React code for `TrendChart.tsx`.
"""

async def main():
    mesh = CloudAgentMesh()
    print(">>> Launching Vertex AI Agents for HII Authentic Logo & Presentation Chart De-Cluttering...")
    
    subtasks = [
        {
            "id": "hii_logo",
            "role": "coder",
            "prompt": HII_LOGO_PROMPT,
        },
        {
            "id": "trend_chart",
            "role": "coder",
            "prompt": TREND_CHART_PROMPT,
        },
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

        if sub_id == "hii_logo":
            p = DASHBOARD_ROOT / "src" / "components" / "HIILogo.tsx"
            p.write_text(raw, encoding="utf-8")
            print(f"Wrote {p} ({len(raw)} chars)")
        elif sub_id == "trend_chart":
            p = DASHBOARD_ROOT / "src" / "components" / "TrendChart.tsx"
            p.write_text(raw, encoding="utf-8")
            print(f"Wrote {p} ({len(raw)} chars)")

    cost_usd = sum(float(ev.get("cost_usd", 0.0)) for ev in getattr(mesh, "session_history", []))
    print(f"[Vertex AI Surge] Complete! Cost: ${cost_usd:.5f}")

if __name__ == "__main__":
    asyncio.run(main())
