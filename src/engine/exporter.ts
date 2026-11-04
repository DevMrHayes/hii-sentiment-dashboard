/**
 * Deterministic Markdown Report Exporter.
 * Produces an audit-grade Markdown document covering scores, contributing events,
 * starred key events, 6-month forecast, and retroactive revisions.
 */
import type {
  ForecastCatalyst,
  ImpactEvent,
  LedgerComputationResult,
  ScoreRevision,
} from './types';
import { ALL_AUDIENCES, AUDIENCE_LABELS } from './types';
import { bpsToDisplay, centiToDisplay, signedCenti } from './math';
import { baseBps } from './rubric';
import { sortEvents } from './state';

export function generateMarkdownExport(
  result: LedgerComputationResult,
  events: ImpactEvent[],
  catalysts: ForecastCatalyst[],
  revisions: ScoreRevision[],
): string {
  const lines: string[] = [];

  lines.push('# HII Sentiment Intelligence — Deterministic Audit Report');
  lines.push('');
  lines.push(`- **Subject:** Huntington Ingalls Industries, Inc. (NYSE: HII)`);
  lines.push(`- **As-Of Date:** \`${result.asOfDate}\``);
  lines.push(`- **Scoring Engine Version:** \`${result.engineVersion}\``);
  lines.push(`- **Rubric Version:** \`${result.rubricVersion}\``);
  lines.push(`- **Ledger Content SHA-256:** \`${result.ledgerHash}\``);
  lines.push(`- **Deterministic Output SHA-256:** \`${result.outputHash}\``);
  lines.push(
    `- **Active Composite Weights:** Executive \`${result.weights.executive}%\` | Congress \`${result.weights.congress}%\` | Navy \`${result.weights.navy}%\` | Public \`${result.weights.public}%\``,
  );
  lines.push('');

  // Section 1: Latest Snapshot
  lines.push('## 1. Current Sentiment Snapshot (vs. Prior Period)');
  lines.push('');
  lines.push('| Audience / Index | Weight | Current Score (0–100) | Delta vs. Prior |');
  lines.push('| :--- | :---: | :---: | :---: |');
  lines.push(
    `| **Composite Index** | **100%** | **${centiToDisplay(result.latest.composite.scoreCenti)}** | **${signedCenti(result.latest.composite.deltaCenti)}** |`,
  );
  for (const a of ALL_AUDIENCES) {
    const s = result.latest[a];
    lines.push(
      `| ${AUDIENCE_LABELS[a]} | ${result.weights[a]}% | ${centiToDisplay(s.scoreCenti)} | ${signedCenti(s.deltaCenti)} |`,
    );
  }
  lines.push('');

  // Section 2: Historical Timeline
  lines.push('## 2. Historical Sentiment Timeline (2011–Present)');
  lines.push('');
  lines.push(
    '| Period | Granularity | Executive | Congress | Navy | Public | **Composite** | Delta | Key Events | Revisions |',
  );
  lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  const revCountByPeriod = new Map<string, number>();
  for (const r of revisions) {
    revCountByPeriod.set(r.periodId, (revCountByPeriod.get(r.periodId) ?? 0) + 1);
  }

  for (const rec of result.timeline) {
    const revCount = revCountByPeriod.get(rec.period.id) ?? 0;
    lines.push(
      `| \`${rec.period.id}\` (${rec.period.label}) | ${rec.period.granularity} | ${centiToDisplay(rec.audiences.executive.scoreCenti)} | ${centiToDisplay(rec.audiences.congress.scoreCenti)} | ${centiToDisplay(rec.audiences.navy.scoreCenti)} | ${centiToDisplay(rec.audiences.public.scoreCenti)} | **${centiToDisplay(rec.compositeCenti)}** | ${signedCenti(rec.compositeDeltaCenti)} | ${rec.keyEventIds.length > 0 ? `★ ${rec.keyEventIds.length}` : '—'} | ${revCount > 0 ? `↺ ${revCount}` : '—'} |`,
    );
  }
  lines.push('');

  // Section 3: 6-Month Deterministic Forecast
  lines.push('## 3. 6-Month Deterministic Scenario Forecast (Expected Value & P10–P90 Band)');
  lines.push('');
  lines.push(
    '| Forecast Month | Executive EV [P10–P90] | Congress EV [P10–P90] | Navy EV [P10–P90] | Public EV [P10–P90] | **Composite EV [P10–P90]** | Active Catalysts |',
  );
  lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');
  for (const fp of result.forecast) {
    const fmt = (b: { evCenti: number; p10Centi: number; p90Centi: number }) =>
      `${centiToDisplay(b.evCenti)} [${centiToDisplay(b.p10Centi)}–${centiToDisplay(b.p90Centi)}]`;
    lines.push(
      `| \`${fp.period.id}\` (${fp.period.label}) | ${fmt(fp.audiences.executive)} | ${fmt(fp.audiences.congress)} | ${fmt(fp.audiences.navy)} | ${fmt(fp.audiences.public)} | **${fmt(fp.composite)}** | ${fp.activeCatalystIds.length} |`,
    );
  }
  lines.push('');

  // Active Forecast Catalysts
  const enabledCats = catalysts.filter((c) => c.enabled);
  if (enabledCats.length > 0) {
    lines.push('### 3.1 Active Forecast Catalysts');
    lines.push('');
    lines.push('| ID | Expected Month | Probability | Category | Title & Audience Impacts |');
    lines.push('| :--- | :---: | :---: | :---: | :--- |');
    for (const c of enabledCats) {
      const impSummary = c.impacts
        .map((i) => `${i.audience.toUpperCase()}: ${bpsToDisplay(baseBps(i))} pts`)
        .join(', ');
      lines.push(
        `| \`${c.id}\` | \`${c.expectedMonth}\` | ${c.probability}% | \`${c.category}\` | **${c.title}** (${impSummary}) |`,
      );
    }
    lines.push('');
  }

  // Section 4: Starred Key Events
  const sortedEvents = sortEvents(events);
  const starred = sortedEvents.filter((e) => e.starred);
  lines.push(`## 4. Starred Key Events (${starred.length})`);
  lines.push('');
  if (starred.length === 0) {
    lines.push('_No events are currently starred._');
    lines.push('');
  } else {
    lines.push('| Date | ID | Source Type | Event Title | Audience Base Impacts (Raw Points) |');
    lines.push('| :---: | :--- | :---: | :--- | :--- |');
    for (const e of starred) {
      const impStr = e.impacts
        .map(
          (i) =>
            `${i.audience.toUpperCase()}: ${bpsToDisplay(baseBps(i))} (M${i.magnitude}/C${i.credibility}/${i.scope}/${i.persistence})`,
        )
        .join('; ');
      lines.push(`| \`${e.eventDate}\` | \`${e.id}\` | \`${e.sourceType}\` | ★ **${e.title}** | ${impStr} |`);
    }
    lines.push('');
  }

  // Section 5: Complete Evidence Ledger
  lines.push(`## 5. Complete Evidence & Impact Ledger (${sortedEvents.length} Events)`);
  lines.push('');
  for (const e of sortedEvents) {
    const starBadge = e.starred ? '★ ' : '';
    lines.push(`### ${starBadge}${e.eventDate} — ${e.title}`);
    lines.push(
      `- **ID:** \`${e.id}\` | **Source Type:** \`${e.sourceType}\` | **Origin:** \`${e.origin}\` | **Verification:** \`${e.verification}\``,
    );
    if (e.sourceUrls.length > 0) {
      lines.push(`- **Sources:** ${e.sourceUrls.join(', ')}`);
    }
    lines.push(`- **Summary:** ${e.summary}`);
    lines.push(
      `- **Audience Rubric Classifications:** ${e.impacts
        .map(
          (i) =>
            `**${AUDIENCE_LABELS[i.audience]}** (Dir=${i.direction > 0 ? '+1' : i.direction}, Mag=${i.magnitude}, Cred=T${i.credibility}, Scope=${i.scope}, Persist=${i.persistence} → Base \`${bpsToDisplay(baseBps(i))}\` raw pts)`,
        )
        .join(' | ')}`,
    );
    lines.push('');
  }

  // Section 6: Retroactive Score Revisions Audit Log
  lines.push(`## 6. Retroactive Score Revisions Audit Log (${revisions.length})`);
  lines.push('');
  if (revisions.length === 0) {
    lines.push('_No retroactive score revisions recorded._');
  } else {
    lines.push('| Timestamp | Run ID | Period | Audience | Old → New | Delta | Reason | Explanation |');
    lines.push('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |');
    for (const r of revisions) {
      const audName = r.audience === 'composite' ? 'Composite' : AUDIENCE_LABELS[r.audience];
      lines.push(
        `| \`${r.timestamp}\` | \`${r.runId}\` | \`${r.periodId}\` | ${audName} | ${centiToDisplay(r.oldScoreCenti)} → ${centiToDisplay(r.newScoreCenti)} | **${signedCenti(r.deltaCenti)}** | \`${r.revisionReason}\` | ${r.explanation} |`,
      );
    }
  }
  lines.push('');

  return lines.join('\n');
}
