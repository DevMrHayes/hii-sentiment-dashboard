/**
 * Headless CLI recomputation & determinism verifier (`npm run recompute`).
 */
import { centiToDisplay, computeLedgerScores, signedCenti } from '../src/engine/index.ts';
import { loadDiskState } from '../server/diskStorage.ts';

function main() {
  const state = loadDiskState();
  const r1 = computeLedgerScores(state.events, state.catalysts, state.settings);
  const r2 = computeLedgerScores([...state.events].reverse(), state.catalysts, state.settings);

  if (r1.outputHash !== r2.outputHash) {
    console.error('[FAIL] Determinism violation: outputHash mismatch under reverse event ordering!');
    process.exit(1);
  }

  console.log('================================================================================');
  console.log('  HII SENTIMENT INTELLIGENCE — DETERMINISTIC LEDGER RECOMPUTATION');
  console.log('================================================================================');
  console.log(`  Engine / Rubric : ${r1.engineVersion} / ${r1.rubricVersion}`);
  console.log(`  As-Of Date      : ${r1.asOfDate}`);
  console.log(`  Events / Cats   : ${state.events.length} committed events | ${state.catalysts.length} forecast catalysts`);
  console.log(`  Ledger SHA-256  : ${r1.ledgerHash}`);
  console.log(`  Output SHA-256  : ${r1.outputHash} [VERIFIED ORDER-INVARIANT]`);
  console.log('--------------------------------------------------------------------------------');
  console.log('  Period     | Granularity |  Exec  |  Cong  |  Navy  | Public | COMPOSITE (Delta)');
  console.log('--------------------------------------------------------------------------------');
  for (const rec of r1.timeline) {
    console.log(
      `  ${rec.period.id.padEnd(10)} | ${rec.period.granularity.padEnd(11)} | ${centiToDisplay(rec.audiences.executive.scoreCenti).padStart(6)} | ${centiToDisplay(rec.audiences.congress.scoreCenti).padStart(6)} | ${centiToDisplay(rec.audiences.navy.scoreCenti).padStart(6)} | ${centiToDisplay(rec.audiences.public.scoreCenti).padStart(6)} |   ${centiToDisplay(rec.compositeCenti).padStart(6)} (${signedCenti(rec.compositeDeltaCenti)})`,
    );
  }
  console.log('--------------------------------------------------------------------------------');
  console.log('  6-MONTH DETERMINISTIC FORECAST (Expected Value [P10 – P90]):');
  for (const fp of r1.forecast) {
    console.log(
      `  ${fp.period.id.padEnd(10)} | Forecast    | Composite EV: ${centiToDisplay(fp.composite.evCenti)}  [${centiToDisplay(fp.composite.p10Centi)} – ${centiToDisplay(fp.composite.p90Centi)}]`,
    );
  }
  console.log('================================================================================');
}

main();
