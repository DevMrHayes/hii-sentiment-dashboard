#!/usr/bin/env python3
"""
Gemini 4 Argon Deep Research Collector for 2025-2026 (DOGE, Shutdowns, CRs, Delays, and Milestones)
"""
import asyncio
import json
import sys
from pathlib import Path

DASHBOARD_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = DASHBOARD_ROOT.parent
sys.path.insert(0, str(WORKSPACE_ROOT / "scripts"))

from cloud_agent_mesh import CloudAgentMesh
from expand_historical_corpus import ERA_PROMPTS


async def main():
    mesh = CloudAgentMesh(
        coder_model="gemini-3.8-flash",
        architect_model="gemini-4-argon",
    )
    prompt = ERA_PROMPTS[3]["prompt"] + "\n\nKeep each summary concise (1-2 sentences) so all 22 events fit cleanly in JSON. Output ONLY a valid JSON array."
    print("[Tier B Argon Verifier] Generating 2025-2026 DOGE, Shutdown, CR, and Milestone events...")
    raw = await mesh.run_coder(prompt, model="gemini-4-argon", fast_json=True)
    text = (raw or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    s = text.find("[")
    e = text.rfind("]")
    if s != -1 and e != -1:
        text = text[s:e + 1]
    events_25_26 = json.loads(text)
    print(f"  + Era 2025_2026 (Argon): extracted {len(events_25_26)} events")

    out_path = DASHBOARD_ROOT / "data" / "expanded_historical_discoveries.json"
    existing = json.loads(out_path.read_text(encoding="utf-8"))
    combined = existing + events_25_26
    out_path.write_text(json.dumps(combined, indent=2), encoding="utf-8")

    cost_usd = sum(float(ev.get("cost_usd", 0.0)) for ev in getattr(mesh, "session_history", []))
    print(f"Total expanded discoveries saved: {len(combined)} | Argon Cost: ${cost_usd:.5f}")

    budget_file = DASHBOARD_ROOT / "data" / "budget_ledger.json"
    if budget_file.exists():
        bdata = json.loads(budget_file.read_text(encoding="utf-8"))
        bdata["monthSpendUsd"] = round(float(bdata.get("monthSpendUsd", 0.12321)) + cost_usd, 5)
        bdata["runsCount"] = int(bdata.get("runsCount", 4)) + 1
        budget_file.write_text(json.dumps(bdata, indent=2), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
