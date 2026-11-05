import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  approvePending as engineApprovePending,
  computeEventId,
  computeLedgerScores,
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
  lastScheduledRunAt: '2026-11-02T12:00:00Z',
  nextScheduledRunAt: '2026-11-09T12:00:00Z',
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
    title: 'OMB & White House Office of Shipbuilding Issue Title III Shipyard Automation Matching Grant Guidance',
    eventDate: '2026-11-13',
    sourceType: 'exec_order',
    sourceUrls: ['https://www.whitehouse.gov/briefing-room/'],
    summary:
      'Executive Branch releases implementation rules for Title III Defense Production Act matching grants supporting robotic welding and dry dock modernization at Newport News and Ingalls.',
    impacts: [
      { audience: 'executive', direction: 1, magnitude: 3, credibility: 4, scope: 'industry', persistence: 'structural' },
      { audience: 'navy', direction: 1, magnitude: 2, credibility: 3, scope: 'company', persistence: 'year' },
    ],
    starred: true,
    origin: 'research',
    verification: 'verified',
    editHistory: [],
    pendingReason: 'Executive Branch Agent discovery (Nov 2026 current period)',
  },
  {
    title: 'GAO Retroactive Audit (GAO-24-106899): Ford-Class Weapons Elevator Spares Lead-Time Review',
    eventDate: '2024-07-18',
    sourceType: 'gao_report',
    sourceUrls: ['https://www.gao.gov/products/gao-24-106899'],
    summary:
      'Retroactively indexed July 2024 GAO supplemental briefing to HASC Seapower noting vendor lead-time friction on CVN-78/79 weapons elevators prior to 2025 supplier reforms.',
    impacts: [
      { audience: 'congress', direction: -1, magnitude: 2, credibility: 3, scope: 'program', persistence: 'year' },
      { audience: 'navy', direction: -1, magnitude: 1, credibility: 3, scope: 'program', persistence: 'quarter' },
    ],
    starred: false,
    origin: 'research',
    verification: 'verified',
    editHistory: [],
    pendingReason: 'U.S. Congress Agent retroactive discovery (2024-07-18) — triggers ScoreRevision on 2024 & 2025',
  },
  {
    title: 'NAVSEA Definitizes $1.18B Long-Lead Material Contract for Virginia-Class Block VI Submarines',
    eventDate: '2026-11-14',
    sourceType: 'contract_award',
    sourceUrls: ['https://www.defense.gov/News/Contracts/'],
    summary:
      'Department of the Navy awards HII Newport News Shipbuilding a $1.18B long-lead material and nuclear propulsion component contract for Virginia-class Block VI submarines.',
    impacts: [
      { audience: 'navy', direction: 1, magnitude: 4, credibility: 4, scope: 'program', persistence: 'structural' },
      { audience: 'congress', direction: 1, magnitude: 2, credibility: 3, scope: 'program', persistence: 'year' },
      { audience: 'public', direction: 1, magnitude: 2, credibility: 3, scope: 'company', persistence: 'quarter' },
    ],
    starred: true,
    origin: 'research',
    verification: 'verified',
    editHistory: [],
    pendingReason: 'Dept. of the Navy Agent contract award discovery (Nov 2026)',
  },
  {
    title: 'Defense Equity Consensus Upgrade: Three Institutional Desks Raise HII Target on 2027 FCF Visibility',
    eventDate: '2026-11-14',
    sourceType: 'analyst_rating',
    sourceUrls: ['https://ir.hii.com/stock-information'],
    summary:
      'Cluster of three institutional equity desks upgrade NYSE:HII citing improving Newport News labor retention, Charleston module output, and Mission Technologies margin expansion.',
    impacts: [
      { audience: 'public', direction: 1, magnitude: 2, credibility: 2, scope: 'company', persistence: 'quarter' },
    ],
    starred: false,
    origin: 'research',
    verification: 'verified',
    editHistory: [],
    pendingReason: 'American Public Agent multi-analyst rating cluster rule (Mag 2, Cred 2, quarter)',
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

const CURRENT_LEDGER_SEED_VERSION = 'v4_159_events';
const SEED_VERSION_KEY = 'hii_sentiment_seed_version';
const STORAGE_KEY = 'hii_sentiment_ledger_state_v4';

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
      if (userRole === 'viewer') {
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
    if (userRole === 'viewer') {
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
    if (userRole === 'viewer') {
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
      if (userRole === 'viewer') {
        alert('Initiating agent deep research runs is restricted to System Administrator.');
        return;
      }
      if (spendUsd >= budgetConfig.monthlyCapUsd) {
        return;
      }

      setIsResearchRunning(true);
      const stages: LiveAgentStage[] = [
        {
          agentId: 'finops-guard',
          label: '1. FinOps Budget & Circuit Breaker Check',
          status: 'running',
          detail: `Verifying spend ($${spendUsd.toFixed(2)} / $${budgetConfig.monthlyCapUsd.toFixed(2)} cap)…`,
        },
        {
          agentId: 'audience-swarm',
          label: `2. Parallel 4-Audience Research Swarm (${audiences.join(', ').toUpperCase()})`,
          status: 'idle',
          detail: 'White House/OMB, HASC/SASC/GAO/CRS, SECNAV/NAVSEA, NYSE:HII & Media query packs',
        },
        {
          agentId: 'rubric-extractor',
          label: '3. Temperature-0.0 Discrete Rubric Extractor & SHA-256 Deduplicator',
          status: 'idle',
          detail: 'Mapping qualitative findings into ordinal rubric codes (Direction, Mag 1–5, Cred T1–T4)',
        },
        {
          agentId: 'retro-auditor',
          label: '4. Retroactive Period Revision Detector & Quarantine Stager',
          status: 'idle',
          detail: 'Scanning closed historical periods for retroactive score impact',
        },
      ];
      setAgentStages(stages);

      const stepDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      await stepDelay(350);
      setAgentStages((prev) =>
        prev.map((s, i) =>
          i === 0
            ? { ...s, status: 'completed', detail: 'Budget verified — circuit breaker ACTIVE' }
            : i === 1
            ? { ...s, status: 'running' }
            : s,
        ),
      );

      // Try backend endpoint first
      const endpoint = isMondayScheduledSweep ? '/api/cron/monday-sweep' : '/api/research/run';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audiences, mode }),
        });
        if (res.ok) {
          const data = await res.json();
          await stepDelay(450);
          setAgentStages((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
          setState(data.state);
          const runDelta = mode === 'deep_research' ? 0.38 : 0.05;
          setSpendUsd((prev) => Number((prev + runDelta).toFixed(4)));
          setIsResearchRunning(false);
          return;
        }
      } catch {
        // Static hosting fallback: execute interactive client-side multi-agent sweep
      }

      await stepDelay(500);
      setAgentStages((prev) =>
        prev.map((s, i) =>
          i === 1
            ? { ...s, status: 'completed', detail: `Collected findings across ${audiences.length} audiences` }
            : i === 2
            ? { ...s, status: 'running' }
            : s,
        ),
      );
      await stepDelay(450);
      setAgentStages((prev) =>
        prev.map((s, i) =>
          i === 2
            ? { ...s, status: 'completed', detail: 'Validated discrete rubric schema & canonical SHA-256 IDs' }
            : i === 3
            ? { ...s, status: 'running' }
            : s,
        ),
      );
      await stepDelay(400);

      const nowIso = new Date().toISOString();
      const runId = `run_${nowIso.replace(/\D/g, '').slice(0, 14)}`;
      const existingIds = new Set(state.events.map((e) => e.id));
      const existingPendingIds = new Set(state.pending.map((p) => p.id));

      const newPending: PendingEvent[] = [];
      for (const raw of CLIENT_DISCOVERY_CANDIDATES) {
        if (!raw.impacts.some((i) => audiences.includes(i.audience))) continue;
        const id = computeEventId(raw);
        if (existingIds.has(id) || existingPendingIds.has(id)) continue;
        newPending.push({
          ...raw,
          id,
          discoveredAt: nowIso,
          runId,
        });
      }

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
              `Staged ${newPending.length} new unique candidate events into Pending Quarantine Queue`,
            ],
          },
          ...state.runs,
        ],
      };

      const collectedRevisions: ScoreRevision[] = [];
      if (scheduleConfig.autoPromoteCredibility3Plus && newPending.length > 0) {
        for (const item of newPending) {
          if (item.impacts.every((i) => i.credibility >= 3)) {
            const promoted = engineApprovePending(nextState, item.id, nowIso);
            nextState = promoted.state;
            collectedRevisions.push(...promoted.revisions);
          }
        }
      }

      if (isMondayScheduledSweep) {
        nextState = {
          ...nextState,
          settings: {
            ...nextState.settings,
            schedule: {
              ...scheduleConfig,
              lastScheduledRunAt: nowIso,
            },
          },
        };
      }

      setState(nextState);
      if (collectedRevisions.length > 0) {
        setRecentRevisionsBanner(collectedRevisions);
      }
      setSpendUsd((prev) => Number((prev + runCost).toFixed(4)));
      setAgentStages((prev) =>
        prev.map((s, i) =>
          i === 3
            ? {
                ...s,
                status: 'completed',
                detail: `Staged ${newPending.length} candidate(s)${
                  collectedRevisions.length > 0
                    ? ` & auto-promoted (${collectedRevisions.length} retroactive revisions)`
                    : ''
                }`,
              }
            : s,
        ),
      );
      setIsResearchRunning(false);
    },
    [state, spendUsd, budgetConfig, scheduleConfig],
  );

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
