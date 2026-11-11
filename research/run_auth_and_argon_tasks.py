#!/usr/bin/env python3
"""
Vertex AI Agentic Surge:
1. Google Auth Wall & Role-Based Access Control (hayesorhaze@gmail.com admin + request access flow)
2. Argon Deep Research on American Public Sentiment & HII Stock Price Reconciliation (2024-2026)
"""

import asyncio
import json
import os
import sys
from pathlib import Path

DASHBOARD_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = DASHBOARD_ROOT.parent
sys.path.insert(0, str(WORKSPACE_ROOT / "scripts"))

from cloud_agent_mesh import CloudAgentMesh

AUTH_SERVICE_PROMPT = """
You are a senior full-stack React and Firebase engineer.
Create `src/config/firebase.ts` for `hii-sentiment-dashboard` using Firebase v11.
We need:
1. Firebase App, Auth, and Firestore initialization with offline persistence:
   - projectId: 'gen-lang-client-0353543048'
   - authDomain: 'gen-lang-client-0353543048.firebaseapp.com'
   - apiKey: import.meta.env.VITE_FIREBASE_API_KEY (loaded from .env.local; never hardcode literals)
   - storageBucket: 'gen-lang-client-0353543048.firebasestorage.app'
   - messagingSenderId: '791977684035'
   - appId: '1:791977684035:web:9af5af6622f51aaea678f6'

2. Admin Accounts:
   - Primary: 'hayesorhaze@gmail.com'
   export const ADMIN_EMAILS = ['hayesorhaze@gmail.com'];
   export function isAdmin(email?: string | null): boolean;

3. User Roles:
   export type UserRole = 'admin' | 'viewer' | 'pending' | 'denied';

4. Collections in Firestore:
   - 'hii_sentiment_users': docId = lowercase email. Fields: { email, role: 'admin' | 'viewer', displayName, approvedAt, approvedBy }
   - 'hii_sentiment_access_requests': docId = lowercase email. Fields: { email, displayName, requestedAt, status: 'pending' | 'approved' | 'rejected', note }

5. Auth Functions:
   - signInWithGoogle(): signInWithPopup with fallback to signInWithRedirect.
   - signOutUser()
   - watchAuth(callback)
   - checkUserRole(email: string): Promise<UserRole>
   - submitAccessRequest(email: string, displayName: string, note?: string): Promise<void>
   - subscribeToUserRole(email: string, callback: (role: UserRole) => void): () => void
   - subscribeToPendingRequests(callback: (requests: any[]) => void): () => void
   - subscribeToApprovedUsers(callback: (users: any[]) => void): () => void
   - approveAccessRequest(targetEmail: string, approvedBy: string): Promise<void>
   - revokeUserAccess(targetEmail: string): Promise<void>
   - directAddViewer(targetEmail: string, addedBy: string): Promise<void>

Output ONLY valid TypeScript code.
"""

ARGON_RESEARCH_PROMPT = """
You are a Principal Defense Equity Analyst & Historian specializing in Huntington Ingalls Industries (NYSE: HII).
We are reconciling the American Public & Investor sentiment from 2024 to late 2026.

FACTUAL HISTORICAL CONTEXT TO RECONCILE:
- Late 2024: HII suffered a major guidance slash and earnings shock on Oct 31, 2024 (-25.8% annual drop for 2024).
- 2025: The stock staged a MASSIVE rebound, surging +85.5% in calendar year 2025! Driven by naval rearmament, Submarine Industrial Base capital investments, shipyard labor stabilization, and President Trump's December 2025 announcement of the "Golden Fleet" Nuclear Battleship (BBGN / Trump-class) initiative designating HII Newport News as lead nuclear shipyard. Full year 2025 revenue hit a record $12.48B with $605M net earnings.
- Early 2026: HII stock touched a historic All-Time High of $451.78 to $460.00 in early 2026.
- Late 2026: HII shares trade around $310-$320, beating consensus in Q3 2026 ($3.5B rev, EPS $5.48) with Wall Street consensus "Buy" rating.

YOUR TASK:
Synthesize 6 to 8 high-impact, verified events for 2025 and 2026 that accurately capture this public and investor sentiment surge.
Each event must strictly follow the HII Evidence Ledger schema:
```json
{
  "id": "evt_<16 hex chars>",
  "title": "<headline>",
  "eventDate": "YYYY-MM-DD",
  "discoveredAt": "2026-11-05T06:00:00Z",
  "sourceType": "stock_move" | "earnings" | "exec_order" | "contract_award" | "analyst_rating" | "news_media",
  "sourceUrls": ["<valid primary reference url>"],
  "summary": "<2-3 sentence factual summary with stock %, revenue, and industrial impact>",
  "impacts": [
    {
      "audience": "public",
      "direction": 1,
      "magnitude": 3 | 4 | 5,
      "credibility": 4,
      "scope": "company" | "industry",
      "persistence": "quarter" | "year" | "structural",
      "rationale": "<explanation>"
    }
  ],
  "starred": true | false,
  "origin": "research",
  "verification": "verified",
  "editHistory": []
}
```

Include the Trump Battleship initiative (December 2025), the 2025 stock surge (+85.5%), the $460 all-time high in early 2026, Q3 2026 earnings beat, and shipyard capital injections.
Output a valid JSON array of these event objects.
"""

async def main():
    mesh = CloudAgentMesh()
    print(">>> Launching Vertex AI Agents for Google Auth Wall & Argon Sentiment Research...")
    
    subtasks = [
        {
            "id": "auth_service",
            "role": "coder",
            "prompt": AUTH_SERVICE_PROMPT,
        },
        {
            "id": "argon_research",
            "role": "coder",
            "prompt": ARGON_RESEARCH_PROMPT,
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

        if sub_id == "auth_service":
            p = DASHBOARD_ROOT / "src" / "config" / "firebase.ts"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(raw, encoding="utf-8")
            print(f"[OK] Wrote Firebase Auth Service to {p} ({len(raw)} chars)")
        elif sub_id == "argon_research":
            p = DASHBOARD_ROOT / "research" / "argon_verified_events.json"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(raw, encoding="utf-8")
            print(f"[OK] Wrote Argon Verified Events to {p} ({len(raw)} chars)")

    cost_usd = sum(float(ev.get("cost_usd", 0.0)) for ev in getattr(mesh, "session_history", []))
    print(f"[Vertex AI Surge] Complete! Cost: ${cost_usd:.5f}")

if __name__ == "__main__":
    asyncio.run(main())
