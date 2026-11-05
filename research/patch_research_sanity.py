from pathlib import Path

p = Path('hii-sentiment-dashboard/src/components/ResearchPanel.tsx')
text = p.read_text(encoding='utf-8').replace('\r\n', '\n')

# 1. Imports: add Lucide icons
target_icons = "  ShieldCheck,\n  Sparkles,\n  X,\n} from 'lucide-react';"
replacement_icons = "  ShieldCheck,\n  Sparkles,\n  X,\n  Plus,\n  Trash2,\n  HelpCircle,\n  FileSearch,\n  AlertTriangle,\n} from 'lucide-react';"
text = text.replace(target_icons, replacement_icons)

# 2. Add SanityCheck hooks from useDashboard
target_hook = "    rejectPending,\n  } = useDashboard();"
replacement_hook = """    rejectPending,
    sanityChecks,
    addSanityCheck,
    deleteSanityCheck,
    resolveSanityCheck,
  } = useDashboard();

  // Sanity check form state
  const [scPeriod, setScPeriod] = useState('');
  const [scAspect, setScAspect] = useState('');
  const [scDirective, setScDirective] = useState('');
  const [scAudience, setScAudience] = useState<'all' | AudienceId>('all');
  const [scPriority, setScPriority] = useState<'high' | 'normal'>('high');
  const [showSanityModal, setShowSanityModal] = useState(false);"""

text = text.replace(target_hook, replacement_hook)

# 3. Add handleAddSanityCheck helper
target_launch = "  const handleLaunchNow = async (isMondaySim = false) => {"
replacement_launch = """  const handleAddSanityCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scPeriod.trim() || !scAspect.trim() || !scDirective.trim()) return;
    addSanityCheck({
      periodOrRange: scPeriod.trim(),
      aspect: scAspect.trim(),
      directive: scDirective.trim(),
      audience: scAudience,
      priority: scPriority,
    });
    setScPeriod('');
    setScAspect('');
    setScDirective('');
    setShowSanityModal(false);
  };

  const handleLaunchNow = async (isMondaySim = false) => {"""

text = text.replace(target_launch, replacement_launch)

# 4. Insert the Sanity Check UI right before Audience Query Pack Selector
target_section = "      {/* Audience Query Pack Selector */}"
replacement_section = """      {/* Longitudinal Sanity Check Directives & Verification Queue */}
      <div className="bg-[#1e2227] border border-[#363c44] rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#363c44] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-passion" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                LONGITUDINAL SANITY CHECK DIRECTIVES & VERIFICATION QUEUE
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-passion/20 border border-passion/50 text-passion">
                {sanityChecks.filter((s) => s.status === 'queued').length} Queued
              </span>
            </div>
            <p className="text-xs text-sky/85 mt-0.5">
              Specify temporal periods, stock divergences, or contract aspects to sanity check through Vertex AI deep research. Logged items automatically inject into subsequent agent sweeps.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSanityModal(!showSanityModal)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-passion hover:bg-passion/90 text-white font-bold text-xs shadow-md transition self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showSanityModal ? 'Hide Form' : 'Log Sanity Check Item'}</span>
          </button>
        </div>

        {/* Input Form for New Sanity Check */}
        {showSanityModal && (
          <form onSubmit={handleAddSanityCheck} className="p-4 rounded-xl bg-[#14171a] border border-[#2d333b] space-y-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-sky" />
              <span>Log Period or Sentiment Aspect for Next Agent Sweep:</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-steel block mb-1">Target Period or Range:</label>
                <input
                  type="text"
                  value={scPeriod}
                  onChange={(e) => setScPeriod(e.target.value)}
                  placeholder="e.g. 2024–2025, 2024-Q3, or 2026-10"
                  className="w-full text-xs rounded bg-charcoal border border-steel/60 p-2 text-white focus:outline-none focus:border-passion"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-steel block mb-1">Sentiment Aspect / Topic:</label>
                <input
                  type="text"
                  value={scAspect}
                  onChange={(e) => setScAspect(e.target.value)}
                  placeholder="e.g. American Public Stock Rally vs Sentiment"
                  className="w-full text-xs rounded bg-charcoal border border-steel/60 p-2 text-white focus:outline-none focus:border-passion"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-steel block mb-1">Focus Audience:</label>
                  <select
                    value={scAudience}
                    onChange={(e) => setScAudience(e.target.value as any)}
                    className="w-full text-xs rounded bg-charcoal border border-steel/60 p-2 text-white focus:outline-none focus:border-passion"
                  >
                    <option value="all">All 4 Audiences</option>
                    <option value="public">American Public</option>
                    <option value="navy">Dept of the Navy</option>
                    <option value="congress">U.S. Congress</option>
                    <option value="executive">Executive Branch</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-steel block mb-1">Priority:</label>
                  <select
                    value={scPriority}
                    onChange={(e) => setScPriority(e.target.value as any)}
                    className="w-full text-xs rounded bg-charcoal border border-steel/60 p-2 text-white focus:outline-none focus:border-passion"
                  >
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-steel block mb-1">Verification Directive / Research Question:</label>
              <textarea
                value={scDirective}
                onChange={(e) => setScDirective(e.target.value)}
                placeholder="e.g. Cross-check SEC 10-Q cash flow vs. defense equity upgrades to verify whether sentiment captures the $460 ATH valuation floor..."
                rows={2}
                className="w-full text-xs rounded bg-charcoal border border-steel/60 p-2 text-white focus:outline-none focus:border-passion resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSanityModal(false)}
                className="px-3 py-1.5 rounded bg-charcoal border border-steel text-steel hover:text-white text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-passion hover:bg-passion/90 text-white font-bold text-xs transition shadow"
              >
                Queue Directive for Agent Sweep
              </button>
            </div>
          </form>
        )}

        {/* List of Sanity Checks */}
        <div className="space-y-2.5">
          {sanityChecks.map((sc) => {
            const isQueued = sc.status === 'queued';
            return (
              <div
                key={sc.id}
                className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-3 transition ${
                  isQueued
                    ? 'bg-[#16191d] border-amber-500/40'
                    : 'bg-[#16191d]/60 border-[#2d333b]'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                        isQueued
                          ? 'bg-amber-950/40 text-amber-300 border-amber-600/60 animate-pulse'
                          : 'bg-emerald-950/40 text-emerald-300 border-emerald-600/60'
                      }`}
                    >
                      {isQueued ? 'Queued for Next Sweep' : 'Verified by Research'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-charcoal border border-steel/50 text-sky">
                      Period: {sc.periodOrRange}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-charcoal border border-steel/50 text-white">
                      Audience: {sc.audience}
                    </span>
                    {sc.priority === 'high' && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-passion/20 border border-passion/50 text-passion">
                        HIGH PRIORITY
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-white">{sc.aspect}</h4>
                  <p className="text-xs text-sky/85 leading-relaxed">{sc.directive}</p>

                  {sc.findingsSummary && (
                    <div className="mt-2 p-2 rounded bg-charcoal/80 border border-emerald-800/40 text-[11px] text-emerald-200">
                      <span className="font-bold text-emerald-400">Verified Findings: </span>
                      {sc.findingsSummary}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                  {isQueued ? (
                    <button
                      type="button"
                      onClick={() =>
                        resolveSanityCheck(
                          sc.id,
                          `Sanity checked on ${new Date().toISOString().slice(0, 10)}: Corroborated against primary historical and financial disclosures.`
                        )
                      }
                      className="px-2.5 py-1 rounded bg-charcoal border border-emerald-600/60 hover:bg-emerald-950/50 text-emerald-300 text-xs font-mono transition"
                    >
                      Mark Verified
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-steel">
                      {sc.verifiedAt ? `Verified ${sc.verifiedAt.slice(0, 10)}` : 'Verified'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteSanityCheck(sc.id)}
                    className="p-1 rounded text-steel hover:text-passion hover:bg-charcoal transition"
                    title="Delete Sanity Check"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audience Query Pack Selector */}"""

text = text.replace(target_section, replacement_section)

p.write_text(text, encoding='utf-8')
print('Updated ResearchPanel.tsx with Sanity Check Manager')
