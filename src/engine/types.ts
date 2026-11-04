/**
 * HII Sentiment Intelligence - Core Domain Types
 *
 * DETERMINISM CONTRACT: every numeric field suffixed `Bps` / `Centi` is an integer.
 *  - Raw points are expressed in basis points (10,000 bps = 1.0000 raw point).
 *  - Index scores are expressed in "centi" units: integer hundredths of an index point (0..10000 == 0.00..100.00).
 * No floating-point values are used in scoring; display helpers convert centi -> number at the edge.
 */

export const SCORING_ENGINE_VERSION = 'engine-v1.0.0';
export const RUBRIC_VERSION = 'rubric-v1.0.0';

export type AudienceId = 'executive' | 'congress' | 'navy' | 'public';
export const ALL_AUDIENCES: readonly AudienceId[] = ['executive', 'congress', 'navy', 'public'] as const;

export const AUDIENCE_LABELS: Record<AudienceId, string> = {
  executive: 'Executive Branch',
  congress: 'Congress',
  navy: 'Department of the Navy',
  public: 'American Public',
};

export type SourceType =
  | 'hearing'
  | 'gao_report'
  | 'crs_report'
  | 'exec_order'
  | 'budget_request'
  | 'navy_statement'
  | 'contract_award'
  | 'earnings'
  | 'stock_move'
  | 'analyst_rating'
  | 'news_media'
  | 'legislation'
  | 'corporate_action';

export const ALL_SOURCE_TYPES: readonly SourceType[] = [
  'hearing', 'gao_report', 'crs_report', 'exec_order', 'budget_request', 'navy_statement',
  'contract_award', 'earnings', 'stock_move', 'analyst_rating', 'news_media', 'legislation', 'corporate_action',
] as const;

export type DirectionCode = -1 | 0 | 1;
export type MagnitudeLevel = 1 | 2 | 3 | 4 | 5;
export type CredibilityTier = 1 | 2 | 3 | 4;
export type ScopeClass = 'program' | 'company' | 'industry' | 'macro';
export type PersistenceClass = 'transient' | 'quarter' | 'year' | 'structural';

/** Closed probability enumeration for forecast catalysts (percent). */
export type ProbabilityStep = 5 | 10 | 25 | 50 | 75 | 90 | 95;
export const PROBABILITY_STEPS: readonly ProbabilityStep[] = [5, 10, 25, 50, 75, 90, 95] as const;

/** One audience's discrete rubric classification of an event. At most one per audience per event. */
export interface AudienceImpact {
  audience: AudienceId;
  direction: DirectionCode;
  magnitude: MagnitudeLevel;
  credibility: CredibilityTier;
  scope: ScopeClass;
  persistence: PersistenceClass;
  rationale?: string;
}

export type VerificationStatus =
  | 'verified'          // corroborated against a primary source URL
  | 'unverified_seed'   // seeded from model recall; awaiting research corroboration
  | 'needs_research'    // approximate / speculative; must be confirmed
  | 'manual';           // analyst-entered

export type EventOrigin = 'seed' | 'research' | 'manual';

export interface EditAuditEntry {
  editedAt: string;   // ISO timestamp
  author: string;
  reason: string;
  revisionReason: RevisionReason;
  previous: Pick<ImpactEvent, 'title' | 'eventDate' | 'impacts' | 'sourceType'>;
}

export interface ImpactEvent {
  /** `evt_<16 hex>` = sha256(canonical{title,eventDate,sourceType}) prefix. Immutable after creation. */
  id: string;
  title: string;
  eventDate: string;      // YYYY-MM-DD (UTC)
  discoveredAt: string;   // ISO timestamp when it entered the ledger
  sourceType: SourceType;
  sourceUrls: string[];
  summary: string;
  impacts: AudienceImpact[];
  /** Key event flag. NEVER affects scoring. */
  starred: boolean;
  origin: EventOrigin;
  verification: VerificationStatus;
  runId?: string;
  editHistory: EditAuditEntry[];
}

export type PeriodGranularity = 'annual' | 'quarterly' | 'monthly';

export interface TimePeriod {
  id: string;          // '2019' | '2026-Q2' | '2026-11'
  label: string;       // '2019' | 'Q2 2026' | 'Nov 2026'
  granularity: PeriodGranularity | 'forecast';
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD (inclusive, capped at asOfDate for the open period)
  /** Month-end sample dates used to average the period state (deterministic). */
  sampleDates: string[];
}

export interface EventContribution {
  eventId: string;
  title: string;
  eventDate: string;
  starred: boolean;
  baseBps: number;           // undecayed base points
  /** Average decayed contribution across the period's sample dates (bps). */
  effectiveBps: number;
  /** True if the event's date falls inside this period. */
  inPeriod: boolean;
}

export interface AudiencePeriodScore {
  periodId: string;
  audience: AudienceId;
  rawBps: number;        // average raw points across samples
  scoreCenti: number;    // 0..10000
  deltaCenti: number;    // vs previous period (0 for first)
  contributions: EventContribution[]; // sorted by |effectiveBps| desc, then eventId
}

export interface PeriodRecord {
  period: TimePeriod;
  audiences: Record<AudienceId, AudiencePeriodScore>;
  compositeCenti: number;
  compositeDeltaCenti: number;
  /** Starred events whose eventDate falls inside the period. */
  keyEventIds: string[];
  /** Events whose eventDate falls inside the period (any star state). */
  inPeriodEventIds: string[];
}

export type AudienceWeights = Record<AudienceId, number>; // integers summing to 100

export interface WeightProfileVersion {
  id: string;
  weights: AudienceWeights;
  createdAt: string;
  author: string;
  reason: string;
}

export interface DashboardSettings {
  weights: AudienceWeights;
  weightHistory: WeightProfileVersion[];
  /** The as-of date for scoring. Part of the determinism input. */
  asOfDate: string;
  firstPeriodStart: string; // '2011-03-31' (HII spin-off)
}

export type RevisionReason =
  | 'NEW_RETROACTIVE_EVIDENCE'
  | 'RUBRIC_RECLASSIFICATION'
  | 'SOURCE_CORROBORATION_UPGRADE'
  | 'EVENT_DATE_CORRECTION'
  | 'EVENT_REMOVED'
  | 'WEIGHT_PROFILE_CHANGE';

export interface ScoreRevision {
  id: string;              // rev_<16hex> deterministic
  timestamp: string;
  runId: string;           // research run id or 'manual-<ts>'
  periodId: string;
  periodLabel: string;
  audience: AudienceId | 'composite';
  oldScoreCenti: number;
  newScoreCenti: number;
  deltaCenti: number;
  triggeringEventIds: string[];
  revisionReason: RevisionReason;
  explanation: string;
}

export type CatalystCategory =
  | 'legislation' | 'appropriations' | 'cr_shutdown' | 'contract_award' | 'budget_request' | 'milestone' | 'earnings' | 'oversight';

export interface ForecastCatalyst {
  id: string;
  title: string;
  category: CatalystCategory;
  sourceType: SourceType;
  expectedMonth: string;         // YYYY-MM (treated as occurring on the 15th)
  probability: ProbabilityStep;  // percent
  summary: string;
  impacts: AudienceImpact[];
  enabled: boolean;
}

export interface BandCenti {
  evCenti: number;
  p10Centi: number;
  p90Centi: number;
}

export interface ForecastPoint {
  period: TimePeriod;
  audiences: Record<AudienceId, BandCenti>;
  composite: BandCenti;
  activeCatalystIds: string[];
}

export interface ScoreSnapshot {
  id: string;
  takenAt: string;
  asOfDate: string;
  label: string;
  ledgerHash: string;
  outputHash: string;
  engineVersion: string;
  rubricVersion: string;
  weights: AudienceWeights;
  latest: Record<AudienceId | 'composite', number>; // centi
}

export type ResearchMode = 'deep_research' | 'grounded_search' | 'offline_simulation';

export interface ResearchRunRecord {
  runId: string;
  startedAt: string;
  completedAt?: string;
  audiences: AudienceId[];
  status: 'running' | 'completed' | 'failed' | 'budget_blocked';
  mode: ResearchMode;
  discoveredCount: number;
  pendingFile?: string;
  costUsd: number;
  log: string[];
}

/** A pending candidate awaiting analyst approval. Same shape as ImpactEvent + provenance. */
export interface PendingEvent extends ImpactEvent {
  pendingReason?: string;
  duplicateOf?: string;
}

export type LatestScores = Record<AudienceId | 'composite', { scoreCenti: number; deltaCenti: number }>;

export interface LedgerComputationResult {
  engineVersion: string;
  rubricVersion: string;
  asOfDate: string;
  ledgerHash: string;
  outputHash: string;
  weights: AudienceWeights;
  timeline: PeriodRecord[];
  forecast: ForecastPoint[];
  latest: LatestScores;
}

export interface LedgerState {
  settings: DashboardSettings;
  events: ImpactEvent[];
  catalysts: ForecastCatalyst[];
  revisions: ScoreRevision[];
  runs: ResearchRunRecord[];
  pending: PendingEvent[];
  snapshots: ScoreSnapshot[];
}
