import React, { useState, useEffect } from 'react';
import {
  Activity,
  BellOff,
  CheckCheck,
  Building2,
  CalendarClock,
  Check,
  Copy,
  Database,
  FileText,
  GitCommit,
  Loader2,
  LogOut,
  Play,
  Radar,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useDashboard, type ActiveTab } from '../context/DashboardContext';
import { useAuth } from '../context/AuthContext';
import { HIILogo } from './HIILogo';

export const HeaderBar: React.FC = () => {
  const {
    state,
    result,
    budget,
    scheduleConfig,
    activeTab,
    setActiveTab,
    isResearchRunning,
    triggerResearchRun,
    resetToLatestSeed,
  } = useDashboard();

  const {
    currentUser,
    userRole,
    pendingRequests,
    setShowUserModal,
    signOut,
  } = useAuth();
  const [copiedHash, setCopiedHash] = useState<'ledger' | 'output' | null>(null);

  const copyHash = (kind: 'ledger' | 'output', val: string) => {
    void navigator.clipboard?.writeText(val);
    setCopiedHash(kind);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const handleRunNowHeader = async () => {
    setActiveTab('research');
    await triggerResearchRun(scheduleConfig.audiences, scheduleConfig.mode, false);
  };

  // Persistent notification read tracking
  const NOTIFICATION_READS_KEY = 'hii_sentiment_notification_reads_v2';
  const [readCounts, setReadCounts] = useState<{
    revisions: number;
    research: number;
    catalysts: number;
    events: number;
  }>(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATION_READS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    // Initialize with current counts so initial state starts clean
    return {
      revisions: state.revisions.length,
      research: 0,
      catalysts: state.catalysts.length,
      events: state.events.length,
    };
  });

  // Whenever user navigates to a tab, clear that tab's unread badge
  useEffect(() => {
    setReadCounts((prev) => {
      let changed = false;
      const next = { ...prev };

      if (activeTab === 'revisions' && next.revisions !== state.revisions.length) {
        next.revisions = state.revisions.length;
        changed = true;
      } else if (activeTab === 'research' && next.research !== state.pending.length) {
        next.research = state.pending.length;
        changed = true;
      } else if (activeTab === 'forecast' && next.catalysts !== state.catalysts.length) {
        next.catalysts = state.catalysts.length;
        changed = true;
      } else if (activeTab === 'ledger' && next.events !== state.events.length) {
        next.events = state.events.length;
        changed = true;
      }

      if (changed) {
        try {
          localStorage.setItem(NOTIFICATION_READS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      }
      return prev;
    });
  }, [activeTab, state.revisions.length, state.pending.length, state.catalysts.length, state.events.length]);

  const clearAllNotifications = () => {
    const next = {
      revisions: state.revisions.length,
      research: state.pending.length,
      catalysts: state.catalysts.length,
      events: state.events.length,
    };
    setReadCounts(next);
    try {
      localStorage.setItem(NOTIFICATION_READS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const unreadRevisions = Math.max(0, state.revisions.length - (readCounts.revisions ?? state.revisions.length));
  const unreadResearch = Math.max(0, state.pending.length - (readCounts.research ?? 0));
  const unreadCatalysts = Math.max(0, state.catalysts.length - (readCounts.catalysts ?? state.catalysts.length));
  const unreadEvents = Math.max(0, state.events.length - (readCounts.events ?? state.events.length));
  const totalUnread = unreadRevisions + unreadResearch + unreadCatalysts + unreadEvents;

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'dashboard', label: 'Analytics & Timeline', icon: <Activity className="w-4 h-4" /> },
    {
      id: 'divisions',
      label: 'Division Sentiment (NNS · Ingalls · Mission Tech)',
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: 'ledger',
      label: 'Impact Events Ledger',
      icon: <Database className="w-4 h-4" />,
      badge: unreadEvents > 0 ? unreadEvents : undefined,
    },
    { id: 'control', label: 'Control & Rubric Studio', icon: <Sliders className="w-4 h-4" /> },
    {
      id: 'forecast',
      label: '6-Mo Forecast Catalysts',
      icon: <TrendingUp className="w-4 h-4" />,
      badge: unreadCatalysts > 0 ? unreadCatalysts : undefined,
    },
    {
      id: 'research',
      label: 'Monday Schedule, Budget & Research',
      icon: <Radar className="w-4 h-4" />,
      badge: unreadResearch > 0 ? unreadResearch : undefined,
    },
    {
      id: 'revisions',
      label: 'Retroactive Revisions',
      icon: <GitCommit className="w-4 h-4" />,
      badge: unreadRevisions > 0 ? unreadRevisions : undefined,
    },
    { id: 'export', label: 'Markdown & Audit', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-[#1a1e23] border-b border-[#363c44] sticky top-0 z-30 shadow-xl">
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Subject with Official HII Logo */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setActiveTab('dashboard')}
            className="cursor-pointer flex items-center justify-center p-1.5 rounded-lg bg-[#24272a] border border-steel/50 hover:border-sky transition shadow-inner"
            title="Huntington Ingalls Industries (NYSE: HII)"
          >
            <HIILogo size="md" showWordmark={true} variant="dark" className="h-9 w-auto" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-passion text-white">
                NYSE: HII
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-charcoal/90 border border-steel/70 text-sky">
                DETERMINISTIC {result.engineVersion}
              </span>
            </div>
            <p className="text-xs text-sky/90 mt-0.5">
              Multi-Audience Stakeholder Ledger (Executive · Congress · Navy · American Public) · As-Of{' '}
              <span className="font-mono text-white">{result.asOfDate}</span>
            </p>
          </div>
        </div>

        {/* Schedule Status, FinOps Budget Pill, Hash Stamps & Run Now Button */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Monday Schedule Badge */}
          <div
            onClick={() => setActiveTab('research')}
            title="Weekly Monday Morning Multi-Agent Schedule"
            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded bg-charcoal/90 border border-sky/50 hover:border-passion transition font-mono"
          >
            <CalendarClock className="w-3.5 h-3.5 text-sky" />
            <span className="text-white">
              Schedule: {scheduleConfig.enabled ? `Every Mon ${scheduleConfig.hourEt} ET` : 'Paused'}
            </span>
          </div>

          {/* FinOps Budget Guard Badge */}
          <div
            onClick={() => setActiveTab('research')}
            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded bg-charcoal/90 border border-changingsea/60 hover:border-passion transition font-mono"
            title="Monthly Multi-Agent Polling Budget Guard"
          >
            <Sparkles className="w-3.5 h-3.5 text-passion" />
            <span className="text-white">
              Budget: ${budget.totalSpendUsd.toFixed(2)} / ${budget.monthlyCapUsd.toFixed(2)}/mo
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-changingsea/30 text-sky">
              {budget.circuitBreaker}
            </span>
          </div>

          <button
            onClick={resetToLatestSeed}
            title="Reset/Sync browser cache to latest 152-event Deep Research Ledger"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-charcoal/90 border border-steel/70 hover:border-sky transition text-sky hover:text-white font-mono text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-changingsea" />
            <span>Sync Seed ({state.events.length})</span>
          </button>

          <button
            onClick={() => copyHash('output', result.outputHash)}
            title="Click to copy deterministic SHA-256 Score Output Hash"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-charcoal/90 border border-steel/70 hover:border-sky transition font-mono"
          >
            <span className="text-steel">SHA256:</span>
            <span className="text-changingsea">{result.outputHash.slice(0, 8)}…</span>
            {copiedHash === 'output' ? (
              <Check className="w-3.5 h-3.5 text-passion" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-steel" />
            )}
          </button>

          {/* Admin Clearance & User Requests Manager */}
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={() => setShowUserModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-charcoal border border-sky/70 hover:border-passion text-xs font-semibold text-white transition shadow-sm font-mono"
              title="Manage access requests and approved viewers"
            >
              <Shield className="w-3.5 h-3.5 text-passion" />
              <span>Clearance</span>
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-passion text-white text-[10px] font-bold animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}

          {/* Prominent "Run Now" Trigger Button (Admin only) */}
          {userRole === 'admin' ? (
            <button
              type="button"
              disabled={isResearchRunning || budget.totalSpendUsd >= budget.monthlyCapUsd}
              onClick={() => void handleRunNowHeader()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-passion hover:bg-passion/90 disabled:opacity-50 text-xs font-bold text-white shadow-md transition"
            >
              {isResearchRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Agents Running…</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run Now</span>
                </>
              )}
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#16191d] border border-steel/60 text-sky text-xs font-mono"
              title="Viewer access (Read-Only). Contact administrator to trigger agent runs."
            >
              <UserCheck className="w-3.5 h-3.5 text-changingsea" />
              <span>Viewer (Read-Only)</span>
            </span>
          )}

          {/* User Identity Chip & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-1 border-l border-[#363c44]">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-steel/70"
                  title={`${currentUser.displayName} (${currentUser.email})`}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full bg-[#24272a] border border-steel flex items-center justify-center text-xs font-bold text-white"
                  title={currentUser.email || ''}
                >
                  {(currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}

              <button
                type="button"
                onClick={signOut}
                className="p-1.5 rounded text-steel hover:text-white hover:bg-charcoal transition"
                title={`Sign out (${currentUser.email})`}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-[1600px] mx-auto px-4 flex items-center gap-1 overflow-x-auto border-t border-[#313740] bg-[#16191d]">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          const isAlertBadge = t.id === 'research' || t.id === 'revisions';
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-passion text-white bg-[#22272e]'
                  : 'border-transparent text-sky/80 hover:text-white hover:bg-[#20252b]'
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

        {/* Clear All Notifications Button when unread badges exist */}
        {totalUnread > 0 && (
          <button
            type="button"
            onClick={clearAllNotifications}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 my-1.5 rounded text-[11px] font-mono text-steel hover:text-white hover:bg-charcoal border border-steel/40 transition whitespace-nowrap"
            title="Mark all notifications and updates as viewed"
          >
            <CheckCheck className="w-3.5 h-3.5 text-passion" />
            <span>Clear Badges ({totalUnread})</span>
          </button>
        )}
      </div>
    </header>
  );
};
