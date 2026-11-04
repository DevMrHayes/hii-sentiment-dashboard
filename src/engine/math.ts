/**
 * Exact integer arithmetic helpers. All divisions go through BigInt so results are bit-identical
 * across JS engines (no IEEE-754 rounding in the scoring path).
 */

/** Round-half-to-even integer division: div_rne(N, D), D > 0. */
export function divRne(n: number, d: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(d)) {
    throw new Error(`divRne requires integers (got ${n}/${d})`);
  }
  if (d <= 0) throw new Error('divRne divisor must be positive');
  return Number(divRneBig(BigInt(n), BigInt(d)));
}

export function divRneBig(n: bigint, d: bigint): bigint {
  const neg = n < 0n;
  const a = neg ? -n : n;
  const q = a / d;
  const r = a % d;
  let res = q;
  const twoR = 2n * r;
  if (twoR > d || (twoR === d && q % 2n === 1n)) res = q + 1n;
  return neg ? -res : res;
}

/** Floor integer square root for non-negative BigInt (Newton-Raphson). */
export function isqrtBig(n: bigint): bigint {
  if (n < 0n) throw new Error('isqrt of negative');
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

export function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Strict YYYY-MM-DD -> integer days since epoch (UTC). */
export function isoToEpochDays(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.floor(ms / 86_400_000);
}

export function epochDaysToIso(days: number): string {
  const d = new Date(days * 86_400_000);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function lastDayOfMonth(year: number, month1: number): string {
  const d = new Date(Date.UTC(year, month1, 0));
  return `${year}-${String(month1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** centi (0..10000) -> display number with 2 decimals. Edge-only helper. */
export function centiToDisplay(centi: number): string {
  const sign = centi < 0 ? '-' : '';
  const a = Math.abs(centi);
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

export function signedCenti(centi: number): string {
  if (centi === 0) return '±0.00';
  return (centi > 0 ? '+' : '') + centiToDisplay(centi);
}

/** bps (10,000 = 1.0 raw point) -> display string with 2 decimals. */
export function bpsToDisplay(bps: number): string {
  return signedCenti(divRne(bps, 100));
}
