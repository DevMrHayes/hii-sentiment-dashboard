#!/usr/bin/env python3
"""
Vertex AI Agentic Surge:
1. Sanity Check Directives Queue & Weekly Research Integration for HII Sentiment Dashboard
2. Comprehensive Reusable Skill: Firebase Auth with Custom & Hosting Authorized Domains Runbook
"""

import asyncio
import os
import sys
from pathlib import Path

DASHBOARD_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = DASHBOARD_ROOT.parent
sys.path.insert(0, str(WORKSPACE_ROOT / "scripts"))

from cloud_agent_mesh import CloudAgentMesh

SANITY_CHECK_MODULE_PROMPT = """
You are a senior TypeScript React and Defense Systems software architect.
We need `src/engine/sanityCheck.ts` for the Huntington Ingalls Industries (NYSE: HII) Sentiment Intelligence Platform.

REQUIREMENTS:
1. Types:
   export interface SanityCheckItem {
     id: string; // sc_<timestamp>_<randomHex>
     createdAt: string; // ISO string
     periodOrRange: string; // e.g. "2024-Q3 to 2025-Q2" or "2024" or "2026-Q1"
     aspect: string; // e.g. "American Public & Stock Surge Divergence", "Navy Nuclear Battleship Integration", "Virginia-Class Margin Floor"
     directive: string; // e.g. "Cross-check SEC 10-Q cash flow vs. Wall Street equity ratings to ensure sentiment captures valuation floor"
     audience: 'all' | 'executive' | 'congress' | 'navy' | 'public';
     status: 'queued' | 'researching' | 'verified';
     verifiedAt?: string;
     findingsSummary?: string;
     priority: 'high' | 'normal';
   }

2. Default seeded sanity check items (representing the user's recent investigation inquiries):
   - Item 1: Period "2024–2025", Aspect "American Public Sentiment vs. +85.5% Stock Rebound", Directive "Investigate why 2024 earnings collapse was followed by massive 2025 equity surge and verify if labor retention and Golden Fleet initiatives provide durable support", Audience "public", Status "verified", findings: "Reconciled via 7 verified ledger events including Trump BBGN announcement, $3.4B Submarine Industrial Base infusion, and $460 ATH."
   - Item 2: Period "2025–2027", Aspect "Trump-Class BBGN Nuclear Battleship Drydock Capacity", Directive "Verify whether Newport News Dry Dock 12 carrier scheduling permits parallel construction of 34,000-ton nuclear battleships without delaying Ford-class CVN-80/81 deliveries", Audience "navy", Status "queued", Priority "high".
   - Item 3: Period "2026-Q4", Aspect "Fixed-Price vs. Cost-Plus-Incentive Policy Shift", Directive "Confirm Pentagon Undersecretary acquisition memo transition to CPIF contracts across new naval surface combatants to insulate operating margins", Audience "congress", Status "queued", Priority "normal".

3. Helper functions:
   - createSanityCheckItem(input: Omit<SanityCheckItem, 'id' | 'createdAt' | 'status'>): SanityCheckItem
   - formatSanityChecksForAgentPrompt(items: SanityCheckItem[]): string
   - markSanityCheckVerified(items: SanityCheckItem[], id: string, findings: string): SanityCheckItem[]

Output ONLY valid TypeScript code without markdown fences.
"""

FIREBASE_AUTH_SKILL_PROMPT = """
You are a Principal Cloud Identity & Firebase Architect.
Write the complete, official, reusable skill file `SKILL.md` for `.agents/skills/firebase-auth-custom-domains/SKILL.md`.

Skill Name: firebase-auth-custom-domains
Description: Standard operating procedure and automated runbook for configuring Firebase Authentication with Google OAuth, Authorized Domains for custom Firebase Hosting sites (*.web.app), Identity Platform API patching, and zero-leakage role-based access control.

It must cover:
1. The Common Pitfall (WHY auth/unauthorized-domain occurs):
   - When deploying to Firebase Hosting with custom site names (e.g. `site-name.web.app`), Firebase does NOT automatically add the new site to the project's Authorized Domains list.
   - It only adds the default `<project-id>.firebaseapp.com` and `<project-id>.web.app`.
   - Result: Users get `FirebaseError: auth/unauthorized-domain` immediately upon clicking Sign In.

2. Automated Resolution via Google Cloud Identity Platform REST API:
   - Provide the exact Python and curl commands using `gcloud auth print-access-token` and the `X-Goog-User-Project: <project-id>` header:
     PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/<project-id>/config?updateMask=authorizedDomains
   - Show how to inspect current domains and append new ones programmatically without manual console clicks.

3. Complete Firebase Auth Client Architecture (TypeScript):
   - Popup with graceful fallback to redirect (`auth/popup-blocked`, `auth/cancelled-popup-request`).
   - `onAuthStateChanged` session subscription.
   - Secure Role-Based Access Control (RBAC):
     - Hardcoded Admin fallback array (`ADMIN_EMAILS`).
     - Real-time Firestore synchronization for `users` and `access_requests`.
     - Zero Email Leakage Rule: Never display administrator email addresses on public unauthenticated gates, login cards, or access request confirmation screens. Use generic terms like "System Administrator".

4. Pre-Flight Checklist before every deployment:
   - Step 1: Check hosting site domain in `firebase.json`.
   - Step 2: Query Identity Toolkit authorizedDomains.
   - Step 3: Patch domain if missing.
   - Step 4: Verify Firestore rules and index configs.

Output ONLY valid markdown content with frontmatter.
"""

async def main():
    mesh = CloudAgentMesh()
    print(">>> Launching Vertex AI Agents for Sanity Check Module & Firebase Auth Runbook Skill...")
    
    subtasks = [
        {
            "id": "sanity_module",
            "role": "coder",
            "prompt": SANITY_CHECK_MODULE_PROMPT,
        },
        {
            "id": "firebase_skill",
            "role": "coder",
            "prompt": FIREBASE_AUTH_SKILL_PROMPT,
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

        if sub_id == "sanity_module":
            p = DASHBOARD_ROOT / "src" / "engine" / "sanityCheck.ts"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(raw, encoding="utf-8")
            print(f"[OK] Wrote Sanity Check Module to {p} ({len(raw)} chars)")
        elif sub_id == "firebase_skill":
            p = WORKSPACE_ROOT / ".agents" / "skills" / "firebase-auth-custom-domains" / "SKILL.md"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(raw, encoding="utf-8")
            print(f"[OK] Wrote Firebase Auth Skill to {p} ({len(raw)} chars)")

    cost_usd = sum(float(ev.get("cost_usd", 0.0)) for ev in getattr(mesh, "session_history", []))
    print(f"[Vertex AI Surge] Complete! Cost: ${cost_usd:.5f}")

if __name__ == "__main__":
    asyncio.run(main())
