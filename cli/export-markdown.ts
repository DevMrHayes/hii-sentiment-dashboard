/**
 * CLI Markdown Exporter (`npm run export:md`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { computeLedgerScores, generateMarkdownExport } from '../src/engine/index.ts';
import { loadDiskState, REPO_ROOT } from '../server/diskStorage.ts';

function main() {
  const state = loadDiskState();
  const result = computeLedgerScores(state.events, state.catalysts, state.settings);
  const md = generateMarkdownExport(result, state.events, state.catalysts, state.revisions);
  const outPath = path.join(REPO_ROOT, 'HII_Sentiment_Audit_Report.md');
  fs.writeFileSync(outPath, md, 'utf-8');
  console.log(`[Export] Wrote ${md.split('\n').length} lines to ${outPath}`);
}

main();
