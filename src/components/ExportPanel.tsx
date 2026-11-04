import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, ShieldCheck } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { computeLedgerScores, generateMarkdownExport } from '../engine';

export const ExportPanel: React.FC = () => {
  const { state, result, takeSnapshot } = useDashboard();
  const [copied, setCopied] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const markdown = useMemo(
    () => generateMarkdownExport(result, state.events, state.catalysts, state.revisions),
    [result, state.events, state.catalysts, state.revisions],
  );

  const handleCopy = () => {
    void navigator.clipboard?.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HII_Sentiment_Audit_Report_${result.asOfDate}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerifyDeterminism = () => {
    const shuffled = [...state.events].reverse();
    const runA = computeLedgerScores(state.events, state.catalysts, state.settings);
    const runB = computeLedgerScores(shuffled, state.catalysts, state.settings);
    if (runA.outputHash === runB.outputHash && runA.ledgerHash === runB.ledgerHash) {
      setVerifyMsg(
        `VERIFIED BIT-IDENTICAL: Forward & reverse-order recomputations matched SHA-256 output hash ${runA.outputHash.slice(0, 24)}… across all ${runA.timeline.length} periods and ${runA.forecast.length} forecast months.`,
      );
    } else {
      setVerifyMsg('ERROR: Hash mismatch detected!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-deepsea border border-steel/60 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel/50 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              MARKDOWN EXPORT & DETERMINISTIC REPRODUCIBILITY VERIFIER
            </h2>
            <p className="text-xs text-sky/85 mt-0.5">
              Export the full historical sentiment ledger, per-audience breakdowns, starred key events, 6-month forecast, and retroactive revisions log as standalone Markdown.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyDeterminism}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-charcoal border border-changingsea hover:border-sky text-xs font-mono font-semibold text-sky transition"
            >
              <ShieldCheck className="w-4 h-4 text-passion" />
              <span>Verify Determinism Now</span>
            </button>

            <button
              type="button"
              onClick={() => void takeSnapshot(`Audit Snapshot (${new Date().toISOString().slice(0, 10)})`)}
              className="px-3 py-2 rounded bg-charcoal border border-steel hover:border-sky text-xs font-mono text-white transition"
            >
              Save Hash Snapshot
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-charcoal border border-sky text-xs font-semibold text-white hover:bg-deepsea transition"
            >
              {copied ? <Check className="w-4 h-4 text-passion" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied Markdown!' : 'Copy Markdown'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-passion hover:bg-passion/90 text-xs font-bold text-white shadow-lg transition"
            >
              <Download className="w-4 h-4" />
              <span>Download .md Report</span>
            </button>
          </div>
        </div>

        {verifyMsg && (
          <div className="mb-4 p-3 rounded bg-changingsea/25 border border-changingsea text-xs font-mono text-white">
            {verifyMsg}
          </div>
        )}

        <pre className="bg-charcoal border border-steel/50 rounded-lg p-4 text-xs font-mono text-sky/95 overflow-x-auto max-h-[600px] whitespace-pre-wrap">
          {markdown}
        </pre>
      </div>
    </div>
  );
};
