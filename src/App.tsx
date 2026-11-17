import React from 'react';
import { GitCommit, X } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { AuthWall } from './components/AuthWall';
import { UserManagementModal } from './components/UserManagementModal';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { HeaderBar } from './components/HeaderBar';
import { LiveResearchBanner } from './components/LiveResearchBanner';
import { TrendChart } from './components/TrendChart';
import { ScoreRail } from './components/ScoreRail';
import { EventTimeline } from './components/EventTimeline';
import { ControlPane } from './components/ControlPane';
import { DivisionSentimentView } from './components/DivisionSentimentView';
import { CatalystStudio } from './components/CatalystStudio';
import { ResearchPanel } from './components/ResearchPanel';
import { RevisionsPanel } from './components/RevisionsPanel';
import { ExportPanel } from './components/ExportPanel';

const DashboardContent: React.FC = () => {
  const {
    activeTab,
    recentRevisionsBanner,
    dismissRevisionsBanner,
    setActiveTab,
    isChartExpanded,
  } = useDashboard();

  const isForecastGroup = activeTab === 'forecast' || activeTab === 'control';
  const isOperationsGroup =
    activeTab === 'research' || activeTab === 'revisions' || activeTab === 'export';

  return (
    <div className="min-h-screen bg-surface0 text-gray-100 flex flex-col">
      <HeaderBar />
      <LiveResearchBanner />

      {/* Retroactive Revision Alert Banner */}
      {recentRevisionsBanner.length > 0 && (
        <div className="max-w-[1600px] w-full mx-auto px-4 mt-3">
          <div className="bg-surface1 border border-passion/70 rounded-lg p-3 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5 text-xs">
              <GitCommit className="w-5 h-5 text-passion shrink-0" />
              <div>
                <span className="font-bold text-white tabular-nums">
                  Retroactive Score Revision Detected ({recentRevisionsBanner.length} period/audience adjustments):
                </span>{' '}
                <span className="text-muted">{recentRevisionsBanner[0]?.explanation}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('revisions')}
                className="px-2.5 py-1 rounded bg-passion-solid hover:bg-passion text-white text-xs font-bold transition"
              >
                View Revisions Audit
              </button>
              <button
                type="button"
                onClick={dismissRevisionsBanner}
                aria-label="Dismiss revision alert"
                className="p-1 text-muted hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main
        className={`w-full mx-auto px-3 sm:px-4 py-5 flex-1 transition-all duration-300 space-y-4 ${
          isChartExpanded && activeTab === 'dashboard' ? 'max-w-[1850px]' : 'max-w-[1600px]'
        }`}
      >
        {isForecastGroup && (
          <div
            role="tablist"
            aria-label="Forecast and Weights workspace views"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-surface1 border border-hairline"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'forecast'}
              onClick={() => setActiveTab('forecast')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'forecast'
                  ? 'bg-surface2 text-white border border-hairline shadow-sm'
                  : 'text-muted hover:text-white border border-transparent'
              }`}
            >
              6-Month Scenario &amp; Catalyst Studio
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'control'}
              onClick={() => setActiveTab('control')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'control'
                  ? 'bg-surface2 text-white border border-hairline shadow-sm'
                  : 'text-muted hover:text-white border border-transparent'
              }`}
            >
              Composite Weights &amp; Manual Evidence
            </button>
          </div>
        )}

        {isOperationsGroup && (
          <div
            role="tablist"
            aria-label="Operations workspace views"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-surface1 border border-hairline"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'research'}
              onClick={() => setActiveTab('research')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'research'
                  ? 'bg-surface2 text-white border border-hairline shadow-sm'
                  : 'text-muted hover:text-white border border-transparent'
              }`}
            >
              Research &amp; Schedule
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'revisions'}
              onClick={() => setActiveTab('revisions')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'revisions'
                  ? 'bg-surface2 text-white border border-hairline shadow-sm'
                  : 'text-muted hover:text-white border border-transparent'
              }`}
            >
              Retroactive Revisions Audit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'export'}
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'export'
                  ? 'bg-surface2 text-white border border-hairline shadow-sm'
                  : 'text-muted hover:text-white border border-transparent'
              }`}
            >
              Deterministic Markdown Export
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          isChartExpanded ? (
            <div className="space-y-6">
              {/* Full Width Expanded Presentation Chart */}
              <div className="w-full">
                <TrendChart />
              </div>

              {/* High-density grid underneath full-width chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8">
                  <EventTimeline compact />
                </div>
                <div className="lg:col-span-4 order-first lg:order-none">
                  <ScoreRail />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 space-y-5">
                <TrendChart />
                <EventTimeline compact />
              </div>
              <div className="lg:col-span-4 order-first lg:order-none">
                <ScoreRail />
              </div>
            </div>
          )
        )}

        {activeTab === 'divisions' && <DivisionSentimentView />}
        {activeTab === 'ledger' && <EventTimeline />}
        {activeTab === 'control' && <ControlPane />}
        {activeTab === 'forecast' && <CatalystStudio />}
        {activeTab === 'research' && <ResearchPanel />}
        {activeTab === 'revisions' && <RevisionsPanel />}
        {activeTab === 'export' && <ExportPanel />}
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AuthWall>
        <DashboardProvider>
          <DashboardContent />
          <UserManagementModal />
        </DashboardProvider>
      </AuthWall>
    </AuthProvider>
  );
}

export default App;
