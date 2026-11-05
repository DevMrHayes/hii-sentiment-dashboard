import React from 'react';
import { GitCommit, X } from 'lucide-react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { HeaderBar } from './components/HeaderBar';
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
  const { activeTab, recentRevisionsBanner, dismissRevisionsBanner, setActiveTab } = useDashboard();

  return (
    <div className="min-h-screen bg-charcoal text-white flex flex-col">
      <HeaderBar />

      {/* Retroactive Revision Alert Banner */}
      {recentRevisionsBanner.length > 0 && (
        <div className="max-w-[1600px] w-full mx-auto px-4 mt-3">
          <div className="bg-deepsea border-2 border-passion rounded-lg p-3 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5 text-xs">
              <GitCommit className="w-5 h-5 text-passion shrink-0" />
              <div>
                <span className="font-bold text-white">
                  Retroactive Score Revision Detected ({recentRevisionsBanner.length} period/audience adjustments):
                </span>{' '}
                <span className="text-sky">{recentRevisionsBanner[0]?.explanation}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('revisions')}
                className="px-2.5 py-1 rounded bg-passion text-white text-xs font-bold"
              >
                View Revisions Audit
              </button>
              <button
                onClick={dismissRevisionsBanner}
                className="p-1 text-sky hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] w-full mx-auto px-4 py-5 flex-1">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <TrendChart />
              <EventTimeline compact />
            </div>
            <div className="lg:col-span-4">
              <ScoreRail />
            </div>
          </div>
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
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}

export default App;
