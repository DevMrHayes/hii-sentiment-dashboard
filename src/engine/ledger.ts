/**
 * Pure ledger mutation functions. Every mutation that can change scores recomputes before/after
 * and appends ScoreRevision records explaining the change. Used by the API server, the CLI and tests.
 * `now` is always injected (never read from the clock here) to keep the functions pure.
 */
import type {
  AudienceImpact, AudienceWeights, ImpactEvent, LedgerState, PendingEvent, RevisionReason, ScoreRevision, ScoreSnapshot,
} from './types';
import { ALL_AUDIENCES, RUBRIC_VERSION, SCORING_ENGINE_VERSION } from './types';
import { computeEventId, canonicalJson, sha256Hex } from './hash';
import { computeLedgerScores, validateWeights } from './scorer';
import { detectRevisions } from './revisions';

export interface MutationResult {
  state: LedgerState;
  revisions: ScoreRevision[];
}

const AUD_SET = new Set(ALL_AUDIENCES);

export function validateImpacts(impacts: AudienceImpact[]): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const i of impacts) {
    if (!AUD_SET.has(i.audience)) errs.push(`bad audience ${i.audience}`);
    if (seen.has(i.audience)) errs.push(`duplicate audience ${i.audience}`);
    seen.add(i.audience);
    if (![-1, 0, 1].includes(i.direction)) errs.push(`bad direction ${i.direction}`);
    if (![1, 2, 3, 4, 5].includes(i.magnitude)) errs.push(`bad magnitude ${i.magnitude}`);
    if (![1, 2, 3, 4].includes(i.credibility)) errs.push(`bad credibility ${i.credibility}`);
    if (!['program', 'company', 'industry', 'macro'].includes(i.scope)) errs.push(`bad scope ${i.scope}`);
    if (!['transient', 'quarter', 'year', 'structural'].includes(i.persistence)) errs.push(`bad persistence ${i.persistence}`);
  }
  return errs;
}

function recompute(state: LedgerState) {
  return computeLedgerScores(state.events, state.catalysts, state.settings);
}

function withRevisions(before: LedgerState, after: LedgerState, runId: string, now: string, reason: RevisionReason, changed: ImpactEvent[]): MutationResult {
  const prev = recompute(before);
  const next = recompute(after);
  const revisions = detectRevisions(prev, next, { runId, timestamp: now, reason, changedEvents: changed });
  return { state: { ...after, revisions: [...after.revisions, ...revisions] }, revisions };
}

function classifyEdit(prev: ImpactEvent, next: ImpactEvent): RevisionReason {
  if (prev.eventDate !== next.eventDate) return 'EVENT_DATE_CORRECTION';
  const byAud = new Map(prev.impacts.map((i) => [i.audience, i]));
  let onlyCredUp = next.impacts.length === prev.impacts.length;
  for (const n of next.impacts) {
    const p = byAud.get(n.audience);
    if (!p || p.direction !== n.direction || p.magnitude !== n.magnitude || p.scope !== n.scope || p.persistence !== n.persistence || n.credibility < p.credibility) {
      onlyCredUp = false;
    }
  }
  return onlyCredUp ? 'SOURCE_CORROBORATION_UPGRADE' : 'RUBRIC_RECLASSIFICATION';
}

export interface EventInput {
  id?: string;
  title: string;
  eventDate: string;
  sourceType: ImpactEvent['sourceType'];
  sourceUrls?: string[];
  summary?: string;
  impacts: AudienceImpact[];
  starred?: boolean;
  verification?: ImpactEvent['verification'];
}

/** Add a manual event, or edit an existing one (versioned with author + reason). */
export function upsertEvent(state: LedgerState, input: EventInput, author: string, reason: string, now: string): MutationResult {
  const errs = validateImpacts(input.impacts);
  if (errs.length) throw new Error(`Invalid impacts: ${errs.join(', ')}`);
  if (!author.trim() || !reason.trim()) throw new Error('author and reason are required for ledger edits');
  const runId = `manual-${now}`;
  const existing = input.id ? state.events.find((e) => e.id === input.id) : undefined;
  if (existing) {
    const updated: ImpactEvent = {
      ...existing,
      title: input.title,
      eventDate: input.eventDate,
      sourceType: input.sourceType,
      sourceUrls: input.sourceUrls ?? existing.sourceUrls,
      summary: input.summary ?? existing.summary,
      impacts: input.impacts,
      starred: input.starred ?? existing.starred,
      verification: input.verification ?? existing.verification,
      editHistory: [
        ...existing.editHistory,
        {
          editedAt: now,
          author,
          reason,
          revisionReason: classifyEdit(existing, { ...existing, eventDate: input.eventDate, impacts: input.impacts }),
          previous: { title: existing.title, eventDate: existing.eventDate, impacts: existing.impacts, sourceType: existing.sourceType },
        },
      ],
    };
    const after = { ...state, events: state.events.map((e) => (e.id === existing.id ? updated : e)) };
    const rr = updated.editHistory[updated.editHistory.length - 1]!.revisionReason;
    return withRevisions(state, after, runId, now, rr, [existing, updated]);
  }
  const id = computeEventId(input);
  if (state.events.some((e) => e.id === id)) throw new Error(`Duplicate event ${id}`);
  const ev: ImpactEvent = {
    id,
    title: input.title,
    eventDate: input.eventDate,
    discoveredAt: now,
    sourceType: input.sourceType,
    sourceUrls: input.sourceUrls ?? [],
    summary: input.summary ?? '',
    impacts: input.impacts,
    starred: input.starred ?? false,
    origin: 'manual',
    verification: input.verification ?? 'manual',
    editHistory: [],
  };
  const after = { ...state, events: [...state.events, ev] };
  return withRevisions(state, after, runId, now, 'NEW_RETROACTIVE_EVIDENCE', [ev]);
}

export function removeEvent(state: LedgerState, id: string, author: string, reason: string, now: string): MutationResult {
  const ev = state.events.find((e) => e.id === id);
  if (!ev) throw new Error(`Unknown event ${id}`);
  if (!author.trim() || !reason.trim()) throw new Error('author and reason are required');
  const after = { ...state, events: state.events.filter((e) => e.id !== id) };
  return withRevisions(state, after, `manual-${now}`, now, 'EVENT_REMOVED', [ev]);
}

/** Starring never changes scores, so no revisions. */
export function setStar(state: LedgerState, id: string, starred: boolean): LedgerState {
  return { ...state, events: state.events.map((e) => (e.id === id ? { ...e, starred } : e)) };
}

export function approvePending(state: LedgerState, pendingId: string, now: string, overrides?: Partial<EventInput>): MutationResult {
  const p = state.pending.find((x) => x.id === pendingId);
  if (!p) throw new Error(`Unknown pending event ${pendingId}`);
  const merged: PendingEvent = { ...p, ...(overrides ?? {}), impacts: overrides?.impacts ?? p.impacts } as PendingEvent;
  const errs = validateImpacts(merged.impacts);
  if (errs.length) throw new Error(`Invalid impacts: ${errs.join(', ')}`);
  const id = computeEventId(merged);
  if (state.events.some((e) => e.id === id)) {
    return { state: { ...state, pending: state.pending.filter((x) => x.id !== pendingId) }, revisions: [] };
  }
  const { pendingReason: _pr, duplicateOf: _d, ...rest } = merged;
  const ev: ImpactEvent = { ...rest, id, discoveredAt: now, origin: 'research', editHistory: [] };
  const after = { ...state, events: [...state.events, ev], pending: state.pending.filter((x) => x.id !== pendingId) };
  return withRevisions(state, after, p.runId ?? `manual-${now}`, now, 'NEW_RETROACTIVE_EVIDENCE', [ev]);
}

export function rejectPending(state: LedgerState, pendingId: string): LedgerState {
  return { ...state, pending: state.pending.filter((x) => x.id !== pendingId) };
}

export function updateWeights(state: LedgerState, weights: AudienceWeights, author: string, reason: string, now: string): MutationResult {
  if (!validateWeights(weights)) throw new Error('Weights must be non-negative integers summing to 100');
  const version = {
    id: 'wp_' + sha256Hex(canonicalJson({ now, weights })).slice(0, 12),
    weights: { ...weights },
    createdAt: now,
    author,
    reason,
  };
  const after: LedgerState = {
    ...state,
    settings: { ...state.settings, weights: { ...weights }, weightHistory: [...state.settings.weightHistory, version] },
  };
  const prev = recompute(state);
  const next = recompute(after);
  const revisions = detectRevisions(prev, next, { runId: version.id, timestamp: now, reason: 'WEIGHT_PROFILE_CHANGE', changedEvents: [] })
    .filter((r) => r.audience === 'composite');
  // Weight changes affect every period's composite; record only the latest period to avoid log spam,
  // the full history is reproducible from weightHistory.
  const latestOnly = revisions.slice(-1);
  return { state: { ...after, revisions: [...after.revisions, ...latestOnly] }, revisions: latestOnly };
}

export function takeSnapshot(state: LedgerState, label: string, now: string): { state: LedgerState; snapshot: ScoreSnapshot } {
  const r = recompute(state);
  const snapshot: ScoreSnapshot = {
    id: 'snap_' + sha256Hex(canonicalJson({ now, outputHash: r.outputHash })).slice(0, 12),
    takenAt: now,
    asOfDate: r.asOfDate,
    label,
    ledgerHash: r.ledgerHash,
    outputHash: r.outputHash,
    engineVersion: SCORING_ENGINE_VERSION,
    rubricVersion: RUBRIC_VERSION,
    weights: { ...r.weights },
    latest: {
      executive: r.latest.executive.scoreCenti,
      congress: r.latest.congress.scoreCenti,
      navy: r.latest.navy.scoreCenti,
      public: r.latest.public.scoreCenti,
      composite: r.latest.composite.scoreCenti,
    },
  };
  return { state: { ...state, snapshots: [...state.snapshots, snapshot] }, snapshot };
}
