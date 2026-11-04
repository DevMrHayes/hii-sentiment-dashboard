import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  approvePending as engineApprovePending,
  computeLedgerScores,
  rejectPending as engineRejectPending,
  removeEvent as engineRemoveEvent,
  setStar as engineSetStar,
  takeSnapshot as engineTakeSnapshot,
  updateWeights as engineUpdateWeights,
  upsertEvent as engineUpsertEvent,
  type AudienceId,
  type AudienceWeights,
  type EventInput,
  type ForecastCatalyst,
  type LedgerComputationResult,
  type LedgerState,
  type ScoreRevision,
} from '../engine';
import { SEED_LEDGER_STATE } from '../data/seedBundle';

export type ActiveTab = 'dashboard' | 'ledger' | 'control' | 'forecast' | 'research' | 'revisions' | 'export';

export interface BudgetStatus {
  monthlyCapUsd: number;
  totalSpendUsd: number;
  remainingUsd: number;
  circuitBreaker: string;
}

interface DashboardContextValue {
  state: LedgerState;
  result: LedgerComputationResult;
  budget: BudgetStatus;
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
  // Actions
  updateWeights: (weights: AudienceWeights, author: string, reason: string) => Promise<void>;
  toggleStar: (eventId: string, starred: boolean) => Promise<void>;
  upsertEvent: (event: EventInput, author: string, reason: string) => Promise<ScoreRevision[]>;
  deleteEvent: (eventId: string, author: string, reason: string) => Promise<ScoreRevision[]>;
  saveCatalysts: (catalysts: ForecastCatalyst[]) => Promise<void>;
  approvePending: (pendingId: string, overrides?: Partial<EventInput>) => Promise<ScoreRevision[]>;
  rejectPending: (pendingId: string) => Promise<void>;
  triggerResearchRun: (audiences: AudienceId[], mode?: string) => Promise<void>;
  takeSnapshot: (label: string) => Promise<void>;
}

const STORAGE_KEY = 'hii_sentiment_ledger_state_v1';

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LedgerState>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as LedgerState;
        if (parsed?.events?.length && parsed?.settings?.weights) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return SEED_LEDGER_STATE;
  });

  const [budget, setBudget] = useState<BudgetStatus>({
    monthlyCapUsd: 15.0,
    totalSpendUsd: 0.6123,
    remainingUsd: 14.3877,
    circuitBreaker: 'ACTIVE',
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [audienceFilter, setAudienceFilter] = useState<AudienceId | 'all'>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [recentRevisionsBanner, setRecentRevisionsBanner] = useState<ScoreRevision[]>([]);
  const [isResearchRunning, setIsResearchRunning] = useState(false);

  // Hydrate from local Vite API middleware if available
  useEffect(() => {
    let cancelled = false;
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.state?.events) {
          setState(data.state);
          if (data.budget) setBudget(data.budget);
        }
      })
      .catch(() => {
        // Static build fallback uses SEED_LEDGER_STATE + localStorage
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist to localStorage for static offline continuity
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
        // Fallback to in-browser engine
      }
      const { state: next, revisions } = engineUpdateWeights(state, weights, author, reason, new Date().toISOString());
      setState(next);
      if (revisions.length) setRecentRevisionsBanner(revisions);
    },
    [state],
  );

  const toggleStar = useCallback(
    async (eventId: string, starred: boolean) => {
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
    },
    [],
  );

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

  const saveCatalysts = useCallback(
    async (catalysts: ForecastCatalyst[]) => {
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
    },
    [],
  );

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

  const rejectPending = useCallback(
    async (pendingId: string) => {
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
    },
    [],
  );

  const triggerResearchRun = useCallback(
    async (audiences: AudienceId[], mode = 'auto') => {
      setIsResearchRunning(true);
      try {
        const res = await fetch('/api/research/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audiences, mode }),
        });
        if (res.ok) {
          const data = await res.json();
          setState(data.state);
          if (data.budget) setBudget(data.budget);
          setIsResearchRunning(false);
          return;
        }
      } catch {
        // Offline static fallback: synthesize a run record
      }
      setIsResearchRunning(false);
    },
    [],
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

  return (
    <DashboardContext.Provider
      value={{
        state,
        result,
        budget,
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
        updateWeights,
        toggleStar,
        upsertEvent,
        deleteEvent,
        saveCatalysts,
        approvePending,
        rejectPending,
        triggerResearchRun,
        takeSnapshot,
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
