import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Building2,
  CalendarClock,
  Check,
  CheckCheck,
  Cog,
  Copy,
  Database,
  FilePlus2,
  LogOut,
  Menu,
  Play,
  Radar,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  X,
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
    researchProgressPct,
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

  const [copiedHash, setCopiedHash] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu & cancel reset confirmation on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmReset(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setConfirmReset(false);
      }
    };
    if (menuOpen || confirmReset) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, confirmReset]);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  const copyOutputHash = () => {
    void navigator.clipboard?.writeText(result.outputHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1500);
  };

  const handleRunNowHeader = async () => {
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
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
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

  const tabs: Array<{
    id: string;
    targetTab: ActiveTab;
    isActive: boolean;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
    isAlert?: boolean;
  }> = [
    {
      id: 'overview',
      targetTab: 'dashboard',
      isActive: activeTab === 'dashboard',
      label: 'Overview',
      shortLabel: 'Overview',
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    {
      id: 'divisions',
      targetTab: 'divisions',
      isActive: activeTab === 'divisions',
      label: 'Divisions',
      shortLabel: 'Divisions',
      icon: <Building2 className="w-3.5 h-3.5" />,
    },
    {
      id: 'ledger',
      targetTab: 'ledger',
      isActive: activeTab === 'ledger',
      label: 'Evidence Ledger',
      shortLabel: 'Ledger',
      icon: <Database className="w-3.5 h-3.5" />,
      badge: unreadEvents > 0 ? unreadEvents : undefined,
    },
    {
      id: 'forecast_weights',
      targetTab: activeTab === 'control' ? 'control' : 'forecast',
      isActive: activeTab === 'forecast' || activeTab === 'control',
      label: 'Forecast & Weights',
      shortLabel: 'Forecast',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      badge: unreadCatalysts > 0 ? unreadCatalysts : undefined,
    },
    {
      id: 'operations',
      targetTab: activeTab === 'revisions' || activeTab === 'export' ? activeTab : 'research',
      isActive: activeTab === 'research' || activeTab === 'revisions' || activeTab === 'export',
      label: 'Operations',
      shortLabel: 'Ops',
      icon: <Radar className="w-3.5 h-3.5" />,
      badge: unreadResearch + unreadRevisions > 0 ? unreadResearch + unreadRevisions : undefined,
      isAlert: true,
    },
  ];

  const navTo = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMenuOpen(false);
    setConfirmReset(false);
  };

  return (
    <header className="bg-surface1 border-b border-hairline sticky top-0 z-30 shadow-xl">
      {/* Clean Minimal Top Bar: Home Logo + Ticker + Last Updated on Left | Run Now + Menu + Profile on Right */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Left: Home Logo + NYSE: HII Ticker + Last Updated Date */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            aria-label="HII Sentiment Intelligence Home"
            className="cursor-pointer flex items-center justify-center p-1.5 rounded-lg bg-surface0 border border-hairline hover:border-sky transition shadow-inner shrink-0"
            title="HII Sentiment Intelligence Home"
          >
            <HIILogo size="md" showWordmark={true} variant="dark" className="h-7 sm:h-8 w-auto" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-mono font-bold tabular-nums rounded bg-passion-solid text-white shrink-0">
                NYSE: HII
              </span>
              <span className="hidden md:inline-block text-xs text-muted">
                Sentiment Intelligence
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5 truncate font-mono tabular-nums">
              Updated <span className="text-white font-semibold">{result.asOfDate}</span>
            </p>
          </div>
        </div>

        {/* Right: Run Now Button + System Menu Popover + Profile Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {userRole === 'admin' ? (
            <button
              type="button"
              disabled={isResearchRunning || budget.totalSpendUsd >= budget.monthlyCapUsd}
              onClick={() => void handleRunNowHeader()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md transition ${
                isResearchRunning
                  ? 'bg-deepsea border border-passion cursor-wait'
                  : 'bg-[#c75b12] hover:bg-[#ea7722] disabled:opacity-50'
              }`}
              title="Launch Vertex AI 4-Audience Deep Research Sweep"
            >
              {isResearchRunning ? (
                <>
                  <Cog className="w-3.5 h-3.5 animate-spin text-passion" />
                  <span className="tabular-nums">Running {researchProgressPct}%</span>
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface0 border border-hairline text-sky text-xs font-mono"
              title="Viewer access (Read-Only)"
            >
              <UserCheck className="w-3.5 h-3.5 text-lift" />
              <span className="hidden sm:inline">Viewer</span>
            </span>
          )}

          {/* System Info & Tools Menu Button */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className={`relative inline-flex items-center justify-center p-2 rounded-lg border transition ${
                menuOpen
                  ? 'bg-surface2 border-passion text-white'
                  : 'bg-surface0 border-hairline text-muted hover:text-white hover:border-sky'
              }`}
              title="Schedule, FinOps Budget, Clearance, Audit Proof & Quick Actions"
              aria-label="System menu"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              {userRole === 'admin' && pendingRequests.length > 0 && !menuOpen && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-passion-solid text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            {menuOpen && (
              <div
                role="dialog"
                aria-label="System and Governance Menu"
                className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-surface1 border border-hairline rounded-xl shadow-2xl p-3 z-50 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between border-b border-hairline pb-2">
                  <span className="font-semibold text-white tracking-wide text-xs">
                    System &amp; Governance
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface0 border border-hairline text-[11px] font-mono tabular-nums text-sky">
                    {result.engineVersion}
                  </span>
                </div>

                {/* Schedule Item */}
                <button
                  type="button"
                  onClick={() => navTo('research')}
                  className="w-full text-left p-2.5 rounded-lg bg-surface0 border border-hairline hover:border-sky transition flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarClock className="w-4 h-4 text-sky shrink-0" />
                    <div className="min-w-0">
                      <span className="text-white font-semibold block">Automated Schedule</span>
                      <span className="text-[11px] font-mono tabular-nums text-muted block truncate">
                        {scheduleConfig.enabled ? `Every Mon ${scheduleConfig.hourEt} ET` : 'Paused'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-sky shrink-0">
                    {userRole === 'admin' ? 'Configure →' : 'View →'}
                  </span>
                </button>

                {/* FinOps Budget Guard Item */}
                <button
                  type="button"
                  onClick={() => navTo('research')}
                  className="w-full text-left p-2.5 rounded-lg bg-surface0 border border-hairline hover:border-sky transition flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-passion shrink-0" />
                    <div className="min-w-0">
                      <span className="text-white font-semibold block">FinOps Budget Guard</span>
                      <span className="text-[11px] font-mono tabular-nums text-muted block">
                        ${budget.totalSpendUsd.toFixed(2)} / ${budget.monthlyCapUsd.toFixed(2)}/mo
                      </span>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-lift/15 text-lift border border-lift/30 shrink-0">
                    {budget.circuitBreaker}
                  </span>
                </button>

                {/* Audit Proof Copy */}
                <button
                  type="button"
                  onClick={copyOutputHash}
                  className="w-full text-left p-2.5 rounded-lg bg-surface0 border border-hairline hover:border-sky transition flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-lift shrink-0" />
                    <div className="min-w-0">
                      <span className="text-white font-semibold block">Deterministic Audit Proof</span>
                      <span className="text-[11px] font-mono text-sky truncate block">{result.outputHash.slice(0, 16)}…</span>
                    </div>
                  </div>
                  {copiedHash ? (
                    <Check className="w-4 h-4 text-lift shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted shrink-0" />
                  )}
                </button>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navTo('control')}
                    className="group flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-passion-solid/20 border border-passion/60 hover:bg-passion-solid hover:text-white text-white font-semibold transition"
                  >
                    <FilePlus2 className="w-3.5 h-3.5 text-passion group-hover:text-white" />
                    <span>{userRole === 'admin' ? 'Add Article / Doc' : 'View Controls'}</span>
                  </button>

                  {!confirmReset ? (
                    <button
                      type="button"
                      disabled={userRole !== 'admin'}
                      onClick={() => setConfirmReset(true)}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-surface0 border border-hairline hover:border-drag/60 text-muted hover:text-white disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
                      title={userRole === 'admin' ? 'Restore local cache to latest seed baseline' : 'Admin only'}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-sky" />
                      <span className="tabular-nums">Reset Seed ({state.events.length})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        resetToLatestSeed();
                        setConfirmReset(false);
                        setMenuOpen(false);
                      }}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-drag text-white font-bold transition shadow"
                      title="Click again to overwrite local edits with baseline seed"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirm Reset?</span>
                    </button>
                  )}
                </div>

                {/* Admin Clearance Manager */}
                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserModal(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface0 border border-hairline hover:border-sky text-white font-semibold transition"
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-passion" />
                      <span>Access &amp; Clearance Manager</span>
                    </span>
                    {pendingRequests.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-passion-solid text-white text-[11px] font-bold tabular-nums">
                        {pendingRequests.length} pending
                      </span>
                    )}
                  </button>
                )}

                {/* User Info & Sign Out */}
                {currentUser && (
                  <div className="pt-2 border-t border-hairline flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-white font-semibold block truncate">
                        {currentUser.displayName || 'Authorized User'}
                      </span>
                      <span className="text-[11px] font-mono text-muted block truncate">
                        {currentUser.email}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void signOut();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface0 border border-hairline hover:border-drag text-muted hover:text-white transition shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile Avatar */}
          {currentUser && (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account and system menu"
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-sky shrink-0"
              title={`${currentUser.displayName || 'User'} (${currentUser.email}) — Click for menu`}
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-hairline hover:border-sky transition"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface0 border border-hairline flex items-center justify-center text-xs font-bold text-white">
                  {(currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Consolidated 5-Tab Navigation Bar */}
      <nav
        aria-label="Primary workspace navigation"
        className="max-w-[1600px] mx-auto px-2 sm:px-4 flex items-center gap-1 overflow-x-auto border-t border-hairline bg-surface0 no-scrollbar"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.targetTab)}
            aria-current={t.isActive ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              t.isActive
                ? 'border-passion text-white bg-surface2/70'
                : 'border-transparent text-muted hover:text-white hover:bg-surface2/40'
            }`}
          >
            {t.icon}
            <span className="sm:hidden">{t.shortLabel}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums ${
                  t.isAlert
                    ? 'bg-passion-solid text-white'
                    : 'bg-surface1 border border-hairline text-sky'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}

        {totalUnread > 0 && (
          <button
            type="button"
            onClick={clearAllNotifications}
            aria-label="Mark all updates as viewed"
            className="ml-auto flex items-center gap-1 px-2.5 py-1 my-1 rounded text-xs font-mono tabular-nums text-muted hover:text-white hover:bg-surface2 border border-hairline transition whitespace-nowrap"
            title="Mark all notifications and updates as viewed"
          >
            <CheckCheck className="w-3.5 h-3.5 text-lift" />
            <span className="hidden sm:inline">Clear ({totalUnread})</span>
            <span className="sm:hidden">({totalUnread})</span>
          </button>
        )}
      </nav>
    </header>
  );
};
