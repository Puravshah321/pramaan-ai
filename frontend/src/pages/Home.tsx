import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSetup,
  fetchSetupSuggestions,
  fetchHealth,
  recheckHealth,
  updateSetup,
  fetchStats,
  fetchLatestShowcase,
  fetchResults,
  fetchRuns,
  type ShowcaseData,
} from "../api/client";
import { ModelPicker } from "../components/ModelPicker";
import { ReliabilityBadge } from "../components/ReliabilityBadge";
import {
  X,
  ArrowRight,
  FileText,
  Gauge,
  BarChart2,
  ShieldCheck,
  CheckCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface HomeProps {
  onStartTour?: () => void;
}

export const Home: React.FC<HomeProps> = ({ onStartTour }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Queries
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  const { data: setup } = useQuery({
    queryKey: ["setup"],
    queryFn: fetchSetup,
  });

  const { data: suggestions } = useQuery({
    queryKey: ["setupSuggestions"],
    queryFn: fetchSetupSuggestions,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });

  const { data: showcase } = useQuery({
    queryKey: ["showcaseLatest"],
    queryFn: fetchLatestShowcase,
  });

  const { data: pastRuns } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns(false),
  });

  const latestRunId = pastRuns?.find((r: any) => r.status === "completed")?.id;
  const { data: runResults } = useQuery({
    queryKey: ["latestResults", latestRunId],
    queryFn: () => fetchResults(latestRunId, false),
    enabled: !!latestRunId,
  });

  // Setup Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeEmbedding, setActiveEmbedding] = useState(
    setup?.embedding_model || "sentence-transformers/all-MiniLM-L6-v2"
  );
  const [activeLanguage, setActiveLanguage] = useState(
    setup?.language_model || "Qwen/Qwen2.5-0.5B-Instruct"
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (setup) {
      if (setup.embedding_model) setActiveEmbedding(setup.embedding_model);
      if (setup.language_model) setActiveLanguage(setup.language_model);
      else setActiveLanguage("Qwen/Qwen2.5-0.5B-Instruct");
    }
  }, [setup]);

  const updateMutation = useMutation({
    mutationFn: updateSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup"] });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setDrawerOpen(false);
      }, 1200);
    },
  });

  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem("hf_banner_dismissed") === "true"
  );
  const [isRechecking, setIsRechecking] = useState(false);

  const handleRecheck = async () => {
    setIsRechecking(true);
    try {
      await recheckHealth();
      await queryClient.invalidateQueries({ queryKey: ["health"] });
    } catch (e) {
      console.error("Recheck connection failed:", e);
    } finally {
      setIsRechecking(false);
    }
  };

  const handleDismissBanner = () => {
    sessionStorage.setItem("hf_banner_dismissed", "true");
    setBannerDismissed(true);
  };

  const handleSaveSetup = () => {
    updateMutation.mutate({
      embedding_model: activeEmbedding,
      language_model: activeLanguage,
    });
  };

  return (
    <div className="w-full bg-paper page-transition">
      {/* Token capability warning if present (dismissible & recheckable) */}
      {!bannerDismissed && health?.huggingface?.token_message && (
        <div className="w-full bg-ochre/15 border-b border-ochre px-4 py-3 text-ink text-xs md:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            <span className="w-2.5 h-2.5 rounded-full bg-ochre shrink-0 animate-pulse" />
            <span className="font-sans font-medium text-xs break-words">{health.huggingface.token_message}</span>
          </div>
          <div className="flex items-center gap-2.5 font-mono text-xs font-semibold flex-wrap">
            <button
              type="button"
              onClick={handleRecheck}
              disabled={isRechecking}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-paper border border-ochre/40 rounded text-ink hover:border-ink transition-colors disabled:opacity-50"
            >
              {isRechecking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-ink-soft" />
              )}
              <span>{isRechecking ? "Checking..." : "Re-check connection"}</span>
            </button>
            {health.huggingface.billing_url && (
              <a
                href={health.huggingface.billing_url}
                target="_blank"
                rel="noreferrer"
                className="underline text-accent hover:opacity-80"
              >
                Billing / Credits ↗
              </a>
            )}
            <a
              href={health.huggingface.tokens_url || "https://huggingface.co/settings/tokens"}
              target="_blank"
              rel="noreferrer"
              className="underline text-ink hover:text-accent"
            >
              Tokens ↗
            </a>
            <button
              type="button"
              onClick={handleDismissBanner}
              className="p-1 text-ink-soft hover:text-ink transition-colors ml-1"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. HERO: Full-width black band, content-fit min-height 560px */}
      <section className="w-full bg-[#141210] text-paper min-h-[560px] flex items-center py-10 md:py-14 border-b border-[#201D1A]">
        <div className="max-w-[1160px] mx-auto px-4 w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-6">
            <h1
              className="font-serif font-semibold text-paper leading-[1.04] tracking-[-0.02em]"
              style={{ fontSize: "clamp(44px, 5.5vw, 76px)" }}
            >
              Know which answers to <span className="text-accent">trust</span>, and what they cost.
            </h1>

            <p className="text-sage text-lg md:text-xl font-sans max-w-[56ch] leading-relaxed">
              Benchmark any Hugging Face model on your own documents, then see how reliable each answer is.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/try-it"
                className="btn-primary px-6 py-3 text-base text-paper font-bold focus-visible:outline-2 focus-visible:outline-accent"
              >
                Try it with your document
              </Link>
              <Link
                to="/benchmark"
                className="px-6 py-3 text-base font-semibold border-2 border-sage text-sage rounded-lg hover:bg-sage/10 transition-colors inline-flex items-center justify-center min-h-[44px] focus-visible:outline-2 focus-visible:outline-accent"
              >
                Run a benchmark
              </Link>
            </div>

            {/* Active Setup line */}
            <div className="pt-4 text-xs font-sans text-sage/80 flex items-center gap-2 flex-wrap">
              {setup?.language_model ? (
                <>
                  <span>
                    Using <span className="font-mono text-paper">{setup.embedding_model || "sentence-transformers/all-MiniLM-L6-v2"}</span> and{" "}
                    <span className="font-mono text-paper">{setup.language_model}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="text-accent underline font-semibold hover:text-accent/80 transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </>
              ) : (
                <>
                  <span className="text-ochre flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
                    No model configured yet
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="text-accent underline font-semibold hover:text-accent/80 transition-colors cursor-pointer ml-1"
                  >
                    Configure setup
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Live Evidence Card (5 cols on lg) */}
          <div className="lg:col-span-5 w-full">
            <LiveEvidenceCard showcase={showcase} />
          </div>
        </div>
      </section>

      {/* 3. LIVE NUMBERS STRIP */}
      <LiveNumbersStrip stats={stats} />

      {/* 4. THE PROBLEM (editorial rows, not cards) */}
      <section className="w-full border-b border-line py-16 md:py-24">
        <div className="max-w-[1160px] mx-auto px-4 space-y-12">
          <div className="border-b border-line pb-4">
            <span className="text-sm font-sans text-sage-deep font-semibold">The problem</span>
          </div>

          <div className="divide-y divide-line">
            {/* Row 01 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-10 items-baseline">
              <span className="md:col-span-2 font-serif text-4xl md:text-5xl font-bold text-accent">
                01
              </span>
              <h2 className="md:col-span-5 font-serif text-2xl md:text-3xl font-semibold text-ink leading-tight">
                Better answers cost more.
              </h2>
              <p className="md:col-span-5 text-ink-soft text-base leading-relaxed">
                Bigger models and more context raise latency and memory. Without empirical data, teams overpay in hardware or hit timeouts.
              </p>
            </div>

            {/* Row 02 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-10 items-baseline">
              <span className="md:col-span-2 font-serif text-4xl md:text-5xl font-bold text-accent">
                02
              </span>
              <h2 className="md:col-span-5 font-serif text-2xl md:text-3xl font-semibold text-ink leading-tight">
                Confident does not mean correct.
              </h2>
              <p className="md:col-span-5 text-ink-soft text-base leading-relaxed">
                Language models can sound sure while being wrong. An automatic reliability checker tests the grounding of every response.
              </p>
            </div>

            {/* Row 03 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-10 items-baseline">
              <span className="md:col-span-2 font-serif text-4xl md:text-5xl font-bold text-accent">
                03
              </span>
              <h2 className="md:col-span-5 font-serif text-2xl md:text-3xl font-semibold text-ink leading-tight">
                Settings are guesswork.
              </h2>
              <p className="md:col-span-5 text-ink-soft text-base leading-relaxed">
                Most teams pick chunk size, Top-K and model size by feel. Pramaan AI measures the Pareto frontier across real factors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS (Horizontal desktop, vertical mobile) */}
      <section className="w-full border-b border-line py-16 md:py-24 bg-paper">
        <div className="max-w-[1160px] mx-auto px-4 space-y-12">
          <div className="border-b border-line pb-4">
            <span className="text-sm font-sans text-sage-deep font-semibold">How it works</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full border border-ink flex items-center justify-center font-mono text-sm font-bold bg-accent text-paper-raised">
                  1
                </span>
                <FileText className="w-5 h-5 text-sage-deep" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink">Pick</h3>
              <p className="text-ink-soft text-sm leading-relaxed">
                Select any open embedding and language model pair from the Hugging Face Hub.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full border border-ink flex items-center justify-center font-mono text-sm font-bold bg-accent text-paper-raised">
                  2
                </span>
                <Gauge className="w-5 h-5 text-sage-deep" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink">Measure</h3>
              <p className="text-ink-soft text-sm leading-relaxed">
                Execute empirical evaluation on your hardware or through Hugging Face hosted inference APIs.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full border border-ink flex items-center justify-center font-mono text-sm font-bold bg-accent text-paper-raised">
                  3
                </span>
                <BarChart2 className="w-5 h-5 text-sage-deep" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink">Compare</h3>
              <p className="text-ink-soft text-sm leading-relaxed">
                Evaluate accuracy, latency percentiles, and memory budgets across chunk sizes and Top-K values.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full border border-ink flex items-center justify-center font-mono text-sm font-bold bg-accent text-paper-raised">
                  4
                </span>
                <ShieldCheck className="w-5 h-5 text-sage-deep" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink">Trust</h3>
              <p className="text-ink-soft text-sm leading-relaxed">
                Inspect verified reliability scores and clear diagnostic signals for every single generated answer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LATEST RESULT TEASER (paper-raised band) */}
      <LatestResultTeaser runResults={runResults} latestRunId={latestRunId} />

      {/* 7. FINAL CALL TO ACTION (sage band) */}
      <section className="w-full bg-sage py-16 md:py-24 text-center">
        <div className="max-w-[720px] mx-auto px-4 space-y-6">
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-ink leading-tight">
            Start with one document.
          </h2>
          <div>
            <Link
              to="/try-it"
              className="btn-primary text-base px-8 py-3.5 shadow-xs focus-visible:outline-2 focus-visible:outline-accent"
            >
              Try it now
            </Link>
          </div>
        </div>
      </section>

      {/* Right-side Active Setup Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#141210]/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-full max-w-md bg-paper-raised h-full shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto z-10 border-l border-line">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-ink">Change Active Setup</h3>
                  <p className="text-xs text-ink-soft mt-1">
                    Select models from Hugging Face Hub to drive benchmarks and queries.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 text-ink-soft hover:text-ink rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-sage/20 border border-sage-deep/30 rounded-lg text-xs font-mono text-sage-deep flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Setup updated successfully!</span>
                </div>
              )}

              <div className="space-y-6">
                <ModelPicker
                  label="Embedding Model"
                  task="embedding"
                  value={activeEmbedding}
                  onChange={(id) => setActiveEmbedding(id)}
                />
                <ModelPicker
                  label="Language Model"
                  task="generation"
                  value={activeLanguage}
                  onChange={(id) => setActiveLanguage(id)}
                />

                {/* Suggestions for local models */}
                {suggestions?.local_instruct && suggestions.local_instruct.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold font-mono text-ink-soft mb-2">
                      Suggested edge models (local runner runnable):
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {suggestions.local_instruct.map((m: any) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setActiveLanguage(m.id)}
                          className={`text-left p-2 rounded border text-xs font-mono transition-colors flex items-center justify-between ${
                            activeLanguage === m.id
                              ? "bg-accent/10 border-accent text-accent font-bold"
                              : "bg-paper border-line text-ink hover:border-accent"
                          }`}
                        >
                          <span className="truncate">{m.id}</span>
                          <span className="text-[10px] text-sage-deep font-sans shrink-0 ml-2">{m.badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-line flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 text-sm text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSetup}
                disabled={updateMutation.isPending}
                className="btn-primary text-sm px-5"
              >
                {updateMutation.isPending ? "Saving..." : "Save as Active Setup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Live Evidence Card Component with animated sweep and typing effect */
const LiveEvidenceCard: React.FC<{ showcase?: ShowcaseData }> = ({ showcase }) => {
  const [typedAnswer, setTypedAnswer] = useState("");
  const [highlightActive, setHighlightActive] = useState(false);

  useEffect(() => {
    if (!showcase?.has_data || !showcase.answer) return;

    // Trigger highlight sweep
    const highlightTimer = setTimeout(() => {
      setHighlightActive(true);
    }, 150);

    // Typewriter effect for answer after 400ms highlight
    const fullText = showcase.answer;
    let currentIdx = 0;
    setTypedAnswer("");

    const typingTimer = setTimeout(() => {
      const interval = setInterval(() => {
        currentIdx += 2;
        if (currentIdx >= fullText.length) {
          setTypedAnswer(fullText);
          clearInterval(interval);
        } else {
          setTypedAnswer(fullText.slice(0, currentIdx));
        }
      }, 16);
      return () => clearInterval(interval);
    }, 450);

    return () => {
      clearTimeout(highlightTimer);
      clearTimeout(typingTimer);
    };
  }, [showcase]);

  if (!showcase?.has_data) {
    return (
      <div className="w-full border-2 border-dashed border-line/40 rounded-xl p-8 bg-[#201D1A]/80 text-center space-y-4">
        <span className="text-sm font-sans text-sage block">
          Your first answer will appear here
        </span>
        <p className="text-xs text-sage/60 max-w-xs mx-auto">
          Ask a question in Try It to see live grounding, match scores, and the automatic reliability check.
        </p>
        <Link to="/try-it" className="btn-primary text-xs inline-flex px-4 py-2">
          Ask your first question
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="card-paper p-6 bg-paper-raised text-ink border border-line shadow-xs space-y-4">
        {/* Document header */}
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <span className="text-xs font-mono font-bold text-ink-soft truncate">
            {showcase.document_title || "Verified Document"}
          </span>
          {showcase.badge && (
            <ReliabilityBadge status={showcase.badge} confidence={showcase.confidence} />
          )}
        </div>

        {/* Excerpt with Highlight Sweep */}
        <div className="p-3 bg-paper rounded border border-line text-xs font-mono leading-relaxed text-ink-soft">
          <span
            className={`transition-colors duration-400 rounded px-1 ${
              highlightActive ? "bg-sage/40 text-ink font-medium" : "bg-transparent"
            }`}
          >
            {showcase.highlight_span || showcase.excerpt?.slice(0, 140)}
          </span>
          <span> {showcase.excerpt?.slice(140, 280)}...</span>
        </div>

        {/* Arrow divider */}
        <div className="flex items-center justify-center text-sage-deep">
          <ArrowRight className="w-4 h-4 rotate-90" />
        </div>

        {/* Question & Answer */}
        <div className="space-y-2">
          <div className="text-xs font-mono text-ink">
            <span className="text-accent font-bold">Q: </span>
            <span>{showcase.question}</span>
          </div>

          <div className="p-3 bg-paper rounded-lg border border-line text-xs font-mono text-ink leading-relaxed">
            <span className="text-sage-deep font-bold">A: </span>
            <span>{typedAnswer || showcase.answer}</span>
          </div>
        </div>

        {/* Reasons */}
        {showcase.reasons && showcase.reasons.length > 0 && (
          <div className="pt-2 border-t border-line/60">
            <ul className="text-[11px] font-sans text-ink-soft space-y-0.5 list-disc list-inside">
              {showcase.reasons.slice(0, 2).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Caption under card */}
      <div className="text-right text-[11px] font-mono text-sage/70">
        Answered by {showcase.setup_used || "model"} locally
      </div>
    </div>
  );
};

/** Live Numbers Strip with 600ms count-up */
const LiveNumbersStrip: React.FC<{ stats?: any }> = ({ stats }) => {
  const [counts, setCounts] = useState({ docs: 0, questions: 0, setups: 0, calls: 0 });

  const targetDocs = stats?.documents_indexed ?? 0;
  const targetQuestions = stats?.questions_answered ?? 0;
  const targetSetups = stats?.setups_measured ?? 0;
  const targetCalls = stats?.api_calls_made ?? 0;

  useEffect(() => {
    if (!stats) return;

    const duration = 600;
    const startTime = performance.now();

    const frame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setCounts({
        docs: Math.round(progress * targetDocs),
        questions: Math.round(progress * targetQuestions),
        setups: Math.round(progress * targetSetups),
        calls: Math.round(progress * targetCalls),
      });

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    requestAnimationFrame(frame);
  }, [stats, targetDocs, targetQuestions, targetSetups, targetCalls]);

  const isEmpty =
    stats?.empty ||
    (targetDocs === 0 && targetQuestions === 0 && targetSetups === 0 && targetCalls === 0);

  if (isEmpty) {
    return (
      <div className="w-full bg-paper py-8 border-b border-line text-center">
        <div className="max-w-[1160px] mx-auto px-4 text-ink-soft text-sm font-sans">
          Nothing measured yet in this workspace. Start by asking your first question in{" "}
          <Link to="/try-it" className="text-accent underline font-semibold">
            Try It →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full bg-paper py-12 md:py-16 border-b border-line">
      <div className="max-w-[1160px] mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
          {/* Docs */}
          <div className="space-y-1">
            <span className="font-serif font-bold text-ink text-[44px] md:text-[56px] leading-none block">
              {counts.docs}
            </span>
            <span className="text-sm font-sans text-ink-soft block">
              documents indexed
            </span>
          </div>

          {/* Questions */}
          <div className="space-y-1">
            <span className="font-serif font-bold text-ink text-[44px] md:text-[56px] leading-none block">
              {counts.questions}
            </span>
            <span className="text-sm font-sans text-ink-soft block">
              questions answered
            </span>
          </div>

          {/* Setups */}
          <div className="space-y-1">
            <span className="font-serif font-bold text-ink text-[44px] md:text-[56px] leading-none block">
              {counts.setups}
            </span>
            <span className="text-sm font-sans text-ink-soft block">
              setups measured
            </span>
          </div>

          {/* Calls */}
          <div className="space-y-1">
            <span className="font-serif font-bold text-ink text-[44px] md:text-[56px] leading-none block">
              {counts.calls}
            </span>
            <span className="text-sm font-sans text-ink-soft block">
              API calls made
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

/** Latest Result Teaser: scatter plot or outline empty state */
const LatestResultTeaser: React.FC<{ runResults?: any[]; latestRunId?: string }> = ({
  runResults,
  latestRunId,
}) => {
  if (!runResults || runResults.length === 0) {
    return (
      <section className="w-full bg-paper-raised py-16 md:py-20 border-b border-line">
        <div className="max-w-[1160px] mx-auto px-4">
          <div className="border border-dashed border-line rounded-xl p-8 md:p-12 text-center max-w-xl mx-auto space-y-4">
            <h3 className="font-serif text-2xl font-bold text-ink">No benchmark runs recorded</h3>
            <p className="text-sm font-sans text-ink-soft">
              Run your first factorial sweep to measure accuracy against latency and memory.
            </p>
            <Link to="/benchmark" className="btn-primary text-sm inline-flex">
              Run a benchmark
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Find best configuration (highest F1)
  const sorted = [...runResults].sort((a, b) => (b.f1 || 0) - (a.f1 || 0));
  const best = sorted[0];

  const scatterData = runResults.map((r) => ({
    latency: r.latency_p50 || 0,
    f1: r.f1 || 0,
    name: `${r.language_model} (k=${r.top_k}, ${r.chunk_size}w)`,
    isBest: r.id === best?.id,
  }));

  return (
    <section className="w-full bg-paper-raised py-16 md:py-20 border-b border-line">
      <div className="max-w-[1160px] mx-auto px-4 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <span className="text-sm font-sans text-sage-deep font-semibold">Latest result</span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink mt-1">
              Best setup in your last run: <span className="text-accent">{best?.language_model}</span>
            </h2>
            <p className="text-sm font-sans text-ink-soft mt-1">
              Achieved F1 {best?.f1?.toFixed(3)} at {best?.latency_p50?.toFixed(2)}s median latency (n={best?.n || 0}).
            </p>
          </div>
          <Link
            to="/results"
            className="text-sm font-sans font-semibold text-accent hover:underline flex items-center gap-1 shrink-0"
          >
            <span>See all results</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Small real scatter */}
        <div className="h-64 w-full bg-paper rounded-xl border border-line p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <XAxis
                type="number"
                dataKey="latency"
                name="Latency (s)"
                unit="s"
                stroke="#5E574C"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="f1"
                name="Token F1"
                domain={[0, 1]}
                stroke="#5E574C"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-paper-raised p-2 rounded border border-line text-xs font-mono text-ink shadow-md">
                      <p className="font-bold">{d.name}</p>
                      <p>F1: {d.f1?.toFixed(3)}</p>
                      <p>Latency: {d.latency}s</p>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isBest ? "#EA2E00" : "#9DBDB8"}
                    r={entry.isBest ? 7 : 5}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
