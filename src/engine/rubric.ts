/**
 * Rubric v1.0.0 - immutable lookup tables (see docs/METHODOLOGY.md).
 * Changing ANY constant here requires bumping RUBRIC_VERSION / SCORING_ENGINE_VERSION.
 */
import type {
  AudienceImpact, CredibilityTier, MagnitudeLevel, PersistenceClass, ScopeClass, SourceType, AudienceId,
} from './types';
import { divRne, divRneBig } from './math';

export const BASELINE_CENTI = 5000;            // 50.00 neutral
export const HALF_SATURATION_BPS = 250_000;    // K: raw points at which index reaches 75.00
export const DECAY_CUTOFF_DAYS = 1825;         // 5-year sentiment memory horizon

export const MAGNITUDE_BPS: Record<MagnitudeLevel, number> = {
  1: 20_000, 2: 45_000, 3: 80_000, 4: 130_000, 5: 200_000,
};
export const MAGNITUDE_LABELS: Record<MagnitudeLevel, string> = {
  1: 'Minor / Routine', 2: 'Moderate / Notable', 3: 'Significant / Material', 4: 'Major / High-Impact', 5: 'Watershed / Structural',
};

export const CREDIBILITY_BPS: Record<CredibilityTier, number> = {
  1: 4_000, 2: 6_500, 3: 8_500, 4: 10_000,
};
export const CREDIBILITY_LABELS: Record<CredibilityTier, string> = {
  1: 'Commentary / Secondary', 2: 'Watchdog / Market Signal', 3: 'Primary Institutional / Audit', 4: 'Binding Sovereign / Statutory',
};

export const SCOPE_BPS: Record<ScopeClass, number> = {
  program: 7_500, company: 10_000, industry: 11_500, macro: 13_000,
};

export const PERSISTENCE_HALF_LIFE_DAYS: Record<PersistenceClass, number> = {
  transient: 35, quarter: 90, year: 180, structural: 420,
};

/** Default credibility tier by source type (used to pre-fill extraction & manual forms). */
export const DEFAULT_CREDIBILITY: Record<SourceType, CredibilityTier> = {
  exec_order: 4, budget_request: 4, legislation: 4, contract_award: 4,
  hearing: 3, gao_report: 3, navy_statement: 3, earnings: 3, corporate_action: 3,
  crs_report: 2, stock_move: 2, analyst_rating: 1, news_media: 1,
};

/** Primary audiences per source type (guidance for research query packs & extraction). */
export const PRIMARY_AUDIENCES: Record<SourceType, AudienceId[]> = {
  exec_order: ['executive'], budget_request: ['executive', 'navy'], legislation: ['congress'],
  contract_award: ['navy', 'public'], hearing: ['congress', 'navy'], gao_report: ['congress', 'navy'],
  crs_report: ['congress'], navy_statement: ['navy'], earnings: ['public'], stock_move: ['public'],
  analyst_rating: ['public'], news_media: ['public', 'executive'], corporate_action: ['public'],
};

/**
 * 2^(-k/64) * 1e8, k = 0..64, rounded half-even (precomputed with 50-digit Decimal).
 * Hard-coded so no libm / Math.pow is ever used in the scoring path.
 */
export const TWO_NEG_FRAC_1E8: readonly number[] = [
  100000000, 98922801, 97857206, 96803090, 95760328, 94728799, 93708382, 92698956, 91700404, 90712609,
  89735454, 88768825, 87812608, 86866692, 85930965, 85005318, 84089642, 83183829, 82287774, 81401371,
  80524517, 79657108, 78799042, 77950220, 77110541, 76279908, 75458221, 74645386, 73841307, 73045890,
  72259040, 71480667, 70710678, 69948984, 69195494, 68450121, 67712777, 66983376, 66261832, 65548061,
  64841978, 64143501, 63452548, 62769038, 62092891, 61424027, 60762368, 60107837, 59460356, 58819850,
  58186243, 57559461, 56939432, 56326081, 55719337, 55119129, 54525387, 53938040, 53357020, 52782259,
  52213689, 51651244, 51094857, 50544464, 50000000,
];

/** Base points for one audience impact: d * rne(M*C*S / 1e8). */
export function baseBps(impact: AudienceImpact): number {
  if (impact.direction === 0) return 0;
  const prod = BigInt(MAGNITUDE_BPS[impact.magnitude]) * BigInt(CREDIBILITY_BPS[impact.credibility]) * BigInt(SCOPE_BPS[impact.scope]);
  const mag = Number(divRneBig(prod, 100_000_000n));
  return impact.direction * mag;
}

/**
 * Decay multiplier in bps (0..10000) for elapsed integer days under a persistence class.
 * delta = q*H + r ; frac grid position = r*64/H (integer + remainder) ; linear interpolation
 * between table entries at 1e8 scale ; right-shift by q octaves ; rne to bps.
 */
export function decayBps(elapsedDays: number, persistence: PersistenceClass): number {
  if (elapsedDays < 0 || elapsedDays > DECAY_CUTOFF_DAYS) return 0;
  const h = PERSISTENCE_HALF_LIFE_DAYS[persistence];
  const q = Math.floor(elapsedDays / h);
  const r = elapsedDays - q * h;
  const scaled = r * 64;                // position on 64-step grid * h
  const k = Math.floor(scaled / h);     // 0..63
  const rem = scaled - k * h;           // 0..h-1
  const a = TWO_NEG_FRAC_1E8[k]!;
  const b = TWO_NEG_FRAC_1E8[k + 1]!;
  // a - (a-b)*rem/h, rne
  const interp = a - divRne((a - b) * rem, h);
  if (q >= 40) return 0;
  const shifted = divRneBig(BigInt(interp), 1n << BigInt(q));
  return Number(divRneBig(shifted, 10_000n)); // 1e8 -> 1e4
}

/** Decayed contribution in bps. */
export function contributionBps(base: number, elapsedDays: number, persistence: PersistenceClass): number {
  if (base === 0) return 0;
  const d = decayBps(elapsedDays, persistence);
  if (d === 0) return 0;
  return divRne(base * d, 10_000);
}

/**
 * Rational saturating map: raw bps -> index centi (0..10000), 50.00 = neutral.
 * S = 500000 + rne(500000*R / (|R| + K)) in 1e4-scaled index; centi = rne(S/100).
 */
export function rawToCenti(rawBps: number): number {
  const R = BigInt(rawBps);
  const absR = R < 0n ? -R : R;
  const s = 500_000n + divRneBig(500_000n * R, absR + BigInt(HALF_SATURATION_BPS));
  return Number(divRneBig(s, 100n));
}
