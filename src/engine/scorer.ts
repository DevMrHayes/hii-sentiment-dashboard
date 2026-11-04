/**
 * Core deterministic scoring engine (engine-v1.0.0).
 * Pure function of (events, catalysts, settings). No randomness, no Date.now(), no floats in the scoring path.
 */
import type {
  AudienceId, AudiencePeriodScore, AudienceWeights, DashboardSettings, EventContribution, ForecastCatalyst,
  ImpactEvent, LatestScores, LedgerComputationResult, PeriodRecord, TimePeriod,
} from './types';
import { ALL_AUDIENCES, RUBRIC_VERSION, SCORING_ENGINE_VERSION } from './types';
import { rawToCenti } from './rubric';
import { divRne } from './math';
import { compositeCenti, sortEvents, prepareImpacts, stateAt, type PreparedImpact } from './state';
import { buildHistoricalPeriods } from './periods';
import { canonicalJson, computeLedgerHash, sha256Hex } from './hash';
import { computeForecast } from './forecast';

export function validateWeights(w: AudienceWeights): boolean {
  let sum = 0;
  for (const a of ALL_AUDIENCES) {
    const v = w[a];
    if (!Number.isInteger(v) || v < 0 || v > 100) return false;
    sum += v;
  }
  return sum === 100;
}

/** Largest-remainder normalization of arbitrary non-negative numbers to integer percents summing to 100. */
export function normalizeWeights(raw: Record<AudienceId, number>): AudienceWeights {
  const vals = ALL_AUDIENCES.map((a) => Math.max(0, Number.isFinite(raw[a]) ? raw[a] : 0));
  const total = vals.reduce((s, v) => s + v, 0);
  if (total === 0) return { executive: 25, congress: 25, navy: 25, public: 25 };
  const exact = vals.map((v) => (v * 100) / total);
  const floors = exact.map(Math.floor);
  let rem = 100 - floors.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((x, y) => y.frac - x.frac || x.i - y.i);
  for (const o of order) {
    if (rem <= 0) break;
    floors[o.i]! += 1;
    rem--;
  }
  return { executive: floors[0]!, congress: floors[1]!, navy: floors[2]!, public: floors[3]! };
}

export { compositeCenti, sortEvents, prepareImpacts, stateAt };

function scorePeriodAudience(period: TimePeriod, audience: AudienceId, prepared: PreparedImpact[], prevCenti: number | null): AudiencePeriodScore {
  const n = period.sampleDates.length;
  let rawSum = 0;
  let centiSum = 0;
  const contribSum = new Map<string, number>();
  for (const s of period.sampleDates) {
    const st = stateAt(prepared, s);
    rawSum += st.raw;
    centiSum += rawToCenti(st.raw);
    for (const [id, c] of st.parts) contribSum.set(id, (contribSum.get(id) ?? 0) + c);
  }
  const byId = new Map(prepared.map((p) => [p.event.id, p]));
  const contributions: EventContribution[] = [];
  for (const [id, sum] of contribSum) {
    const p = byId.get(id)!;
    const eff = divRne(sum, n);
    if (eff === 0) continue;
    contributions.push({
      eventId: id,
      title: p.event.title,
      eventDate: p.event.eventDate,
      starred: p.event.starred,
      baseBps: p.base,
      effectiveBps: eff,
      inPeriod: p.event.eventDate >= period.startDate && p.event.eventDate <= period.endDate,
    });
  }
  contributions.sort((a, b) => Math.abs(b.effectiveBps) - Math.abs(a.effectiveBps) || (a.eventId < b.eventId ? -1 : 1));
  const scoreCenti = divRne(centiSum, n);
  return {
    periodId: period.id,
    audience,
    rawBps: divRne(rawSum, n),
    scoreCenti,
    deltaCenti: prevCenti === null ? 0 : scoreCenti - prevCenti,
    contributions,
  };
}

export function computeTimeline(events: ImpactEvent[], settings: DashboardSettings): PeriodRecord[] {
  const periods = buildHistoricalPeriods(settings.asOfDate, settings.firstPeriodStart);
  const prepared = prepareImpacts(events, settings.asOfDate);
  const records: PeriodRecord[] = [];
  let prev: PeriodRecord | null = null;
  for (const period of periods) {
    const audiences = {} as Record<AudienceId, AudiencePeriodScore>;
    for (const a of ALL_AUDIENCES) {
      audiences[a] = scorePeriodAudience(period, a, prepared[a], prev ? prev.audiences[a].scoreCenti : null);
    }
    const comp = compositeCenti(
      { executive: audiences.executive.scoreCenti, congress: audiences.congress.scoreCenti, navy: audiences.navy.scoreCenti, public: audiences.public.scoreCenti },
      settings.weights,
    );
    const inPeriod = sortEvents(events).filter((e) => e.eventDate >= period.startDate && e.eventDate <= period.endDate && e.eventDate <= settings.asOfDate);
    const rec: PeriodRecord = {
      period,
      audiences,
      compositeCenti: comp,
      compositeDeltaCenti: prev ? comp - prev.compositeCenti : 0,
      keyEventIds: inPeriod.filter((e) => e.starred).map((e) => e.id),
      inPeriodEventIds: inPeriod.map((e) => e.id),
    };
    records.push(rec);
    prev = rec;
  }
  return records;
}

/** Hash of the numeric output only (what must be bit-identical on regeneration). */
export function computeOutputHash(result: Omit<LedgerComputationResult, 'outputHash'>): string {
  const payload = {
    asOfDate: result.asOfDate,
    engineVersion: result.engineVersion,
    rubricVersion: result.rubricVersion,
    ledgerHash: result.ledgerHash,
    timeline: result.timeline.map((r) => ({
      id: r.period.id,
      c: r.compositeCenti,
      a: ALL_AUDIENCES.map((a) => [r.audiences[a].rawBps, r.audiences[a].scoreCenti]),
    })),
    forecast: result.forecast.map((f) => ({
      id: f.period.id,
      c: [f.composite.p10Centi, f.composite.evCenti, f.composite.p90Centi],
      a: ALL_AUDIENCES.map((a) => [f.audiences[a].p10Centi, f.audiences[a].evCenti, f.audiences[a].p90Centi]),
    })),
  };
  return sha256Hex(canonicalJson(payload));
}

export function computeLedgerScores(events: ImpactEvent[], catalysts: ForecastCatalyst[], settings: DashboardSettings): LedgerComputationResult {
  if (!validateWeights(settings.weights)) throw new Error('Invalid weights: must be non-negative integers summing to 100');
  const timeline = computeTimeline(events, settings);
  const forecast = computeForecast(events, catalysts, settings);
  const last = timeline[timeline.length - 1]!;
  const latest = {} as LatestScores;
  for (const a of ALL_AUDIENCES) latest[a] = { scoreCenti: last.audiences[a].scoreCenti, deltaCenti: last.audiences[a].deltaCenti };
  latest.composite = { scoreCenti: last.compositeCenti, deltaCenti: last.compositeDeltaCenti };
  const ledgerHash = computeLedgerHash(events, catalysts, settings.weights, settings.asOfDate, SCORING_ENGINE_VERSION, RUBRIC_VERSION);
  const partial = {
    engineVersion: SCORING_ENGINE_VERSION,
    rubricVersion: RUBRIC_VERSION,
    asOfDate: settings.asOfDate,
    ledgerHash,
    weights: { ...settings.weights },
    timeline,
    forecast,
    latest,
  };
  return { ...partial, outputHash: computeOutputHash(partial) };
}
