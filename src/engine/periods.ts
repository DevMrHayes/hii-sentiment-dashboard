/**
 * Deterministic variable-granularity calendar.
 *  - Annual periods: spin-off year .. (asOf year - 1)
 *  - Quarterly periods: completed quarters of the asOf year
 *  - Monthly periods: months of the current quarter up to the asOf month (open month capped at asOfDate)
 *  - Forecast periods: the 6 months following the asOf month
 * Each period carries month-end sample dates; period scores are the integer average of the states at those samples.
 */
import type { TimePeriod } from './types';
import { lastDayOfMonth } from './math';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

function monthStart(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

function monthEndsBetween(startIso: string, endIso: string): string[] {
  const s = parts(startIso);
  const e = parts(endIso);
  const out: string[] = [];
  let y = s.y, m = s.m;
  while (y < e.y || (y === e.y && m <= e.m)) {
    let me = lastDayOfMonth(y, m);
    if (me > endIso) me = endIso;       // open period: cap at asOf/end
    if (me >= startIso) out.push(me);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function buildHistoricalPeriods(asOfDate: string, firstPeriodStart = '2011-03-31'): TimePeriod[] {
  const asOf = parts(asOfDate);
  const first = parts(firstPeriodStart);
  const periods: TimePeriod[] = [];

  for (let y = first.y; y < asOf.y; y++) {
    const startDate = y === first.y ? firstPeriodStart : `${y}-01-01`;
    const endDate = `${y}-12-31`;
    periods.push({ id: String(y), label: String(y), granularity: 'annual', startDate, endDate, sampleDates: monthEndsBetween(startDate, endDate) });
  }

  const currentQ = Math.floor((asOf.m - 1) / 3) + 1;
  for (let q = 1; q < currentQ; q++) {
    const sm = (q - 1) * 3 + 1;
    let startDate = monthStart(asOf.y, sm);
    if (startDate < firstPeriodStart) startDate = firstPeriodStart;
    const endDate = lastDayOfMonth(asOf.y, sm + 2);
    if (endDate < firstPeriodStart) continue;
    periods.push({ id: `${asOf.y}-Q${q}`, label: `Q${q} ${asOf.y}`, granularity: 'quarterly', startDate, endDate, sampleDates: monthEndsBetween(startDate, endDate) });
  }

  const qStartMonth = (currentQ - 1) * 3 + 1;
  for (let m = qStartMonth; m <= asOf.m; m++) {
    const startDate = monthStart(asOf.y, m);
    let endDate = lastDayOfMonth(asOf.y, m);
    if (endDate > asOfDate) endDate = asOfDate;
    if (endDate < firstPeriodStart) continue;
    const id = `${asOf.y}-${String(m).padStart(2, '0')}`;
    periods.push({ id, label: `${MONTHS[m - 1]} ${asOf.y}`, granularity: 'monthly', startDate, endDate, sampleDates: [endDate] });
  }
  return periods;
}

export function buildForecastPeriods(asOfDate: string, months = 6): TimePeriod[] {
  const asOf = parts(asOfDate);
  const out: TimePeriod[] = [];
  let y = asOf.y, m = asOf.m;
  for (let i = 0; i < months; i++) {
    m++;
    if (m > 12) { m = 1; y++; }
    const endDate = lastDayOfMonth(y, m);
    out.push({
      id: `${y}-${String(m).padStart(2, '0')}`,
      label: `${MONTHS[m - 1]} ${y}`,
      granularity: 'forecast',
      startDate: monthStart(y, m),
      endDate,
      sampleDates: [endDate],
    });
  }
  return out;
}

/** Which period (if any) contains a given date. */
export function periodContaining(periods: TimePeriod[], iso: string): TimePeriod | undefined {
  return periods.find((p) => iso >= p.startDate && iso <= p.endDate);
}
