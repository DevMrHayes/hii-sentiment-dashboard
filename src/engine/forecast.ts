/**
 * Deterministic 6-month forecast (scenario expected value + analytic P10/P90 band).
 *
 * For forecast month M with sample date s (month end):
 *   hist_a(s)  = sum of committed ledger contributions decayed to s
 *   c_{k,a}(s) = decayed contribution of catalyst k (occurring YYYY-MM-15) if expectedMonth <= M
 *   mu_a       = hist_a + sum_k rne(pBps_k * c_{k,a} / 10000)
 *   var_a      = rne( sum_k pBps_k (10000 - pBps_k) c_{k,a}^2 , 1e8 )      (independent Bernoulli)
 *   band_a     = rne(12816 * isqrt(var_a), 10000)                            (z_0.90 = 1.2816)
 *   EV/P10/P90 = rawToCenti(mu), rawToCenti(mu - band), rawToCenti(mu + band)
 * Composite band: integer weighted mean of audience EV / P10 / P90 (comonotonic assumption,
 * since the same catalysts drive every audience).
 */
import type { AudienceId, BandCenti, DashboardSettings, ForecastCatalyst, ForecastPoint, ImpactEvent } from './types';
import { ALL_AUDIENCES } from './types';
import { baseBps, contributionBps, rawToCenti } from './rubric';
import { divRne, divRneBig, isoToEpochDays, isqrtBig } from './math';
import { buildForecastPeriods } from './periods';
import { prepareImpacts, stateAt, compositeCenti } from './state';

export const Z90_BPS = 12_816;

export function catalystDate(c: ForecastCatalyst): string {
  return `${c.expectedMonth}-15`;
}

export function computeForecast(events: ImpactEvent[], catalysts: ForecastCatalyst[], settings: DashboardSettings, months = 6): ForecastPoint[] {
  const periods = buildForecastPeriods(settings.asOfDate, months);
  const prepared = prepareImpacts(events, settings.asOfDate);
  const active = catalysts
    .filter((c) => c.enabled)
    .sort((a, b) => (a.expectedMonth < b.expectedMonth ? -1 : a.expectedMonth > b.expectedMonth ? 1 : a.id < b.id ? -1 : 1));

  return periods.map((period) => {
    const s = period.sampleDates[0]!;
    const sDay = isoToEpochDays(s);
    const live = active.filter((c) => c.expectedMonth <= period.id && catalystDate(c) > settings.asOfDate);
    const audiences = {} as Record<AudienceId, BandCenti>;
    for (const a of ALL_AUDIENCES) {
      const hist = stateAt(prepared[a], s).raw;
      let mu = hist;
      let varNum = 0n;
      for (const c of live) {
        const imp = c.impacts.find((i) => i.audience === a);
        if (!imp) continue;
        const contrib = contributionBps(baseBps(imp), sDay - isoToEpochDays(catalystDate(c)), imp.persistence);
        if (contrib === 0) continue;
        const pBps = c.probability * 100;
        mu += divRne(pBps * contrib, 10_000);
        const cb = BigInt(contrib);
        varNum += BigInt(pBps) * BigInt(10_000 - pBps) * cb * cb;
      }
      const variance = divRneBig(varNum, 100_000_000n);
      const sigma = Number(isqrtBig(variance));
      const band = divRne(Z90_BPS * sigma, 10_000);
      audiences[a] = { evCenti: rawToCenti(mu), p10Centi: rawToCenti(mu - band), p90Centi: rawToCenti(mu + band) };
    }
    const pick = (k: keyof BandCenti) =>
      compositeCenti({ executive: audiences.executive[k], congress: audiences.congress[k], navy: audiences.navy[k], public: audiences.public[k] }, settings.weights);
    return {
      period,
      audiences,
      composite: { evCenti: pick('evCenti'), p10Centi: pick('p10Centi'), p90Centi: pick('p90Centi') },
      activeCatalystIds: live.map((c) => c.id),
    };
  });
}

/**
 * Sensitivity of the final-month composite EV to each catalyst (EV with catalyst minus EV without).
 * Deterministic; used by the Catalyst Studio.
 */
export function catalystSensitivity(events: ImpactEvent[], catalysts: ForecastCatalyst[], settings: DashboardSettings): Record<string, number> {
  const base = computeForecast(events, catalysts, settings);
  const baseEv = base[base.length - 1]?.composite.evCenti ?? 0;
  const out: Record<string, number> = {};
  for (const c of catalysts) {
    if (!c.enabled) { out[c.id] = 0; continue; }
    const without = computeForecast(events, catalysts.filter((x) => x.id !== c.id), settings);
    out[c.id] = baseEv - (without[without.length - 1]?.composite.evCenti ?? 0);
  }
  return out;
}
