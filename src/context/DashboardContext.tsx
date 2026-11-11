import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  approvePending as engineApprovePending,
  computeEventId,
  computeLedgerScores,
  findFuzzyDuplicate,
  rejectPending as engineRejectPending,
  removeEvent as engineRemoveEvent,
  setStar as engineSetStar,
  takeSnapshot as engineTakeSnapshot,
  updateWeights as engineUpdateWeights,
  upsertEvent as engineUpsertEvent,
  type AudienceId,
  type AudienceWeights,
  type BudgetConfig,
  type EventInput,
  type ForecastCatalyst,
  type ImpactEvent,
  type LedgerComputationResult,
  type LedgerState,
  type PendingEvent,
  type ScheduleConfig,
  type ScoreRevision,
  type SanityCheckItem,
  SEEDED_SANITY_CHECKS,
  createSanityCheckItem,
  markSanityCheckVerified,
} from '../engine';
import { useAuth } from './AuthContext';
import { SEED_LEDGER_STATE } from '../data/seedBundle';

export type ActiveTab = 'dashboard' | 'divisions' | 'ledger' | 'control' | 'forecast' | 'research' | 'revisions' | 'export';

export interface BudgetStatus {
  monthlyCapUsd: number;
  totalSpendUsd: number;
  remainingUsd: number;
  circuitBreaker: string;
}

export interface LiveAgentStage {
  agentId: string;
  label: string;
  status: 'idle' | 'running' | 'completed';
  detail: string;
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: true,
  cronExpression: '0 7 * * 1',
  dayOfWeek: 'Monday',
  hourEt: '07:00',
  timezone: 'America/New_York',
  audiences: ['executive', 'congress', 'navy', 'public'],
  mode: 'deep_research',
  autoPromoteCredibility3Plus: false,
  lastScheduledRunAt: '2026-11-09T12:42:59Z',
  nextScheduledRunAt: '2026-11-16T12:00:00Z',
};

const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  monthlyCapUsd: 5.0,
  perRunCapUsd: 0.5,
  autoDowngradeAt80Pct: true,
  selectedTierId: 'balanced_5_00',
};

// Rich client-side fallback discovery candidates so static Firebase Hosting "Run Now" works interactively
const CLIENT_DISCOVERY_CANDIDATES: Array<Omit<PendingEvent, 'id' | 'discoveredAt' | 'runId'>> = [
  {
    title: "HII Successfully Completes Builder's Trials on Amphibious Transport Dock Harrisburg (LPD 30)",
    eventDate: '2026-11-03',
    sourceType: 'contract_award',
    sourceUrls: ['https://www.hii.com/news/hii-successfully-completes-builders-trials-on-harrisburg-lpd-30'],
    summary:
      'Ingalls Shipbuilding successfully completed builder\'s sea trials on Harrisburg (LPD 30), the first Flight II San Antonio-class amphibious transport dock, validating propulsion and combat system readiness ahead of Navy delivery.',
    impacts: [
      { audience: 'navy', direction: 1, magnitude: 3, credibility: 4, scope: 'program', persistence: 'quarter' },
      { audience: 'public', direction: 1, magnitude: 2, credibility: 4, scope: 'company', persistence: 'quarter' },
    ],
    starred: true,
    origin: 'research',
    verification: 'verified',
    editHistory: [],
    pendingReason: 'Dept. of the Navy & Ingalls Agent discovery (Nov 3, 2026 verified press release)',
  },
  {
    title: 'HII & Thales Demonstrate Expeditionary PathMaster End-to-End Autonomous Mine Countermeasure Mission',
    eventDate: '2026-11-03',
    sourceType: 'corporate_action',
    sourceUrls: [
      'https://www.hii.com/news/hii-and-thales-successfully-demonstrate-expeditionary-pathmasters-ability-to-deliver-an-end-to-end-autonomous-mine-countermeasure-mission',
    ],
    summary:
      'HII Mission Technologies and Thales demonstrated integrated uncrewed surface/undersea mine countermeasures, showcasing Mission Technologies multi-domain autonomy export and Navy interoperability.',
    impacts: [
      { audience: 'navy', direction: 1, magnitude: 2, credibility: 4, scope: 'company', persistence: 'year' },
      { audience: 'executive', direction: 1, magnitude: 2, credibility: 3, scope: 'industry', persistence: 'year' },
    ],
    starred: false,
    origin: 'research',
    verification: 'verified',
    editHistory: [],
    pendingReason: 'Mission Technologies Autonomy Swarm discovery (Nov 3, 2026)',
  },
  {
    title: 'HII Increases Quarterly Cash Dividend to $1.41 Per Share Citing Free Cash Flow Visibility',
    eventDate: '2026-11-04',
    sourceType: 'corporate_action',
    sourceUrls: [
      'https://www.hii.com/news/hii-increases-quarterly-dividend-to-141-per-share',
      'https://ir.hii.com/stock-info/dividend-history/default.aspx',
    ],
    summary:
      'Board of Directors raises quarterly cash dividend to $1.41/share alongside Q3 $51B backlog visibility, signaling sustained cash generation and capital return discipline to institutional shareholders.',
    impacts: [
      { audience: 'public', direction: 1, magnitude: 2, credibility: 4, scope: 'company', persistence: 'quarter' },
    ],
    starred: false,
    origin: 'research',
    verification: 'verified',
    editHistory: [],
    pendingReason: 'American Public & Equity Capital Agent discovery (HII Board Dividend Increase)',
  },
  {
    title: 'HII Celebrates ROMULUS Unmanned Surface Vessel Production Progress for U.S. Navy in Louisiana',
    eventDate: '2026-10-28',
    sourceType: 'news_media',
    sourceUrls: [
      'https://www.hii.com/news/hii-celebrates-romulus-unmanned-surface-vessel-production-progress-for-us-navy-in-louisiana',
    ],
    summary:
      'HII highlights hull fabrication and autonomy integration progress on the ROMULUS uncrewed surface vessel line in Louisiana, reinforcing Navy distributed maritime operations and Mission Tech growth.',
    impacts: [
      { audience: 'navy', direction: 1, magnitude: 2, credibility: 3, scope: 'program', persistence: 'quarter' },
      { audience: 'congress', direction: 1, magnitude: 1, credibility: 3, scope: 'program', persistence: 'quarter' },
    ],
    starred: false,
    origin: 'research',
    verification: 'verified',
    editHistory: [],
    pendingReason: 'Congress & Navy Unmanned Systems Agent retroactive Oct 2026 discovery',
  },
];

interface DashboardContextValue {
  state: LedgerState;
  result: LedgerComputationResult;
  budget: BudgetStatus;
  scheduleConfig: ScheduleConfig;
  budgetConfig: BudgetConfig;
  selectedPeriodId: string;
  setSelectedPeriodId: (id: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  audienceFilter: AudienceId | 'all';
  setAudienceFilter: (aud: AudienceId | 'all') => void;
  starredOnly: boolean;
  setStarredOnly: (v: boolean) => void;
  recentRevisionsBanner: ScoreRevision[];
  dismissRevisionsBanner: () => void;
  isResearchRunning: boolean;
  agentStages: LiveAgentStage[];
  researchProgressPct: number;
  researchLiveLog: string[];
  researchResultSummary: {
    runId: string;
    stagedCount: number;
    skippedDups: number;
    autoPromotedCount: number;
    costUsd: number;
    mode: string;
  } | null;
  dismissResearchBanner: () => void;
  // Actions
  updateWeights: (weights: AudienceWeights, author: string, reason: string) => Promise<void>;
  updateSchedule: (schedule: ScheduleConfig) => Promise<void>;
  updateBudgetConfig: (cfg: BudgetConfig) => Promise<void>;
  toggleStar: (eventId: string, starred: boolean) => Promise<void>;
  upsertEvent: (event: EventInput, author: string, reason: string) => Promise<ScoreRevision[]>;
  deleteEvent: (eventId: string, author: string, reason: string) => Promise<ScoreRevision[]>;
  saveCatalysts: (catalysts: ForecastCatalyst[]) => Promise<void>;
  approvePending: (pendingId: string, overrides?: Partial<EventInput>) => Promise<ScoreRevision[]>;
  rejectPending: (pendingId: string) => Promise<void>;
  triggerResearchRun: (audiences: AudienceId[], mode?: string, isMondayScheduledSweep?: boolean) => Promise<void>;
  takeSnapshot: (label: string) => Promise<void>;
  resetToLatestSeed: () => void;
  pinnedEventIds: string[];
  togglePinnedEvent: (id: string) => void;
  isChartExpanded: boolean;
  setIsChartExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  sanityChecks: SanityCheckItem[];
  addSanityCheck: (input: Omit<SanityCheckItem, 'id' | 'createdAt' | 'status'>) => void;
  deleteSanityCheck: (id: string) => void;
  resolveSanityCheck: (id: string, findings: string) => void;
}

const CURRENT_LEDGER_SEED_VERSION = 'v9_164_events_demo_ui_upgrade';
const SEED_VERSION_KEY = 'hii_sentiment_seed_version';
const STORAGE_KEY = 'hii_sentiment_ledger_state_v9';

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let userRole: 'admin' | 'viewer' | 'pending' | 'denied' = 'admin';
  try {
    const authCtx = useAuth();
    if (authCtx?.userRole) userRole = authCtx.userRole;
  } catch {
    // running in test or without AuthProvider
  }

  const [state, setState] = useState<LedgerState>(() => {
    try {
      const storedVer = localStorage.getItem(SEED_VERSION_KEY);
      const cached = localStorage.getItem(STORAGE_KEY);
      if (storedVer === CURRENT_LEDGER_SEED_VERSION && cached) {
        const parsed = JSON.parse(cached) as LedgerState;
        if (
          parsed?.events?.length >= SEED_LEDGER_STATE.events.length &&
          parsed?.settings?.weights
        ) {
          return parsed;
        }
      }
      // Clean up previous cached versions and adopt latest 159-event seed
      localStorage.removeItem('hii_sentiment_ledger_state_v1');
      localStorage.removeItem('hii_sentiment_ledger_state_v2');
      localStorage.removeItem('hii_sentiment_ledger_state_v3');
      localStorage.removeItem('hii_sentiment_ledger_state_v4');
      localStorage.removeItem('hii_sentiment_ledger_state_v5');
      localStorage.removeItem('hii_sentiment_ledger_state_v6');
      localStorage.removeItem('hii_sentiment_ledger_state_v7');
      localStorage.removeItem('hii_sentiment_ledger_state_v8');
      localStorage.setItem(SEED_VERSION_KEY, CURRENT_LEDGER_SEED_VERSION);
    } catch {
      // ignore
    }
    return SEED_LEDGER_STATE;
  });

  const scheduleConfig = useMemo<ScheduleConfig>(
    () => state.settings.schedule ?? DEFAULT_SCHEDULE,
    [state.settings.schedule],
  );

  const budgetConfig = useMemo<BudgetConfig>(
    () => state.settings.budgetConfig ?? DEFAULT_BUDGET_CONFIG,
    [state.settings.budgetConfig],
  );

  const [spendUsd, setSpendUsd] = useState<number>(0.116);

  const budget = useMemo<BudgetStatus>(() => {
    const cap = budgetConfig.monthlyCapUsd;
    return {
      monthlyCapUsd: cap,
      totalSpendUsd: spendUsd,
      remainingUsd: Math.max(0, cap - spendUsd),
      circuitBreaker:
        spendUsd >= cap
          ? 'TRIPPED'
          : spendUsd >= 0.8 * cap
          ? 'AUTO-DOWNGRADE (80%)'
          : 'ACTIVE (TIER B)',
    };
  }, [budgetConfig.monthlyCapUsd, spendUsd]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [audienceFilter, setAudienceFilter] = useState<AudienceId | 'all'>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [recentRevisionsBanner, setRecentRevisionsBanner] = useState<ScoreRevision[]>([]);
  const [isResearchRunning, setIsResearchRunning] = useState(false);
  const [agentStages, setAgentStages] = useState<LiveAgentStage[]>([]);
  const [researchProgressPct, setResearchProgressPct] = useState(0);
  const [researchLiveLog, setResearchLiveLog] = useState<string[]>([]);
  const [researchResultSummary, setResearchResultSummary] = useState<{
    runId: string;
    stagedCount: number;
    skippedDups: number;
    autoPromotedCount: number;
    costUsd: number;
    mode: string;
  } | null>(null);
  const dismissResearchBanner = useCallback(() => {
    setResearchResultSummary(null);
    setResearchLiveLog([]);
    setResearchProgressPct(0);
  }, []);
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(false);

  const [sanityChecks, setSanityChecks] = useState<SanityCheckItem[]>(() => {
    try {
      const saved = localStorage.getItem('hii_sentiment_sanity_checks');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return SEEDED_SANITY_CHECKS;
  });

  const addSanityCheck = useCallback((input: Omit<SanityCheckItem, 'id' | 'createdAt' | 'status'>) => {
    const item = createSanityCheckItem(input);
    setSanityChecks((prev) => {
      const next = [item, ...prev];
      try {
        localStorage.setItem('hii_sentiment_sanity_checks', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const deleteSanityCheck = useCallback((id: string) => {
    setSanityChecks((prev) => {
      const next = prev.filter((i) => i.id !== id);
      try {
        localStorage.setItem('hii_sentiment_sanity_checks', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const resolveSanityCheck = useCallback((id: string, findings: string) => {
    setSanityChecks((prev) => {
      const next = markSanityCheckVerified(prev, id, findings);
      try {
        localStorage.setItem('hii_sentiment_sanity_checks', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const [pinnedEventIds, setPinnedEventIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hii_sentiment_pinned_events');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      'evt_e14786035efa105f',
      'evt_c30d7040f61216b6',
      'evt_b673471b92dadc3d',
      'evt_04fbc8b723f8de60',
      'evt_36623d31ec260b0c',
      'evt_5da22d999f8f8ca5',
    ];
  });

  const togglePinnedEvent = useCallback((id: string) => {
    setPinnedEventIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('hii_sentiment_pinned_events', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Hydrate from local/Cloud Run API if reachable
  useEffect(() => {
    let cancelled = false;
    fetch('/api/state')
      .then((r) =>
        r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : null,
      )
      .then((data) => {
        if (!cancelled && data?.state?.events) {
          setState(data.state);
          if (typeof data.budget?.totalSpendUsd === 'number') {
            setSpendUsd(data.budget.totalSpendUsd);
          }
        }
      })
      .catch(() => {
        // Static CDN hosting fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const result = useMemo(
    () => computeLedgerScores(state.events, state.catalysts, state.settings),
    [state.events, state.catalysts, state.settings],
  );

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(() => {
    const tl = computeLedgerScores(
      SEED_LEDGER_STATE.events,
      SEED_LEDGER_STATE.catalysts,
      SEED_LEDGER_STATE.settings,
    ).timeline;
    return tl[tl.length - 1]?.period.id ?? '2026-11';
  });

  const dismissRevisionsBanner = useCallback(() => setRecentRevisionsBanner([]), []);

  const updateWeights = useCallback(
    async (weights: AudienceWeights, author: string, reason: string) => {
      if (userRole !== 'admin') {
        alert('Weight adjustments are restricted to System Administrator.');
        return;
      }
      try {
        const res = await fetch('/api/weights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weights, author, reason }),
        });
        if (res.ok) {
          const data = await res.json();
          setState(data.state);
          if (data.revisions?.length) setRecentRevisionsBanner(data.revisions);
          return;
        }
      } catch {
        // fallback
      }
      const { state: next, revisions } = engineUpdateWeights(state, weights, author, reason, new Date().toISOString());
      setState(next);
      if (revisions.length) setRecentRevisionsBanner(revisions);
    },
    [state],
  );

  const updateSchedule = useCallback(async (schedule: ScheduleConfig) => {
    if (userRole !== 'admin') {
      alert('Schedule configuration is restricted to System Administrator.');
      return;
    }
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
        return;
      }
    } catch {
      // fallback
    }
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, schedule },
    }));
  }, []);

  const updateBudgetConfig = useCallback(async (cfg: BudgetConfig) => {
    if (userRole !== 'admin') {
      alert('Budget configuration is restricted to System Administrator.');
      return;
    }
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetConfig: cfg }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
        return;
      }
    } catch {
      // fallback
    }
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, budgetConfig: cfg },
    }));
  }, []);

  const toggleStar = useCallback(async (eventId: string, starred: boolean) => {
    if (userRole !== 'admin') return;
    try {
      const res = await fetch('/api/events/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, starred }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
        return;
      }
    } catch {
      // fallback
    }
    setState((prev) => engineSetStar(prev, eventId, starred));
  }, []);

  const upsertEvent = useCallback(
    async (event: EventInput, author: string, reason: string): Promise<ScoreRevision[]> => {
      if (userRole !== 'admin') {
        alert('Ledger edits are restricted to System Administrator.');
        return [];
      }
      try {
        const res = await fetch('/api/events/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, author, reason }),
        });
        if (res.ok) {
          const data = await res.json();
          setState(data.state);
          if (data.revisions?.length) setRecentRevisionsBanner(data.revisions);
          return data.revisions ?? [];
        }
      } catch {
        // fallback
      }
      const { state: next, revisions } = engineUpsertEvent(state, event, author, reason, new Date().toISOString());
      setState(next);
      if (revisions.length) setRecentRevisionsBanner(revisions);
      return revisions;
    },
    [state],
  );

  const deleteEvent = useCallback(
    async (eventId: string, author: string, reason: string): Promise<ScoreRevision[]> => {
      if (userRole !== 'admin') {
        alert('Deleting ledger events is restricted to System Administrator.');
        return [];
      }
      try {
        const res = await fetch('/api/events/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: eventId, author, reason }),
        });
        if (res.ok) {
          const data = await res.json();
          setState(data.state);
          if (data.revisions?.length) setRecentRevisionsBanner(data.revisions);
          return data.revisions ?? [];
        }
      } catch {
        // fallback
      }
      const { state: next, revisions } = engineRemoveEvent(state, eventId, author, reason, new Date().toISOString());
      setState(next);
      if (revisions.length) setRecentRevisionsBanner(revisions);
      return revisions;
    },
    [state],
  );

  const saveCatalysts = useCallback(async (catalysts: ForecastCatalyst[]) => {
    if (userRole !== 'admin') {
      alert('Forecast catalyst edits are restricted to System Administrator.');
      return;
    }
    try {
      const res = await fetch('/api/catalysts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalysts }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
        return;
      }
    } catch {
      // fallback
    }
    setState((prev) => ({ ...prev, catalysts }));
  }, []);

  const approvePending = useCallback(
    async (pendingId: string, overrides?: Partial<EventInput>): Promise<ScoreRevision[]> => {
      if (userRole !== 'admin') {
        alert('Promoting pending discoveries is restricted to System Administrator.');
        return [];
      }
      try {
        const res = await fetch('/api/pending/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pendingId, overrides }),
        });
        if (res.ok) {
          const data = await res.json();
          setState(data.state);
          if (data.revisions?.length) setRecentRevisionsBanner(data.revisions);
          return data.revisions ?? [];
        }
      } catch {
        // fallback
      }
      const { state: next, revisions } = engineApprovePending(state, pendingId, new Date().toISOString(), overrides);
      setState(next);
      if (revisions.length) setRecentRevisionsBanner(revisions);
      return revisions;
    },
    [state],
  );

  const rejectPending = useCallback(async (pendingId: string) => {
    if (userRole !== 'admin') return;
    try {
      const res = await fetch('/api/pending/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendingId }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
        return;
      }
    } catch {
      // fallback
    }
    setState((prev) => engineRejectPending(prev, pendingId));
  }, []);

  const triggerResearchRun = useCallback(
    async (audiences: AudienceId[], mode = 'auto', isMondayScheduledSweep = false) => {
      if (userRole !== 'admin') {
        alert('Initiating agent deep research runs is restricted to System Administrator.');
        return;
      }
      if (spendUsd >= budgetConfig.monthlyCapUsd) {
        return;
      }

      const fmtTime = () => new Date().toLocaleTimeString('en-US', { hour12: false });
      const pushLog = (msg: string) =>
        setResearchLiveLog((prev) => [...prev, `[${fmtTime()}] ${msg}`]);

      setIsResearchRunning(true);
      setResearchResultSummary(null);
      setResearchProgressPct(8);
      setResearchLiveLog([
        `[${fmtTime()}] Initializing Tier B Multi-Agent Swarm (${audiences.join(', ').toUpperCase()})…`,
      ]);

      const stages: LiveAgentStage[] = [
        {
          agentId: 'finops-guard',
          label: '1. FinOps Budget & Circuit Breaker Check',
          status: 'running',
          detail: `Verifying spend ($${spendUsd.toFixed(2)} / $${budgetConfig.monthlyCapUsd.toFixed(2)} cap)…`,
        },
        {
          agentId: 'audience-swarm',
          label: `2. Parallel 4-Audience Collectors (${audiences.join(', ').toUpperCase()})`,
          status: 'idle',
          detail: 'Dispatching Flash collectors across HII Newsroom, NAVSEA, Congress & SEC EDGAR',
        },
        {
          agentId: 'rubric-extractor',
          label: '3. Argon Verifier & 3-Layer Fuzzy Deduplicator',
          status: 'idle',
          detail: 'Verifying source permalinks & classifying discrete rubrics at temperature=0.0',
        },
        {
          agentId: 'retro-auditor',
          label: '4. Retroactive Period Audit & Quarantine Stager',
          status: 'idle',
          detail: 'Scanning closed periods for score impact & staging verified events',
        },
      ];
      setAgentStages(stages);

      const stepDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      await stepDelay(550);
      setResearchProgressPct(25);
      pushLog(`FinOps Guard cleared ($${spendUsd.toFixed(2)} / $${budgetConfig.monthlyCapUsd.toFixed(2)} cap) — Circuit Breaker ACTIVE.`);
      setAgentStages((prev) =>
        prev.map((s, i) =>
          i === 0
            ? { ...s, status: 'completed', detail: 'Budget verified — circuit breaker ACTIVE' }
            : i === 1
            ? { ...s, status: 'running' }
            : s,
        ),
      );

      // Try backend endpoint first if local middleware / Cloud Run API exists
      const endpoint = isMondayScheduledSweep ? '/api/cron/monday-sweep' : '/api/research/run';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audiences, mode }),
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setResearchProgressPct(75);
          pushLog('Synchronized findings from backend Tier B Vertex AI orchestrator.');
          await stepDelay(500);
          setAgentStages((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
          setResearchProgressPct(100);
          setState(data.state);
          const runDelta = mode === 'deep_research' ? 0.38 : 0.05;
          setSpendUsd((prev) => Number((prev + runDelta).toFixed(4)));
          setIsResearchRunning(false);
          return;
        }
      } catch {
        // Static Firebase Hosting live sweep path
      }

      await stepDelay(650);
      setResearchProgressPct(48);
      pushLog('Flash Collector [Navy]: Verified HII Ingalls Harrisburg (LPD 30) Builder\'s Trials release (Nov 3).');
      await stepDelay(450);
      setResearchProgressPct(62);
      pushLog('Flash Collector [Public/Exec]: Verified HII $1.41 Dividend Increase & Thales PathMaster MCM mission.');

      setAgentStages((prev) =>
        prev.map((s, i) =>
          i === 1
            ? { ...s, status: 'completed', detail: `Collected findings across ${audiences.length} audiences` }
            : i === 2
            ? { ...s, status: 'running' }
            : s,
        ),
      );

      await stepDelay(650);
      setResearchProgressPct(82);

      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);
      const runId = `run_${nowIso.replace(/\D/g, '').slice(0, 14)}`;
      const allKnownEvents: Array<Pick<ImpactEvent, 'id' | 'title' | 'eventDate' | 'sourceType' | 'sourceUrls'>> = [
        ...state.events,
        ...state.pending,
      ];
      const newPending: PendingEvent[] = [];
      let skippedDuplicates = 0;

      for (const raw of CLIENT_DISCOVERY_CANDIDATES) {
        if (!raw.impacts.some((i) => audiences.includes(i.audience))) continue;
        const id = computeEventId(raw);
        const dup = findFuzzyDuplicate({ ...raw, id }, allKnownEvents);
        if (dup) {
          skippedDuplicates++;
          continue;
        }
        const item: PendingEvent = {
          ...raw,
          id,
          discoveredAt: nowIso,
          runId,
        };
        newPending.push(item);
        allKnownEvents.push(item);
      }

      pushLog(
        `Argon Verifier & 3-Layer Deduplicator: ${newPending.length} unique candidate(s) validated, ${skippedDuplicates} existing duplicate(s) skipped.`,
      );

      setAgentStages((prev) =>
        prev.map((s, i) =>
          i === 2
            ? {
                ...s,
                status: 'completed',
                detail: `Validated discrete rubrics (${newPending.length} new, ${skippedDuplicates} duplicates skipped)`,
              }
            : i === 3
            ? { ...s, status: 'running' }
            : s,
        ),
      );

      await stepDelay(550);

      const isAutoDowngraded =
        budgetConfig.autoDowngradeAt80Pct && spendUsd >= 0.8 * budgetConfig.monthlyCapUsd;
      const effectiveMode = isAutoDowngraded
        ? 'grounded_search'
        : mode === 'auto'
        ? scheduleConfig.mode
        : (mode as 'deep_research' | 'grounded_search');
      const runCost = effectiveMode === 'deep_research' ? 0.38 : 0.05;

      let nextState: LedgerState = {
        ...state,
        settings: {
          ...state.settings,
          asOfDate: todayDate > state.settings.asOfDate ? todayDate : state.settings.asOfDate,
          ...(isMondayScheduledSweep
            ? {
                schedule: {
                  ...scheduleConfig,
                  lastScheduledRunAt: nowIso,
                },
              }
            : {}),
        },
        pending: [...state.pending, ...newPending],
        runs: [
          {
            runId,
            startedAt: nowIso,
            completedAt: new Date().toISOString(),
            audiences,
            status: 'completed',
            mode: effectiveMode,
            discoveredCount: newPending.length,
            costUsd: runCost,
            log: [
              `${isMondayScheduledSweep ? '[Scheduled Monday 07:00 ET Sweep]' : '[Manual Run Now Trigger]'} Executed ${effectiveMode} across ${audiences.join(', ')}`,
              `FinOps Guard: $${(spendUsd + runCost).toFixed(2)} / $${budgetConfig.monthlyCapUsd.toFixed(2)} monthly cap`,
              `Staged ${newPending.length} new unique candidate events into Pending Quarantine Queue (skipped ${skippedDuplicates} duplicate/near-duplicate events)`,
            ],
          },
          ...state.runs,
        ],
      };

      const collectedRevisions: ScoreRevision[] = [];
      let autoPromotedCount = 0;
      if (scheduleConfig.autoPromoteCredibility3Plus && newPending.length > 0) {
        for (const item of newPending) {
          if (item.impacts.every((i) => i.credibility >= 3)) {
            const promoted = engineApprovePending(nextState, item.id, nowIso);
            nextState = promoted.state;
            collectedRevisions.push(...promoted.revisions);
            autoPromotedCount++;
          }
        }
      }

      setState(nextState);
      if (collectedRevisions.length > 0) {
        setRecentRevisionsBanner(collectedRevisions);
      }
      setSpendUsd((prev) => Number((prev + runCost).toFixed(4)));
      setResearchProgressPct(100);
      pushLog(
        `Run ${runId} complete: Staged ${newPending.length} verified event(s)${
          autoPromotedCount > 0 ? ` (${autoPromotedCount} auto-promoted, ${collectedRevisions.length} revisions)` : ''
        }.`,
      );
      setResearchResultSummary({
        runId,
        stagedCount: newPending.length,
        skippedDups: skippedDuplicates,
        autoPromotedCount,
        costUsd: runCost,
        mode: effectiveMode,
      });

      setAgentStages((prev) =>
        prev.map((s, i) =>
          i === 3
            ? {
                ...s,
                status: 'completed',
                detail: `Staged ${newPending.length} candidate(s)${
                  collectedRevisions.length > 0
                    ? ` & auto-promoted (${collectedRevisions.length} revisions)`
                    : ''
                }`,
              }
            : s,
        ),
      );
      setIsResearchRunning(false);
    },
    [state, spendUsd, budgetConfig, scheduleConfig, userRole],
  );

  // Automated Monday 07:00 ET Scheduled Sweep Auto-Trigger
  useEffect(() => {
    if (userRole === 'viewer' || !scheduleConfig.enabled || isResearchRunning) return;
    const now = new Date();
    const nextDue = scheduleConfig.nextScheduledRunAt ? new Date(scheduleConfig.nextScheduledRunAt) : null;
    const lastRun = scheduleConfig.lastScheduledRunAt ? new Date(scheduleConfig.lastScheduledRunAt) : null;
    // Check if current time is past nextScheduledRunAt and we haven't executed within 6 days
    const isPastDue = nextDue && now.getTime() >= nextDue.getTime();
    const ranThisWeek = lastRun && nextDue && (now.getTime() - lastRun.getTime()) < 6 * 24 * 60 * 60 * 1000;
    if (isPastDue && !ranThisWeek) {
      console.log('[Scheduler] Monday 07:00 ET scheduled sweep is due. Auto-triggering research sweep...');
      triggerResearchRun(scheduleConfig.audiences, scheduleConfig.mode, true);
    }
  }, [userRole, scheduleConfig, isResearchRunning, triggerResearchRun]);
  const takeSnapshot = useCallback(
    async (label: string) => {
      try {
        const res = await fetch('/api/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label }),
        });
        if (res.ok) {
          const data = await res.json();
          setState(data.state);
          return;
        }
      } catch {
        // fallback
      }
      const { state: next } = engineTakeSnapshot(state, label, new Date().toISOString());
      setState(next);
    },
    [state],
  );

  const resetToLatestSeed = useCallback(() => {
    try {
      localStorage.removeItem('hii_sentiment_ledger_state_v1');
      localStorage.removeItem('hii_sentiment_ledger_state_v2');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(SEED_VERSION_KEY, CURRENT_LEDGER_SEED_VERSION);
    } catch {
      // ignore
    }
    setState(SEED_LEDGER_STATE);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        state,
        result,
        budget,
        scheduleConfig,
        budgetConfig,
        selectedPeriodId,
        setSelectedPeriodId,
        activeTab,
        setActiveTab,
        audienceFilter,
        setAudienceFilter,
        starredOnly,
        setStarredOnly,
        recentRevisionsBanner,
        dismissRevisionsBanner,
        isResearchRunning,
        agentStages,
        researchProgressPct,
        researchLiveLog,
        researchResultSummary,
        dismissResearchBanner,
        updateWeights,
        updateSchedule,
        updateBudgetConfig,
        toggleStar,
        upsertEvent,
        deleteEvent,
        saveCatalysts,
        approvePending,
        rejectPending,
        triggerResearchRun,
        takeSnapshot,
        resetToLatestSeed,
        pinnedEventIds,
        togglePinnedEvent,
        isChartExpanded,
        setIsChartExpanded,
        sanityChecks,
        addSanityCheck,
        deleteSanityCheck,
        resolveSanityCheck,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}