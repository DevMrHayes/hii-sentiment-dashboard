import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Link2,
  PlusCircle,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  ALL_AUDIENCES,
  ALL_SOURCE_TYPES,
  AUDIENCE_LABELS,
  baseBps,
  bpsToDisplay,
  centiToDisplay,
  DEFAULT_CREDIBILITY,
  normalizeWeights,
  type AudienceId,
  type AudienceImpact,
  type AudienceWeights,
  type CredibilityTier,
  type DirectionCode,
  type MagnitudeLevel,
  type PersistenceClass,
  type ScopeClass,
  type SourceType,
} from '../engine';

const PRESET_PROFILES: Array<{ label: string; weights: AudienceWeights; desc: string }> = [
  {
    label: 'Default Shipbuilding Baseline (25/25/30/20)',
    weights: { executive: 25, congress: 25, navy: 30, public: 20 },
    desc: 'Navy weighted highest (30%) as direct contracting authority, balanced Executive & Congress (25% each), Public/Market (20%).',
  },
  {
    label: 'Capitol Hill & Appropriations Focus (20/40/30/10)',
    weights: { executive: 20, congress: 40, navy: 30, public: 10 },
    desc: 'Emphasizes HASC/SASC/Appropriations markups, NDAA authorizations, and GAO/CRS oversight.',
  },
  {
    label: 'Wall Street & Public Market Focus (15/20/25/40)',
    weights: { executive: 15, congress: 20, navy: 25, public: 40 },
    desc: 'Emphasizes quarterly earnings, Free Cash Flow guidance, and peer-relative stock performance.',
  },
  {
    label: 'Equal Stakeholder Weighting (25/25/25/25)',
    weights: { executive: 25, congress: 25, navy: 25, public: 25 },
    desc: 'Unweighted arithmetic mean across all four stakeholder perspectives.',
  },
];

export const ControlPane: React.FC = () => {
  const { state, result, updateWeights, upsertEvent, resetToLatestSeed } = useDashboard();

  // Weights state
  const [draftWeights, setDraftWeights] = useState<AudienceWeights>({ ...state.settings.weights });
  const [weightAuthor, setWeightAuthor] = useState('Lead Analyst');
  const [weightReason, setWeightReason] = useState('Adjusted stakeholder composite weighting');
  const [weightSavedMsg, setWeightSavedMsg] = useState('');

  // Manual Event Builder state
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('2026-11-11');
  const [sourceType, setSourceType] = useState<SourceType>('contract_award');
  const [sourceUrl, setSourceUrl] = useState('https://www.defense.gov/News/Contracts/');
  const [summary, setSummary] = useState('');
  const [starred, setStarred] = useState(true);
  const [author, setAuthor] = useState('Lead Analyst');
  const [reason, setReason] = useState('Manual entry of verified primary source event');
  const [eventSavedMsg, setEventSavedMsg] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [attachedDoc, setAttachedDoc] = useState<{ name: string; sizeKb: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const classifyTextToDraft = (rawText: string, fallbackTitle: string) => {
    const lower = rawText.toLowerCase();
    const isNeg = /\b(delay|overrun|shortfall|strike|deficit|audit|criticism|cut|cancel|problem|slip|late|fine|loss)\b/.test(lower);
    const dir: DirectionCode = isNeg ? -1 : 1;

    const audFlags: Record<AudienceId, boolean> = {
      executive: /\b(white house|executive order|omb|pentagon|osd|administration|tariff|dpa|golden fleet)\b/.test(lower),
      congress: /\b(congress|ndaa|hasc|sasc|senate|house|gao|crs|appropriations|committee|markup)\b/.test(lower),
      navy: /\b(navy|navsea|secnav|cvn|virginia|columbia|ddg|lha|lpd|submarine|carrier|destroyer|sea trials|fleet|unmanned)\b/.test(lower),
      public: /\b(stock|nyse|earnings|dividend|fcf|revenue|eps|analyst|upgrade|downgrade|union|usw|workforce|shareholder)\b/.test(lower),
    };
    if (!Object.values(audFlags).some(Boolean)) {
      audFlags.navy = true;
      audFlags.public = true;
    }
    setEnabledAudiences(audFlags);
    setImpactConfig((prev) => ({
      executive: { ...prev.executive, direction: dir },
      congress: { ...prev.congress, direction: dir },
      navy: { ...prev.navy, direction: dir },
      public: { ...prev.public, direction: dir },
    }));
    if (!title.trim() && fallbackTitle) {
      setTitle(fallbackTitle);
    }
  };

  const handleParseArticleUrl = () => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      let detectedType: SourceType = 'news_media';
      if (host.includes('congress.gov') && parsed.pathname.includes('/bill/')) detectedType = 'legislation';
      else if (host.includes('armedservices') || host.includes('senate.gov')) detectedType = 'hearing';
      else if (host.includes('gao.gov')) detectedType = 'gao_report';
      else if (host.includes('crsreports')) detectedType = 'crs_report';
      else if (host.includes('sec.gov') || host.includes('ir.hii.com')) detectedType = 'earnings';
      else if (host.includes('defense.gov')) detectedType = 'contract_award';
      else if (host.includes('whitehouse.gov')) detectedType = 'exec_order';
      else if (host.includes('hii.com')) detectedType = 'corporate_action';

      setSourceType(detectedType);
      const defCred = DEFAULT_CREDIBILITY[detectedType];
      setImpactConfig((prev) => ({
        executive: { ...prev.executive, credibility: defCred },
        congress: { ...prev.congress, credibility: defCred },
        navy: { ...prev.navy, credibility: defCred },
        public: { ...prev.public, credibility: defCred },
      }));

      const lastSeg = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
      const cleanSlugTitle = lastSeg
        .replace(/\.aspx$|\.html$|\.pdf$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const draftTitle =
        cleanSlugTitle && cleanSlugTitle.length > 6 && !/^(default|contracts|newsroom)$/i.test(cleanSlugTitle)
          ? cleanSlugTitle
          : `External Reference (${host.replace(/^www\./, '')})`;

      classifyTextToDraft(`${host} ${cleanSlugTitle}`, draftTitle);
      if (!summary.trim()) {
        setSummary(`Verified external reference ingested from ${host}: ${trimmed}`);
      }
      setImportNotice(`Parsed article link (${host}) — auto-assigned Source Type "${detectedType}" & audience rubric.`);
      setTimeout(() => setImportNotice(''), 5000);
    } catch {
      setImportNotice('Please enter a valid https:// article URL.');
      setTimeout(() => setImportNotice(''), 3500);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    setAttachedDoc({ name: file.name, sizeKb });

    const baseTitle = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const isTextLike = /\.(txt|md|csv|json|log|html)$/i.test(file.name) || file.type.startsWith('text/');
    let excerpt = '';
    if (isTextLike) {
      try {
        const rawContent = await file.text();
        const plain = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        excerpt = plain.slice(0, 320);
        classifyTextToDraft(`${baseTitle} ${plain.slice(0, 2000)}`, baseTitle);
      } catch {
        classifyTextToDraft(baseTitle, baseTitle);
      }
    } else {
      classifyTextToDraft(baseTitle, baseTitle);
    }

    setSourceUrl(`doc://${encodeURIComponent(file.name)}`);
    setSummary((prev) =>
      excerpt
        ? `[Uploaded Document: ${file.name} (${sizeKb} KB)] ${excerpt}${excerpt.length >= 320 ? '…' : ''}`
        : `[Uploaded Document: ${file.name} (${sizeKb} KB)] Attached for stakeholder sentiment impact review.`,
    );
    setReason(`Manual document upload (${file.name})`);
    setImportNotice(`Uploaded "${file.name}" (${sizeKb} KB) and drafted rubric fields — review and click Commit.`);
    setTimeout(() => setImportNotice(''), 5500);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [enabledAudiences, setEnabledAudiences] = useState<Record<AudienceId, boolean>>({
    executive: false,
    congress: true,
    navy: true,
    public: true,
  });

  const [impactConfig, setImpactConfig] = useState<
    Record<
      AudienceId,
      {
        direction: DirectionCode;
        magnitude: MagnitudeLevel;
        credibility: CredibilityTier;
        scope: ScopeClass;
        persistence: PersistenceClass;
      }
    >
  >({
    executive: { direction: 1, magnitude: 2, credibility: 4, scope: 'industry', persistence: 'year' },
    congress: { direction: 1, magnitude: 3, credibility: 3, scope: 'program', persistence: 'year' },
    navy: { direction: 1, magnitude: 4, credibility: 4, scope: 'program', persistence: 'structural' },
    public: { direction: 1, magnitude: 2, credibility: 3, scope: 'company', persistence: 'quarter' },
  });

  const weightSum =
    draftWeights.executive + draftWeights.congress + draftWeights.navy + draftWeights.public;

  const handleSaveWeights = async () => {
    const normalized = weightSum === 100 ? draftWeights : normalizeWeights(draftWeights);
    setDraftWeights(normalized);
    await updateWeights(normalized, weightAuthor, weightReason);
    setWeightSavedMsg('Composite weights updated and entire 2011–2026 trajectory recomputed.');
    setTimeout(() => setWeightSavedMsg(''), 4000);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const impacts: AudienceImpact[] = ALL_AUDIENCES.filter((a) => enabledAudiences[a]).map(
      (a) => ({
        audience: a,
        ...impactConfig[a],
      }),
    );
    if (impacts.length === 0) return;

    const revs = await upsertEvent(
      {
        title: title.trim(),
        eventDate,
        sourceType,
        sourceUrls: sourceUrl.trim() ? [sourceUrl.trim()] : [],
        summary: summary.trim() || title.trim(),
        impacts,
        starred,
      },
      author,
      reason,
    );

    setTitle('');
    setSummary('');
    setAttachedDoc(null);
    setEventSavedMsg(
      `Event committed to ledger (${revs.length} period/audience score revision(s) recorded).`,
    );
    setTimeout(() => setEventSavedMsg(''), 5000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Audience Composite Weight Studio */}
      <div className="bg-[#1e2227] border border-[#363c44] rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-steel/50 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-passion" />
              <span>COMPOSITE SCORE WEIGHTING CONTROL PANE</span>
            </h2>
            <p className="text-xs text-sky/80 mt-0.5">
              Integer percentage weights summing to 100%. Adjusting weights deterministically recomputes the composite line across all historical and forecast periods.
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded font-mono text-xs font-bold ${
              weightSum === 100
                ? 'bg-changingsea/30 text-sky border border-changingsea'
                : 'bg-passion text-white'
            }`}
          >
            Total: {weightSum}%
          </span>
        </div>

        {/* Sliders */}
        <div className="space-y-3">
          {ALL_AUDIENCES.map((aud) => (
            <div key={aud} className="bg-charcoal/80 border border-steel/50 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-white">{AUDIENCE_LABELS[aud]}</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-sky">
                    Current Score: {centiToDisplay(result.latest[aud].scoreCenti)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draftWeights[aud]}
                    onChange={(e) =>
                      setDraftWeights((prev) => ({
                        ...prev,
                        [aud]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-16 bg-deepsea border border-steel rounded px-2 py-0.5 text-right text-white font-bold"
                  />
                  <span className="text-white">%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={draftWeights[aud]}
                onChange={(e) =>
                  setDraftWeights((prev) => ({ ...prev, [aud]: Number(e.target.value) }))
                }
                className="w-full accent-passion cursor-pointer"
              />
            </div>
          ))}
        </div>

        {/* Preset Weight Profiles */}
        <div>
          <span className="text-xs font-mono uppercase text-sky block mb-1.5">
            Preset Stakeholder Weight Profiles:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_PROFILES.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDraftWeights({ ...p.weights })}
                className="text-left p-2.5 rounded bg-charcoal/70 border border-steel/50 hover:border-sky transition"
              >
                <div className="text-xs font-semibold text-white">{p.label}</div>
                <div className="text-[11px] text-sky/80 mt-0.5 line-clamp-2">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Audit fields & Save */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-steel/40 text-xs">
          <div>
            <label className="text-sky block mb-1">Author:</label>
            <input
              type="text"
              value={weightAuthor}
              onChange={(e) => setWeightAuthor(e.target.value)}
              className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="text-sky block mb-1">Audit Reason:</label>
            <input
              type="text"
              value={weightReason}
              onChange={(e) => setWeightReason(e.target.value)}
              className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDraftWeights(normalizeWeights(draftWeights))}
            className="px-3 py-2 rounded bg-charcoal border border-steel hover:border-sky text-xs font-mono text-sky flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Auto-Normalize to 100%</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSaveWeights()}
            className="px-4 py-2 rounded bg-passion hover:bg-passion/90 text-xs font-bold text-white shadow-lg transition"
          >
            Apply & Persist Composite Weights
          </button>
        </div>

        {weightSavedMsg && (
          <div className="p-2.5 rounded bg-changingsea/25 border border-changingsea text-xs text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
            <span>{weightSavedMsg}</span>
          </div>
        )}

        {/* Ledger State Cache Synchronization */}
        <div className="pt-3 border-t border-steel/40 flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold text-white block">Deep Research Ledger Cache</span>
            <span className="text-sky/80 text-[11px]">
              Active in memory: {state.events.length} historical events (2011–2026)
            </span>
          </div>
          <button
            type="button"
            onClick={resetToLatestSeed}
            className="px-3 py-1.5 rounded bg-charcoal border border-steel hover:border-sky text-sky hover:text-white flex items-center gap-1.5 text-xs font-mono transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-changingsea" />
            <span>Reset Cache to Seed ({state.events.length} Events)</span>
          </button>
        </div>
      </div>

      {/* Right Column: Manual Evidence & Rubric Entry Studio */}
      <form
        onSubmit={(e) => void handleAddEvent(e)}
        className="bg-[#1e2227] border border-[#363c44] rounded-xl p-5 shadow-xl space-y-4"
      >
        <div className="border-b border-steel/50 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-passion" />
            <span>ADD MANUAL EVIDENCE · ARTICLE URL OR DOCUMENT UPLOAD</span>
          </h2>
          <p className="text-xs text-sky/80 mt-0.5">
            Paste an article link or upload a briefing/report (.pdf, .txt, .md, .docx, .csv) to classify its stakeholder impact and commit it deterministically to the ledger.
          </p>
        </div>

        {/* Quick Import: Article Link Parser + Document Upload */}
        <div className="bg-charcoal/90 border border-sky/40 rounded-lg p-3 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono font-bold text-sky uppercase text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-passion" />
              <span>Quick Source Ingest (Article Link or Document)</span>
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.json,.pdf,.doc,.docx"
              onChange={(e) => void handleDocumentUpload(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1e2227] border border-passion/70 hover:bg-passion hover:text-white text-white font-semibold transition"
            >
              <Upload className="w-3.5 h-3.5 text-passion group-hover:text-white" />
              <span>Upload Document</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Link2 className="w-3.5 h-3.5 text-sky absolute left-2.5 top-2" />
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Paste article URL (https://...) or doc:// reference"
                className="w-full pl-8 pr-2.5 py-1.5 bg-[#16191d] border border-steel rounded text-white font-mono text-xs focus:outline-none focus:border-passion"
              />
            </div>
            <button
              type="button"
              onClick={handleParseArticleUrl}
              className="px-3 py-1.5 rounded bg-deepsea border border-sky/60 hover:border-passion text-white font-semibold whitespace-nowrap transition"
            >
              Parse Link
            </button>
          </div>

          {attachedDoc && (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-changingsea/20 border border-changingsea/60 text-white">
              <span className="flex items-center gap-1.5 font-mono text-[11px] truncate">
                <FileText className="w-3.5 h-3.5 text-sky shrink-0" />
                <span>Attached Document: <strong>{attachedDoc.name}</strong> ({attachedDoc.sizeKb} KB)</span>
              </span>
              <button
                type="button"
                onClick={() => setAttachedDoc(null)}
                className="p-0.5 text-steel hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {importNotice && (
            <p className="text-[11px] text-changingsea font-mono">{importNotice}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="sm:col-span-2">
            <label className="text-sky block mb-1">Event Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Navy Awards Newport News CVN-82 Advanced Procurement Contract"
              className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white"
            />
          </div>
          <div>
            <label className="text-sky block mb-1">Event Date (UTC) *</label>
            <input
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-sky block mb-1">Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => {
                const st = e.target.value as SourceType;
                setSourceType(st);
                const defCred = DEFAULT_CREDIBILITY[st];
                setImpactConfig((prev) => ({
                  executive: { ...prev.executive, credibility: defCred },
                  congress: { ...prev.congress, credibility: defCred },
                  navy: { ...prev.navy, credibility: defCred },
                  public: { ...prev.public, credibility: defCred },
                }));
              }}
              className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white"
            >
              {ALL_SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sky block mb-1">Primary Source Reference</label>
            <input
              type="text"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white font-mono"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="inline-flex items-center gap-2 cursor-pointer text-white font-medium">
              <input
                type="checkbox"
                checked={starred}
                onChange={(e) => setStarred(e.target.checked)}
                className="accent-passion w-4 h-4"
              />
              <span>★ Highlight as Starred Key Event</span>
            </label>
          </div>
        </div>

        <div className="text-xs">
          <label className="text-sky block mb-1">Factual Summary & Attribution Context</label>
          <textarea
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe the statutory, contractual, or market impact on HII..."
            className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white"
          />
        </div>

        {/* Per-Audience Rubric Matrix */}
        <div className="space-y-2">
          <span className="text-xs font-mono uppercase text-sky block">
            Discrete Audience Rubric Classifications (Deterministic Base Points Preview):
          </span>
          {ALL_AUDIENCES.map((aud) => {
            const on = enabledAudiences[aud];
            const cfg = impactConfig[aud];
            const previewBps = on ? baseBps({ audience: aud, ...cfg }) : 0;
            return (
              <div
                key={aud}
                className={`p-2.5 rounded-lg border text-xs ${
                  on ? 'bg-charcoal border-sky/60' : 'bg-charcoal/40 border-steel/30 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 font-bold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        setEnabledAudiences((prev) => ({ ...prev, [aud]: e.target.checked }))
                      }
                      className="accent-passion"
                    />
                    <span>{AUDIENCE_LABELS[aud]}</span>
                  </label>
                  {on && (
                    <span className="font-mono text-passion font-bold">
                      Base Impulse: {bpsToDisplay(previewBps)} raw pts
                    </span>
                  )}
                </div>

                {on && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 font-mono text-[11px]">
                    <select
                      value={cfg.direction}
                      onChange={(e) =>
                        setImpactConfig((prev) => ({
                          ...prev,
                          [aud]: { ...prev[aud], direction: Number(e.target.value) as DirectionCode },
                        }))
                      }
                      className="bg-deepsea border border-steel rounded px-1.5 py-1 text-white"
                    >
                      <option value={1}>+1 Positive</option>
                      <option value={0}>0 Neutral</option>
                      <option value={-1}>-1 Negative</option>
                    </select>

                    <select
                      value={cfg.magnitude}
                      onChange={(e) =>
                        setImpactConfig((prev) => ({
                          ...prev,
                          [aud]: { ...prev[aud], magnitude: Number(e.target.value) as MagnitudeLevel },
                        }))
                      }
                      className="bg-deepsea border border-steel rounded px-1.5 py-1 text-white"
                    >
                      <option value={1}>Mag 1 (Minor)</option>
                      <option value={2}>Mag 2 (Moderate)</option>
                      <option value={3}>Mag 3 (Material)</option>
                      <option value={4}>Mag 4 (Major)</option>
                      <option value={5}>Mag 5 (Watershed)</option>
                    </select>

                    <select
                      value={cfg.credibility}
                      onChange={(e) =>
                        setImpactConfig((prev) => ({
                          ...prev,
                          [aud]: {
                            ...prev[aud],
                            credibility: Number(e.target.value) as CredibilityTier,
                          },
                        }))
                      }
                      className="bg-deepsea border border-steel rounded px-1.5 py-1 text-white"
                    >
                      <option value={4}>Cred T4 (1.00x)</option>
                      <option value={3}>Cred T3 (0.85x)</option>
                      <option value={2}>Cred T2 (0.65x)</option>
                      <option value={1}>Cred T1 (0.40x)</option>
                    </select>

                    <select
                      value={cfg.scope}
                      onChange={(e) =>
                        setImpactConfig((prev) => ({
                          ...prev,
                          [aud]: { ...prev[aud], scope: e.target.value as ScopeClass },
                        }))
                      }
                      className="bg-deepsea border border-steel rounded px-1.5 py-1 text-white"
                    >
                      <option value="program">Scope: Program</option>
                      <option value="company">Scope: Company</option>
                      <option value="industry">Scope: Industry</option>
                      <option value="macro">Scope: Macro</option>
                    </select>

                    <select
                      value={cfg.persistence}
                      onChange={(e) =>
                        setImpactConfig((prev) => ({
                          ...prev,
                          [aud]: { ...prev[aud], persistence: e.target.value as PersistenceClass },
                        }))
                      }
                      className="bg-deepsea border border-steel rounded px-1.5 py-1 text-white"
                    >
                      <option value="transient">Transient (Half-life 35d)</option>
                      <option value="quarter">Quarter (Half-life 90d)</option>
                      <option value="year">Annual (Half-life 180d)</option>
                      <option value="structural">Structural (Half-life 420d)</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author"
            className="bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Audit reason"
            className="bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 rounded bg-passion hover:bg-passion/90 text-xs font-bold text-white shadow-lg transition"
        >
          Commit Event to Evidence Ledger & Recompute Scores
        </button>

        {eventSavedMsg && (
          <div className="p-2.5 rounded bg-changingsea/25 border border-changingsea text-xs text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky shrink-0" />
            <span>{eventSavedMsg}</span>
          </div>
        )}
      </form>
    </div>
  );
};
