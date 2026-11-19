import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSetup,
  fetchRuns,
  previewRunCost,
  startBenchmarkRun,
  cancelBenchmarkRun,
  fetchHealth,
  fetchHardware,
  fetchActiveDataset,
} from "../api/client";
import { Tip } from "../components/Tip";
import {
  Play,
  StopCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ChevronDown,
  Database,
} from "lucide-react";

export const Benchmark: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const activeRunIdFromUrl = searchParams.get("run_id");

  const { data: setup } = useQuery({
    queryKey: ["setup"],
    queryFn: fetchSetup,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  const { data: activeDataset } = useQuery({
    queryKey: ["activeDataset"],
    queryFn: fetchActiveDataset,
  });

  const [showInvalid, setShowInvalid] = useState(false);
  const [runnerType, setRunnerType] = useState<string>("local");

  useEffect(() => {
    if (health?.local_runner) {
      setRunnerType("local");
    }
  }, [health]);

  const { data: runsList } = useQuery({
    queryKey: ["runs", showInvalid],
    queryFn: () => fetchRuns(showInvalid),
    refetchInterval: 3000,
  });

  // Presets: Quick, Balanced, Custom
  const [preset, setPreset] = useState<"quick" | "balanced" | "custom">("quick");

  // Factor choices
  const [chunkSizes, setChunkSizes] = useState<number[]>([256]);
  const [topKs, setTopKs] = useState<number[]>([3]);
  const [quantizations, setQuantizations] = useState<string[]>(["Q4_K_M"]);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [memoryLimitGb, setMemoryLimitGb] = useState<number>(4.9);
  const [hasManuallySetMemory, setHasManuallySetMemory] = useState(false);

  const { data: hwData } = useQuery({
    queryKey: ["hardware"],
    queryFn: fetchHardware,
  });

  useEffect(() => {
    if (hwData?.detected?.budget_gb && !hasManuallySetMemory) {
      setMemoryLimitGb(hwData.detected.budget_gb);
    }
  }, [hwData, hasManuallySetMemory]);

  // Preset handler
  const handlePresetChange = (newPreset: "quick" | "balanced" | "custom") => {
    setPreset(newPreset);
    if (newPreset === "quick") {
      setChunkSizes([256]);
      setTopKs([3]);
      setQuantizations(["Q4_K_M"]);
      setQuestionCount(20);
    } else if (newPreset === "balanced") {
      setChunkSizes([256, 512]);
      setTopKs([3, 5]);
      setQuantizations(["Q4_K_M", "Q8_0"]);
      setQuestionCount(50);
    }
  };

  // Live Cost Preview
  const { data: previewData, isLoading: isPreviewLoading } = useQuery({
    queryKey: [
      "preview",
      chunkSizes,
      topKs,
      quantizations,
      questionCount,
      memoryLimitGb,
      setup?.language_model,
    ],
    queryFn: () =>
      previewRunCost({
        chunk_sizes: chunkSizes,
        top_ks: topKs,
        quantizations: quantizations,
        embedding_models: [setup?.embedding_model || "sentence-transformers/all-MiniLM-L6-v2"],
        language_models: setup?.language_model ? [setup.language_model] : [],
        question_count: questionCount,
        memory_limit_gb: memoryLimitGb,
      }),
    enabled: !!setup,
  });

  // Active run state
  const [activeRunId, setActiveRunId] = useState<string | null>(activeRunIdFromUrl);
  const [liveEvents, setLiveEvents] = useState<any>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Server-Sent Events listener
  useEffect(() => {
    if (!activeRunId) return;

    setIsStreaming(true);
    const eventSource = new EventSource(`/api/runs/${activeRunId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setLiveEvents(parsed);
        if (parsed.type === "completed" || parsed.type === "cancelled" || parsed.type === "failed") {
          setIsStreaming(false);
          eventSource.close();
          queryClient.invalidateQueries({ queryKey: ["runs"] });
          queryClient.invalidateQueries({ queryKey: ["stats"] });
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [activeRunId, queryClient]);

  // Start run mutation
  const startMutation = useMutation({
    mutationFn: startBenchmarkRun,
    onSuccess: (data) => {
      setActiveRunId(data.run_id);
      setIsStreaming(true);
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
  });

  const handleStartRun = () => {
    if (!setup?.language_model) {
      return;
    }
    startMutation.mutate({
      name: `Benchmark (${preset.toUpperCase()}: ${activeDataset?.name?.split("/").pop() || "QA"})`,
      dataset_id: activeDataset?.id,
      chunk_sizes: chunkSizes,
      top_ks: topKs,
      quantizations: quantizations,
      embedding_models: [setup?.embedding_model || "BAAI/bge-small-en-v1.5"],
      language_models: [setup.language_model],
      question_count: questionCount,
      runner_type: "local",
    });
  };

  const handleCancelRun = async () => {
    if (activeRunId) {
      await cancelBenchmarkRun(activeRunId);
      setIsStreaming(false);
    }
  };

  const toggleItem = <T,>(list: T[], item: T): T[] => {
    return list.includes(item)
      ? list.length > 1
        ? list.filter((x) => x !== item)
        : list
      : [...list, item];
  };

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-16">
      {/* Page Header */}
      <div>
        <h1 className="font-serif text-[44px] font-bold text-ink leading-tight mb-2">
          Benchmark
        </h1>
        <p className="text-ink-soft text-base max-w-[70ch]">
          Execute real factorial sweeps across retrieval and generation parameters to measure accuracy against latency and memory.
        </p>
      </div>

      {/* Live Running Progress Card */}
      {(isStreaming || activeRunId || liveEvents) && (
        <div className="card-paper p-6 md:p-8 bg-paper-raised border-2 border-accent space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-2">
              {isStreaming ? (
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-sage-deep" />
              )}
              <h2 className="font-serif text-xl font-bold text-ink">
                {isStreaming ? "Benchmark in progress" : `Benchmark status: ${liveEvents?.type}`}
              </h2>
            </div>
            {isStreaming && (
              <button
                type="button"
                onClick={handleCancelRun}
                className="px-3 py-1.5 rounded text-xs font-sans font-semibold border border-accent text-accent hover:bg-accent/10 transition-colors flex items-center gap-1.5"
              >
                <StopCircle className="w-4 h-4 text-accent" />
                <span>Cancel run</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 bg-paper rounded border border-line">
              <span className="text-ink-soft block font-sans">Configuration</span>
              <span className="font-bold text-ink text-sm">
                {liveEvents?.config_index || 1} / {liveEvents?.total_configs || 1}
              </span>
            </div>
            <div className="p-3 bg-paper rounded border border-line">
              <span className="text-ink-soft block font-sans">Question</span>
              <span className="font-bold text-ink text-sm">
                {liveEvents?.question_index || 1} / {liveEvents?.total_questions || questionCount}
              </span>
            </div>
            <div className="p-3 bg-paper rounded border border-line">
              <span className="text-ink-soft block font-sans">Running accuracy (F1)</span>
              <span className="font-bold text-ink text-sm">
                {liveEvents?.running_accuracy !== undefined ? liveEvents.running_accuracy.toFixed(3) : "—"}
              </span>
            </div>
            <div className="p-3 bg-paper rounded border border-line">
              <span className="text-ink-soft block font-sans">Running latency</span>
              <span className="font-bold text-ink text-sm">
                {liveEvents?.running_latency_ms ? `${liveEvents.running_latency_ms} ms` : "—"}
              </span>
            </div>
          </div>

          {liveEvents?.current_question && (
            <p className="text-xs font-mono text-ink-soft truncate">
              Prompt: <span className="text-ink font-semibold">{liveEvents.current_question}</span>
            </p>
          )}

          {liveEvents?.error && (
            <p className="text-xs font-mono text-accent">Notice: {liveEvents.error}</p>
          )}

          {!isStreaming && (
            <div className="pt-2">
              <Link to="/results" className="text-accent text-xs font-sans font-semibold inline-flex items-center gap-1 hover:underline">
                <span>View results & Pareto frontier</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Setup required warning */}
      {!setup?.language_model && (
        <div className="card-paper p-5 bg-ochre/15 border border-ochre rounded-lg flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-ochre shrink-0" />
            <div>
              <p className="font-sans font-bold text-ink text-sm">No language model configured</p>
              <p className="font-sans text-xs text-ink-soft">
                Choose an active model on the Models page or in the setup drawer before starting a benchmark.
              </p>
            </div>
          </div>
          <Link to="/models" className="btn-primary text-xs px-4 py-2">
            Configure model →
          </Link>
        </div>
      )}

      {/* 3-Step Guided Flow */}
      <div className="space-y-6">
        {/* Active Dataset Chip */}
        <div className="p-4 bg-paper rounded-lg border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-accent shrink-0" />
            <span className="font-sans text-ink">
              Active Dataset: <strong className="font-mono">{activeDataset?.name || "Core RAG QA Benchmark"}</strong> ({activeDataset?.num_questions || 5} questions loaded in SQLite)
            </span>
          </div>
          <Link to="/models" className="text-accent hover:underline font-semibold font-sans">
            Change / Import Dataset →
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Step 1 & 2 (8 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Presets */}
          <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <span className="text-xs font-sans font-semibold text-sage-deep">Step 1</span>
                <h2 className="font-serif text-2xl font-bold text-ink">Choose benchmark scope</h2>
              </div>
            </div>

            {/* Presets buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handlePresetChange("quick")}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
                  preset === "quick"
                    ? "border-accent bg-accent/5 ring-1 ring-accent"
                    : "border-line bg-paper hover:border-accent/40"
                }`}
              >
                <div className="font-serif font-bold text-sm text-ink">Quick</div>
                <div className="text-xs text-ink-soft mt-1 font-sans">1 config · 20 questions</div>
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange("balanced")}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
                  preset === "balanced"
                    ? "border-accent bg-accent/5 ring-1 ring-accent"
                    : "border-line bg-paper hover:border-accent/40"
                }`}
              >
                <div className="font-serif font-bold text-sm text-ink">Balanced</div>
                <div className="text-xs text-ink-soft mt-1 font-sans">4 configs · 50 questions</div>
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange("custom")}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
                  preset === "custom"
                    ? "border-accent bg-accent/5 ring-1 ring-accent"
                    : "border-line bg-paper hover:border-accent/40"
                }`}
              >
                <div className="font-serif font-bold text-sm text-ink">Custom</div>
                <div className="text-xs text-ink-soft mt-1 font-sans">Factorial sweep</div>
              </button>
            </div>

            {/* Custom Factor Selectors (revealed only if preset === "custom") */}
            {preset === "custom" && (
              <div className="pt-4 border-t border-line space-y-5">
                {/* Chunk Sizes */}
                <div className="space-y-2">
                  <label className="text-xs font-sans font-semibold text-ink-soft">
                    Chunk size (<Tip term="chunk size">words</Tip>)
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[128, 256, 512, 1024].map((size) => {
                      const isSelected = chunkSizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setChunkSizes(toggleItem(chunkSizes, size))}
                          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                            isSelected
                              ? "bg-accent text-paper font-bold"
                              : "bg-paper border border-line text-ink hover:border-accent"
                          }`}
                        >
                          {size}w
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Top-K */}
                <div className="space-y-2">
                  <label className="text-xs font-sans font-semibold text-ink-soft">
                    Retrieval <Tip term="Top-K">Top-K</Tip> chunks
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 3, 5, 8, 10].map((k) => {
                      const isSelected = topKs.includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTopKs(toggleItem(topKs, k))}
                          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                            isSelected
                              ? "bg-accent text-paper font-bold"
                              : "bg-paper border border-line text-ink hover:border-accent"
                          }`}
                        >
                          K = {k}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quantization (appears only if local runner is available) */}
                {health?.local_runner && (
                  <div className="space-y-2">
                    <label className="text-xs font-sans font-semibold text-ink-soft">
                      <Tip term="Quantization">Quantization</Tip> (Local runner)
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { id: "none", label: "fp16 (Full)" },
                        { id: "Q8_0", label: "8-bit (Q8_0)" },
                        { id: "Q4_K_M", label: "4-bit (Q4_K_M)" },
                      ].map((q) => {
                        const isSelected = quantizations.includes(q.id);
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setQuantizations(toggleItem(quantizations, q.id))}
                            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                              isSelected
                                ? "bg-accent text-paper font-bold"
                                : "bg-paper border border-line text-ink hover:border-accent"
                            }`}
                          >
                            {q.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Advanced Options (collapsed by default) */}
            <details className="group pt-2 border-t border-line/60">
              <summary className="text-xs font-sans font-semibold text-ink-soft cursor-pointer hover:text-ink flex items-center justify-between py-1">
                <span>Advanced options</span>
                <ChevronDown className="w-4 h-4 text-ink-soft group-open:rotate-180 transition-transform" />
              </summary>
              <div className="pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="text-ink-soft">Question count</span>
                    <span className="font-mono font-bold text-accent">{questionCount}</span>
                  </div>
                  <input
                    type="range"
                    aria-label="Question count"
                    min={5}
                    max={100}
                    step={5}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="text-ink-soft">Hardware memory limit (GB)</span>
                    <span className="font-mono font-bold text-ink">{memoryLimitGb} GB</span>
                  </div>
                  {hwData?.detected && (
                    <p className="text-[10px] text-ink-soft font-mono">
                      Source: Auto-detected {hwData.detected.name} ({hwData.detected.budget_gb} GB budget)
                    </p>
                  )}
                  <input
                    type="range"
                    aria-label="Hardware memory limit in GB"
                    min={1.0}
                    max={16.0}
                    step={0.1}
                    value={memoryLimitGb}
                    onChange={(e) => {
                      setHasManuallySetMemory(true);
                      setMemoryLimitGb(Number(e.target.value));
                    }}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Step 2 & 3: Check Cost & Run (5 cols on lg) */}
        <div className="lg:col-span-5 card-paper p-6 md:p-8 bg-paper-raised space-y-6">
          <div className="pb-3 border-b border-line">
            <span className="text-xs font-sans font-semibold text-sage-deep">Step 2 & 3</span>
            <h2 className="font-serif text-2xl font-bold text-ink">Check cost & run</h2>
          </div>

          {isPreviewLoading ? (
            <div className="py-8 text-center text-xs font-mono text-ink-soft">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
              Checking feasibility...
            </div>
          ) : previewData ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1.5 border-b border-line">
                <span className="font-sans text-ink-soft">Configurations:</span>
                <span className="font-bold text-ink">{previewData.total_configurations}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line">
                <span className="font-sans text-ink-soft">Active dataset:</span>
                <span className="font-bold text-ink truncate max-w-[170px]">{activeDataset?.name || "Core RAG QA"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line">
                <span className="font-sans text-ink-soft">Total model calls:</span>
                <span className="font-bold text-ink">{previewData.total_model_calls || previewData.total_api_calls}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line">
                <span className="font-sans text-ink-soft">Formula:</span>
                <span className="text-[11px] text-ink-soft">{previewData.total_configurations} configs × {questionCount} Qs</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-line">
                <span className="font-sans text-ink-soft">Estimated time:</span>
                <span className="font-bold text-ink">
                  {previewData.estimated_duration_seconds != null
                    ? `~${previewData.estimated_duration_minutes} min (${previewData.estimated_duration_seconds}s)`
                    : "Unknown until the first run"}
                </span>
              </div>

              {previewData.exceeded_hardware_cap_count > 0 ? (
                <div className="p-3 bg-ochre/15 border border-ochre/40 rounded-lg text-ochre space-y-1">
                  <div className="flex items-center gap-1 font-bold font-sans">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Memory guardrail warning</span>
                  </div>
                  <p className="text-[11px] font-sans leading-relaxed">
                    {previewData.exceeded_hardware_cap_count} setup(s) exceed your {memoryLimitGb} GB cap.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-sage/20 border border-sage-deep/30 rounded-lg text-sage-deep flex items-center gap-1.5 font-sans text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>All setups fit within {memoryLimitGb} GB.</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={handleStartRun}
            disabled={startMutation.isPending || isStreaming}
            className="btn-primary w-full py-3.5 text-base justify-center text-paper font-bold focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Play className="w-4 h-4 fill-paper" />
            <span>{startMutation.isPending ? "Starting..." : "Start benchmark run"}</span>
          </button>
        </div>
      </div>
      </div>

      {/* Past Runs Section */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-line flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <h2 className="font-serif text-2xl font-bold text-ink">Past runs</h2>
            <label className="text-xs font-sans text-ink-soft flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInvalid}
                onChange={(e) => setShowInvalid(e.target.checked)}
                className="rounded accent-accent"
              />
              <span>Show invalid / contaminated runs</span>
            </label>
          </div>
          <Link to="/results" className="text-xs font-sans font-semibold text-accent hover:underline">
            View full results →
          </Link>
        </div>

        {runsList && runsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  <th className="py-2.5 px-3">Run Name</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Questions</th>
                  <th className="py-2.5 px-3">Configs</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {runsList.map((r: any) => (
                  <tr key={r.id} className="hover:bg-paper/50">
                    <td className="py-2.5 px-3 font-semibold text-ink">
                      <span>{r.name}</span>
                      {!r.is_valid && (
                        <span
                          className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-sans bg-ochre/20 text-ochre font-medium"
                          title={r.invalid_reason || "Contaminated / invalid run"}
                        >
                          Invalid
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-sans font-semibold ${
                          r.status === "completed"
                            ? "bg-sage/20 text-sage-deep"
                            : r.status === "running"
                            ? "bg-accent/15 text-accent"
                            : "bg-paper text-ink-soft"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{r.question_count}</td>
                    <td className="py-2.5 px-3">{r.configs_count}</td>
                    <td className="py-2.5 px-3">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <Link
                        to={`/results?run_id=${r.id}`}
                        className="text-accent underline font-sans font-semibold hover:opacity-80"
                      >
                        Explore
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs font-sans text-ink-soft py-4">
            No past runs recorded. Click "Start benchmark run" above to execute your first sweep.
          </p>
        )}
      </div>
    </div>
  );
};
