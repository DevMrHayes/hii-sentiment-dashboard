import React, { useState } from 'react';
import {
  Activity,
  Anchor,
  Check,
  Copy,
  Database,
  FileText,
  GitCommit,
  Radar,
  Sliders,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useDashboard, type ActiveTab } from '../context/DashboardContext';

export const HeaderBar: React.FC = () => {
  const { state, result, budget, activeTab, setActiveTab } = useDashboard();
  const [copiedHash, setCopiedHash] = useState<'ledger' | 'output' | null>(null);

  const copyHash = (kind: 'ledger' | 'output', val: string) => {
    void navigator.clipboard?.writeText(val);
    setCopiedHash(kind);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'dashboard', label: 'Analytics & Timeline', icon: <Activity className="w-4 h-4" /> },
    {
      id: 'ledger',
      label: 'Impact Events Ledger',
      icon: <Database className="w-4 h-4" />,
      badge: state.events.length,
    },
    { id: 'control', label: 'Control & Rubric Studio', icon: <Sliders className="w-4 h-4" /> },
    {
      id: 'forecast',
      label: '6-Mo Forecast Catalysts',
      icon: <TrendingUp className="w-4 h-4" />,
      badge: state.catalysts.filter((c) => c.enabled).length,
    },
    {
      id: 'research',
      label: 'Vertex Deep Research',
      icon: <Radar className="w-4 h-4" />,
      badge: state.pending.length > 0 ? state.pending.length : undefined,
    },
    {
      id: 'revisions',
      label: 'Retroactive Revisions',
      icon: <GitCommit className="w-4 h-4" />,
      badge: state.revisions.length > 0 ? state.revisions.length : undefined,
    },
    { id: 'export', label: 'Markdown & Audit', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-deepsea border-b border-steel/60 sticky top-0 z-30 shadow-lg">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Subject */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-charcoal border border-sky/50 flex items-center justify-center shadow-inner">
            <Anchor className="w-5 h-5 text-passion" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                HII SENTIMENT INTELLIGENCE
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-passion text-white">
                NYSE: HII
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-charcoal/80 border border-steel text-sky">
                DETERMINISTIC {result.engineVersion}
              </span>
            </div>
            <p className="text-xs text-sky/90">
              Multi-Audience Stakeholder Ledger (Executive · Congress · Navy · American Public) · As-Of{' '}
              <span className="font-mono text-white">{result.asOfDate}</span>
            </p>
          </div>
        </div>

        {/* Cryptographic Reproducibility Stamps & GCP Budget Guard */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => copyHash('ledger', result.ledgerHash)}
            title="Click to copy canonical SHA-256 Ledger Hash"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-charcoal/90 border border-steel/70 hover:border-sky transition font-mono"
          >
            <span className="text-steel">LEDGER SHA256:</span>
            <span className="text-sky">{result.ledgerHash.slice(0, 10)}…</span>
            {copiedHash === 'ledger' ? (
              <Check className="w-3.5 h-3.5 text-passion" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-steel" />
            )}
          </button>

          <button
            onClick={() => copyHash('output', result.outputHash)}
            title="Click to copy deterministic SHA-256 Score Output Hash"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-charcoal/90 border border-steel/70 hover:border-sky transition font-mono"
          >
            <span className="text-steel">OUTPUT SHA256:</span>
            <span className="text-changingsea">{result.outputHash.slice(0, 10)}…</span>
            {copiedHash === 'output' ? (
              <Check className="w-3.5 h-3.5 text-passion" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-steel" />
            )}
          </button>

          <div
            onClick={() => setActiveTab('research')}
            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded bg-charcoal/90 border border-changingsea/60 hover:border-passion transition font-mono"
            title="Vertex AI Monthly FinOps Circuit Breaker"
          >
            <Sparkles className="w-3.5 h-3.5 text-passion" />
            <span className="text-white">
              GCP FinOps: ${budget.totalSpendUsd.toFixed(2)} / ${budget.monthlyCapUsd.toFixed(2)}
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-changingsea/30 text-sky">
              {budget.circuitBreaker}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-[1600px] mx-auto px-4 flex items-center gap-1 overflow-x-auto border-t border-steel/40 bg-charcoal/40">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          const isAlertBadge = t.id === 'research' || t.id === 'revisions';
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-passion text-white bg-deepsea/80'
                  : 'border-transparent text-sky/80 hover:text-white hover:bg-deepsea/40'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                    isAlertBadge
                      ? 'bg-passion text-white'
                      : 'bg-charcoal border border-steel text-sky'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
