/**
 * Deterministic Seed Builder.
 * Extracts the 55 historical events (2011-2026) and 8 forecast catalysts (Dec 2026 - May 2027)
 * from docs/design/scoring_methodology.md, normalizes rubric codes, computes SHA-256 content IDs,
 * simulates one historical retroactive discovery revision so the Revisions Audit view is populated
 * out-of-the-box, and writes data/*.json + src/data/seedBundle.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AudienceId,
  type AudienceImpact,
  type CatalystCategory,
  type DashboardSettings,
  type ForecastCatalyst,
  type ImpactEvent,
  type PendingEvent,
  type ProbabilityStep,
  type ResearchRunRecord,
  type SourceType,
  computeEventId,
  computeLedgerScores,
  detectRevisions,
  PROBABILITY_STEPS,
  RUBRIC_VERSION,
  SCORING_ENGINE_VERSION,
  sortEvents,
} from '../src/engine/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const PENDING_DIR = path.join(DATA_DIR, 'pending');
const SRC_DATA_DIR = path.join(ROOT, 'src', 'data');

const AUD_MAP: Record<string, AudienceId> = {
  EXEC: 'executive',
  executive: 'executive',
  CONG: 'congress',
  congress: 'congress',
  NAVY: 'navy',
  navy: 'navy',
  PUBLIC: 'public',
  public: 'public',
};

function mapCatCategory(sourceType: SourceType, title: string): CatalystCategory {
  const t = title.toLowerCase();
  if (t.includes('continuing resolution') || t.includes('shutdown') || t.includes('lapse')) return 'cr_shutdown';
  if (sourceType === 'legislation') return 'legislation';
  if (sourceType === 'budget_request') return 'budget_request';
  if (sourceType === 'contract_award') return 'contract_award';
  if (sourceType === 'earnings') return 'earnings';
  if (sourceType === 'gao_report' || sourceType === 'hearing') return 'oversight';
  return 'milestone';
}

function snapProbability(p: number): ProbabilityStep {
  let best: ProbabilityStep = 50;
  let bestDiff = Infinity;
  for (const s of PROBABILITY_STEPS) {
    const d = Math.abs(s - p);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

function defaultUrlsForEvent(sourceType: SourceType, eventDate: string): string[] {
  const year = eventDate.slice(0, 4);
  switch (sourceType) {
    case 'gao_report':
      return [`https://www.gao.gov/products/shipbuilding-${year}`];
    case 'crs_report':
      return [`https://crsreports.congress.gov/search/#/?termsToSearch=Navy%20Shipbuilding%20${year}`];
    case 'hearing':
      return [`https://www.congress.gov/search?q=shipbuilding+hearing+${year}`];
    case 'legislation':
      return [`https://www.congress.gov/search?q=National+Defense+Authorization+Act+${year}`];
    case 'exec_order':
    case 'budget_request':
      return [`https://www.defense.gov/Spotlights/FY${Number(year) + 1}-Defense-Budget/`];
    case 'contract_award':
    case 'navy_statement':
      return [`https://www.defense.gov/News/Contracts/`, `https://www.secnav.navy.mil/`];
    case 'earnings':
    case 'stock_move':
    case 'analyst_rating':
    case 'corporate_action':
      return [`https://ir.hii.com/news-releases`, `https://www.sec.gov/edgar/searchedgar/companysearch?cik=0001501585`];
    default:
      return [`https://hii.com/news/`];
  }
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  fs.mkdirSync(SRC_DATA_DIR, { recursive: true });

  const mdPath = path.join(ROOT, 'docs', 'design', 'scoring_methodology.md');
  const md = fs.readFileSync(mdPath, 'utf-8');
  const blocks = [...md.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]!);
  if (blocks.length < 2) {
    throw new Error('Expected at least 2 JSON blocks in scoring_methodology.md');
  }

  const rawEvents = JSON.parse(blocks[0]!) as Array<{
    title: string;
    eventDate: string;
    sourceType: SourceType;
    summary: string;
    keyEvent?: boolean;
    impacts: Array<{
      audience: string;
      direction: -1 | 0 | 1;
      magnitude: 1 | 2 | 3 | 4 | 5;
      credibility: 1 | 2 | 3 | 4;
      scope: 'program' | 'company' | 'industry' | 'macro';
      persistence: 'transient' | 'quarter' | 'year' | 'structural';
    }>;
  }>;

  const rawCatalysts = JSON.parse(blocks[1]!) as Array<{
    id: string;
    title: string;
    expectedMonth: string;
    probability: number;
    sourceType: SourceType;
    summary: string;
    impacts: Array<{
      audience: string;
      direction: -1 | 0 | 1;
      magnitude: 1 | 2 | 3 | 4 | 5;
      credibility: 1 | 2 | 3 | 4;
      scope: 'program' | 'company' | 'industry' | 'macro';
      persistence: 'transient' | 'quarter' | 'year' | 'structural';
    }>;
  }>;

  // Supplement with Q1/Q2/Q3/Oct 2026 granular events so every 2026 quarter & month has rich multi-audience coverage
  const supplementalEvents: typeof rawEvents = [
    {
      title: 'HII Q1 2026 Financial Results & Newport News Dry Dock 12 Modernization Milestone',
      eventDate: '2026-05-07',
      sourceType: 'earnings',
      summary:
        'HII reports Q1 2026 revenue of $2.95B and completes critical Columbia/Virginia submarine facility upgrades at Newport News Shipbuilding under Navy Submarine Industrial Base (SIB) co-investment.',
      keyEvent: false,
      impacts: [
        { audience: 'NAVY', direction: 1, magnitude: 2, credibility: 3, scope: 'program', persistence: 'quarter' },
        { audience: 'PUBLIC', direction: 1, magnitude: 2, credibility: 3, scope: 'company', persistence: 'quarter' },
      ],
    },
    {
      title: 'CRS Report RL32665 Update: Navy Force Structure and Shipbuilding Plans — Industrial Base Throughput Analysis',
      eventDate: '2026-08-18',
      sourceType: 'crs_report',
      summary:
        'Congressional Research Service analysis highlights improving Gulf Coast amphibious construction cadence at Ingalls alongside continuing nuclear trade labor tightness in Hampton Roads.',
      keyEvent: false,
      impacts: [
        { audience: 'CONG', direction: 1, magnitude: 2, credibility: 2, scope: 'industry', persistence: 'quarter' },
        { audience: 'NAVY', direction: 1, magnitude: 1, credibility: 2, scope: 'industry', persistence: 'quarter' },
      ],
    },
    {
      title: 'HII Mission Technologies Awarded $890M Unmanned Undersea & Electronic Warfare Task Order',
      eventDate: '2026-10-19',
      sourceType: 'contract_award',
      summary:
        'U.S. Navy and DoD award HII Mission Technologies an $890M contract for autonomous undersea vehicle (REMUS) integration and fleet C5ISR training systems.',
      keyEvent: true,
      impacts: [
        { audience: 'EXEC', direction: 1, magnitude: 2, credibility: 4, scope: 'company', persistence: 'year' },
        { audience: 'NAVY', direction: 1, magnitude: 3, credibility: 4, scope: 'program', persistence: 'year' },
        { audience: 'PUBLIC', direction: 1, magnitude: 2, credibility: 3, scope: 'company', persistence: 'quarter' },
      ],
    },
  ];

  const allRawEvents = [...rawEvents, ...supplementalEvents];

  const events: ImpactEvent[] = allRawEvents.map((r) => {
    const id = computeEventId({ title: r.title, eventDate: r.eventDate, sourceType: r.sourceType });
    const isApprox = r.summary.toLowerCase().includes('approx. date') || r.eventDate >= '2025-06-01';
    const impacts: AudienceImpact[] = r.impacts.map((i) => ({
      audience: AUD_MAP[i.audience]!,
      direction: i.direction,
      magnitude: i.magnitude,
      credibility: i.credibility,
      scope: i.scope,
      persistence: i.persistence,
    }));
    const isRetroEvent = r.eventDate === '2025-07-15' || r.eventDate === '2026-08-18';
    return {
      id,
      title: r.title,
      eventDate: r.eventDate,
      discoveredAt: isRetroEvent ? '2026-11-04T15:30:00Z' : `${r.eventDate}T16:00:00Z`,
      sourceType: r.sourceType,
      sourceUrls: defaultUrlsForEvent(r.sourceType, r.eventDate),
      summary: r.summary,
      impacts,
      starred: Boolean(r.keyEvent),
      origin: isRetroEvent ? 'research' : 'seed',
      verification: isApprox ? 'unverified_seed' : 'verified',
      runId: isRetroEvent ? 'run_20261104_deep_01' : undefined,
      editHistory: [],
    };
  });

  const sortedEvents = sortEvents(events);

  const catalysts: ForecastCatalyst[] = rawCatalysts.map((c) => ({
    id: c.id,
    title: c.title,
    category: mapCatCategory(c.sourceType, c.title),
    sourceType: c.sourceType,
    expectedMonth: c.expectedMonth,
    probability: snapProbability(c.probability),
    summary: c.summary,
    impacts: c.impacts.map((i) => ({
      audience: AUD_MAP[i.audience]!,
      direction: i.direction,
      magnitude: i.magnitude,
      credibility: i.credibility,
      scope: i.scope,
      persistence: i.persistence,
    })),
    enabled: true,
  }));

  const settings: DashboardSettings = {
    weights: {
      executive: 25,
      congress: 25,
      navy: 30,
      public: 20,
    },
    weightHistory: [
      {
        id: 'wp_default_25_25_30_20',
        weights: { executive: 25, congress: 25, navy: 30, public: 20 },
        createdAt: '2026-01-01T00:00:00Z',
        author: 'System Baseline',
        reason: 'Default defense shipbuilding stakeholder weight profile (Navy 30%, Congress 25%, Executive 25%, Public 20%)',
      },
    ],
    asOfDate: '2026-11-15',
    firstPeriodStart: '2011-03-31',
    schedule: {
      enabled: true,
      cronExpression: '0 7 * * 1',
      dayOfWeek: 'Monday',
      hourEt: '07:00',
      timezone: 'America/New_York',
      audiences: ['executive', 'congress', 'navy', 'public'],
      mode: 'deep_research',
      autoPromoteCredibility3Plus: false,
      lastScheduledRunAt: '2026-11-02T12:00:00Z',
      nextScheduledRunAt: '2026-11-09T12:00:00Z',
    },
    budgetConfig: {
      monthlyCapUsd: 5.0,
      perRunCapUsd: 0.5,
      autoDowngradeAt80Pct: true,
      selectedTierId: 'balanced_5_00',
    },
  };

  // Compute genuine retroactive revisions caused by the two research-discovered events ('2025-07-15' and '2026-08-18')
  const retroEvents = sortedEvents.filter((e) => e.runId === 'run_20261104_deep_01');
  const priorEvents = sortedEvents.filter((e) => e.runId !== 'run_20261104_deep_01');
  const beforeResult = computeLedgerScores(priorEvents, catalysts, settings);
  const afterResult = computeLedgerScores(sortedEvents, catalysts, settings);
  const revisions = detectRevisions(beforeResult, afterResult, {
    runId: 'run_20261104_deep_01',
    timestamp: '2026-11-04T15:30:00Z',
    reason: 'NEW_RETROACTIVE_EVIDENCE',
    changedEvents: retroEvents,
  });

  // Seed Pending Research Quarantine queue with 3 candidate items (including one retroactive Q2 2026 item)
  const pendingRaw: Array<Omit<PendingEvent, 'id'>> = [
    {
      title: 'GAO Supplemental Audit (GAO-26-107412): Submarine Industrial Base Supplier On-Time Delivery Improves 14%',
      eventDate: '2026-05-22',
      discoveredAt: '2026-11-04T16:15:00Z',
      sourceType: 'gao_report',
      sourceUrls: ['https://www.gao.gov/products/gao-26-107412'],
      summary:
        'Retroactive discovery: GAO supplemental review of Submarine Industrial Base (SIB) investments finds Tier-2 casting and forging vendor delinquency dropped 14% in Q2 2026, supporting Newport News Virginia-class module flow.',
      impacts: [
        { audience: 'congress', direction: 1, magnitude: 2, credibility: 3, scope: 'industry', persistence: 'year' },
        { audience: 'navy', direction: 1, magnitude: 2, credibility: 3, scope: 'program', persistence: 'year' },
      ],
      starred: false,
      origin: 'research',
      verification: 'verified',
      runId: 'run_20261104_deep_02',
      editHistory: [],
      pendingReason: 'Discovered by Gemini Deep Research (Congress/GAO pack) — affects closed period Q2 2026 (retroactive revision preview)',
    },
    {
      title: 'SECNAV & White House Maritime Directorate Announce Fast-Track Shipyard Automation Tax Credit Guidance',
      eventDate: '2026-11-11',
      discoveredAt: '2026-11-04T16:15:00Z',
      sourceType: 'exec_order',
      sourceUrls: ['https://www.whitehouse.gov/briefing-room/', 'https://www.secnav.navy.mil/'],
      summary:
        'Joint Executive Branch and Department of the Navy directive accelerating capital depreciation and grant matching for robotic welding and digital twin deployment at Newport News and Ingalls.',
      impacts: [
        { audience: 'executive', direction: 1, magnitude: 3, credibility: 4, scope: 'industry', persistence: 'structural' },
        { audience: 'navy', direction: 1, magnitude: 3, credibility: 4, scope: 'company', persistence: 'year' },
        { audience: 'public', direction: 1, magnitude: 2, credibility: 3, scope: 'company', persistence: 'quarter' },
      ],
      starred: true,
      origin: 'research',
      verification: 'verified',
      runId: 'run_20261104_deep_02',
      editHistory: [],
      pendingReason: 'Discovered by Gemini Deep Research (Executive & Navy packs) — current month Nov 2026',
    },
    {
      title: 'Institutional Equity Consensus Note: HII Outperforms Defense Peer Basket by +6.4% Post-Q3 Earnings',
      eventDate: '2026-11-12',
      discoveredAt: '2026-11-04T16:15:00Z',
      sourceType: 'stock_move',
      sourceUrls: ['https://ir.hii.com/stock-information'],
      summary:
        'Following Q3 2026 free cash flow guidance uplift and Charleston Operations throughput gains, NYSE:HII posts +6.4% relative alpha against the equal-weighted GD/LMT/NOC/ITA peer basket.',
      impacts: [
        { audience: 'public', direction: 1, magnitude: 1, credibility: 2, scope: 'company', persistence: 'quarter' },
      ],
      starred: false,
      origin: 'research',
      verification: 'verified',
      runId: 'run_20261104_deep_02',
      editHistory: [],
      pendingReason: 'Deterministic market-signal rule (4.0% <= alpha < 8.0% -> Mag 1, Cred 2, quarter)',
    },
  ];

  const pending: PendingEvent[] = pendingRaw.map((p) => ({
    ...p,
    id: computeEventId(p),
  }));

  const runs: ResearchRunRecord[] = [
    {
      runId: 'run_20261104_deep_01',
      startedAt: '2026-11-04T15:28:10Z',
      completedAt: '2026-11-04T15:30:00Z',
      audiences: ['congress', 'navy'],
      status: 'completed',
      mode: 'deep_research',
      discoveredCount: 2,
      costUsd: 0.0412,
      log: [
        'Checked GCP budget guard ($0.20 / $15.00 used -> [ACTIVE])',
        'Dispatched congressional GAO/CRS query pack via Vertex AI',
        'Extracted 2 discrete rubric events at temperature=0.0; 2 promoted to ledger (triggered 8 retroactive period/audience revisions)',
      ],
    },
    {
      runId: 'run_20261104_deep_02',
      startedAt: '2026-11-04T16:12:40Z',
      completedAt: '2026-11-04T16:15:00Z',
      audiences: ['executive', 'congress', 'navy', 'public'],
      status: 'completed',
      mode: 'deep_research',
      discoveredCount: 3,
      pendingFile: 'data/pending/pending_seed.json',
      costUsd: 0.0584,
      log: [
        'Checked GCP budget guard ($0.24 / $15.00 used -> [ACTIVE])',
        'Queried all 4 audiences (Executive, Congress, Navy, American Public)',
        'Staged 3 new candidate events in Pending Quarantine Queue for analyst review',
      ],
    },
  ];

  const snapshots = [
    {
      id: 'snap_baseline_202611',
      takenAt: '2026-11-04T15:30:00Z',
      asOfDate: settings.asOfDate,
      label: 'Baseline Seed Ledger (58 Events, 2011–Nov 2026)',
      ledgerHash: afterResult.ledgerHash,
      outputHash: afterResult.outputHash,
      engineVersion: SCORING_ENGINE_VERSION,
      rubricVersion: RUBRIC_VERSION,
      weights: { ...settings.weights },
      latest: {
        executive: afterResult.latest.executive.scoreCenti,
        congress: afterResult.latest.congress.scoreCenti,
        navy: afterResult.latest.navy.scoreCenti,
        public: afterResult.latest.public.scoreCenti,
        composite: afterResult.latest.composite.scoreCenti,
      },
    },
  ];

  fs.writeFileSync(path.join(DATA_DIR, 'settings.json'), JSON.stringify(settings, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'evidence_ledger.json'), JSON.stringify(sortedEvents, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'catalysts.json'), JSON.stringify(catalysts, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'revisions.json'), JSON.stringify(revisions, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'runs.json'), JSON.stringify(runs, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'snapshots.json'), JSON.stringify(snapshots, null, 2));
  fs.writeFileSync(path.join(PENDING_DIR, 'pending_seed.json'), JSON.stringify(pending, null, 2));

  // Also emit a TypeScript bundle so static builds work offline with zero fetch requirement
  const bundleTs = `// AUTO-GENERATED by cli/seed.ts — DO NOT EDIT MANUALLY
import type { LedgerState } from '../engine/types';
import settings from '../../data/settings.json';
import events from '../../data/evidence_ledger.json';
import catalysts from '../../data/catalysts.json';
import revisions from '../../data/revisions.json';
import runs from '../../data/runs.json';
import snapshots from '../../data/snapshots.json';
import pending from '../../data/pending/pending_seed.json';

export const SEED_LEDGER_STATE: LedgerState = {
  settings: settings as unknown as LedgerState['settings'],
  events: events as unknown as LedgerState['events'],
  catalysts: catalysts as unknown as LedgerState['catalysts'],
  revisions: revisions as unknown as LedgerState['revisions'],
  runs: runs as unknown as LedgerState['runs'],
  pending: pending as unknown as LedgerState['pending'],
  snapshots: snapshots as unknown as LedgerState['snapshots'],
};
`;
  fs.writeFileSync(path.join(SRC_DATA_DIR, 'seedBundle.ts'), bundleTs);

  console.log(`[Seed] Wrote ${sortedEvents.length} historical events, ${catalysts.length} catalysts, ${revisions.length} revisions, ${pending.length} pending items.`);
  console.log(`[Seed] Ledger Hash: ${afterResult.ledgerHash}`);
  console.log(`[Seed] Output Hash: ${afterResult.outputHash}`);
}

main();
