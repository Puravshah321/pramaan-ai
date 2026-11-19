import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchResults,
  fetchFactorEffects,
  fetchReliabilitySummary,
  trainReliabilityChecker,
} from "../api/client";
import { MetricValue } from "../components/MetricValue";
import { EmptyState } from "../components/EmptyState";
import {
  Table,
  BarChart2,
  ShieldCheck,
  ArrowUpDown,
  Sparkles,
  Loader2,
  Filter,
  CheckCircle2,
  Layers,
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

export const Results: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get("run_id") || undefined;

  const [activeTab, setActiveTab] = useState<"table" | "effects" | "reliability">("table");
  const [showInvalid, setShowInvalid] = useState(false);
  const [groupRepeats, setGroupRepeats] = useState(true);
  const [selectedDatasetFilter, setSelectedDatasetFilter] = useState<string>("all");

  // Fetch results
  const { data: results, isLoading: isResultsLoading, isFetching: isResultsFetching } = useQuery({
    queryKey: ["results", runId, showInvalid, groupRepeats],
    queryFn: () => fetchResults(runId, showInvalid, groupRepeats),
    placeholderData: (previousData) => previousData,
  });

  // Fetch factor effects
  const { data: effectsData } = useQuery({
    queryKey: ["effects"],
    queryFn: fetchFactorEffects,
  });

  // Fetch reliability summary
  const { data: reliabilityData } = useQuery({
    queryKey: ["reliability"],
    queryFn: fetchReliabilitySummary,
  });

  // Train checker mutation
  const trainMutation = useMutation({
    mutationFn: trainReliabilityChecker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reliability"] });
    },
  });

  // Table sorting
  const [sortField, setSortField] = useState<string>("f1");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Scatter chart axes
  const [axisX, setAxisX] = useState<"latency_p50" | "memory_mb">("latency_p50");
  const [axisY, setAxisY] = useState<"f1" | "recall_at_k">("f1");

  if (isResultsLoading && !results) {
    return (
      <div className="max-w-[1160px] mx-auto px-4 py-16 text-center text-xs font-mono text-ink-soft">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
        Loading measured results...
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="max-w-[1160px] mx-auto px-4 py-12 space-y-6">
        <div className="flex justify-end gap-3">
          <label className="text-xs font-sans text-ink-soft flex items-center gap-1.5 cursor-pointer select-none bg-paper-raised px-3 py-2 rounded-lg border border-line">
            <input
              type="checkbox"
              aria-label="Show invalid runs"
              checked={showInvalid}
              onChange={(e) => setShowInvalid(e.target.checked)}
              className="rounded accent-accent"
            />
            <span>Show invalid / contaminated runs</span>
          </label>
        </div>
        <EmptyState
          title="No completed runs yet"
          description="You haven't run any clean benchmarks yet. Launch a quick verification check or planned sweep to see empirical metrics."
          actionText="Go to Benchmark"
          actionHref="/benchmark"
        />
      </div>
    );
  }

  // Filter by dataset if specified
  const availableDatasets: string[] = Array.from(
    new Set(results.map((r: any) => (r.dataset_id || "rajpurkar/squad_v2") as string))
  );
  const filteredResults = selectedDatasetFilter === "all"
    ? results
    : results.filter((r: any) => (r.dataset_id || "rajpurkar/squad_v2") === selectedDatasetFilter);

  // Calculate Pareto frontier points
  const sortedByX = [...filteredResults].sort((a, b) => a[axisX] - b[axisX]);
  const paretoPoints: any[] = [];
  let maxYSoFar = -1;

  for (const pt of sortedByX) {
    if (pt[axisY] > maxYSoFar) {
      paretoPoints.push(pt);
      maxYSoFar = pt[axisY];
    }
  }
  const paretoIds = new Set(paretoPoints.map((p) => p.config_id));

  // Sorted table items
  const sortedResults = [...filteredResults].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (valA === valB) return 0;
    if (valA > valB) return sortAsc ? 1 : -1;
    return sortAsc ? -1 : 1;
  });

  const scatterData = filteredResults.map((r: any) => ({
    x: r[axisX],
    y: r[axisY],
    name: `${r.language_model.split("/").pop()} (k=${r.top_k}, ${r.chunk_size}w)`,
    isPareto: paretoIds.has(r.config_id),
    raw: r,
  }));

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[40px] font-bold text-ink leading-tight mb-2">
            Results
          </h1>
          <p className="text-ink-soft text-sm max-w-[70ch]">
            Measured trade-offs across chunk size, Top-K, model size and quantization, computed directly from stored local benchmark runs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isResultsFetching && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-soft animate-pulse mr-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              <span>Updating...</span>
            </div>
          )}
          <label className="text-xs font-sans text-ink-soft flex items-center gap-1.5 cursor-pointer select-none bg-paper-raised px-3 py-2 rounded-lg border border-line">
            <input
              type="checkbox"
              aria-label="Aggregate repeats"
              checked={groupRepeats}
              onChange={(e) => setGroupRepeats(e.target.checked)}
              className="rounded accent-accent"
            />
            <Layers className="w-3.5 h-3.5 text-accent" />
            <span>Aggregate repeats</span>
          </label>
          <label className="text-xs font-sans text-ink-soft flex items-center gap-1.5 cursor-pointer select-none bg-paper-raised px-3 py-2 rounded-lg border border-line">
            <input
              type="checkbox"
              aria-label="Show invalid runs"
              checked={showInvalid}
              onChange={(e) => setShowInvalid(e.target.checked)}
              className="rounded accent-accent"
            />
            <span>Show invalid runs</span>
          </label>
        </div>
      </div>

      {/* Interactive Pareto Scatter Plot */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-ink flex items-center gap-2">
              <span>Pareto Frontier Analysis</span>
              <span className="text-xs font-sans font-semibold text-accent bg-accent/15 px-2 py-0.5 rounded">
                {paretoPoints.length} Optimal Configs
              </span>
            </h2>
            <p className="text-xs text-ink-soft">
              Configurations on the frontier offer the best F1 accuracy for any given resource budget.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-sans">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-soft">X-Axis:</span>
              <select
                aria-label="Scatter chart X-axis metric"
                value={axisX}
                onChange={(e) => setAxisX(e.target.value as any)}
                className="bg-paper border border-line rounded px-2 py-1 font-mono text-ink text-xs"
              >
                <option value="latency_p50">Latency p50 (ms)</option>
                <option value="memory_mb">Peak Memory (MB)</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-ink-soft">Y-Axis:</span>
              <select
                aria-label="Scatter chart Y-axis metric"
                value={axisY}
                onChange={(e) => setAxisY(e.target.value as any)}
                className="bg-paper border border-line rounded px-2 py-1 font-mono text-ink text-xs"
              >
                <option value="f1">F1 Accuracy</option>
                <option value="recall_at_k">Recall@K</option>
              </select>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <XAxis
                type="number"
                dataKey="x"
                name={axisX === "latency_p50" ? "Latency" : "Memory"}
                unit={axisX === "latency_p50" ? "ms" : "MB"}
                tick={{ fontSize: 11, fill: "var(--color-ink-soft)" }}
                axisLine={{ stroke: "var(--color-line)" }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={axisY === "f1" ? "F1 Score" : "Recall@K"}
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: "var(--color-ink-soft)" }}
                axisLine={{ stroke: "var(--color-line)" }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const r = data.raw;
                    return (
                      <div className="bg-paper border border-line p-3 rounded-lg shadow-xl text-xs font-mono space-y-1 max-w-xs">
                        <div className="font-bold text-ink">{r.language_model}</div>
                        <div className="text-ink-soft text-[11px]">
                          c={r.chunk_size} · k={r.top_k} · {r.quantization}
                        </div>
                        <div className="text-sage-deep font-semibold">F1: {r.f1.toFixed(3)}</div>
                        <div className="text-ink-soft">
                          Latency: {(r.latency_p50 / 1000).toFixed(2)}s · Mem: {Math.round(r.memory_mb)}MB
                        </div>
                        {data.isPareto && (
                          <div className="text-accent text-[10px] font-sans font-bold pt-1">
                            ★ On Pareto Frontier
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isPareto ? "var(--color-accent)" : "var(--color-ink-soft)"}
                    fillOpacity={entry.isPareto ? 0.9 : 0.4}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="space-y-4">
        <div className="flex border-b border-line gap-6 text-sm font-sans">
          {[
            { id: "table", label: "Measured Configurations", icon: Table },
            { id: "effects", label: "Single-Factor Effects", icon: BarChart2 },
            { id: "reliability", label: "Reliability Lab", icon: ShieldCheck },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 pb-3 font-semibold transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Table (E11 + E12) */}
        {activeTab === "table" && (
          <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-line">
              <div className="space-y-0.5">
                <h2 className="font-serif text-xl font-bold text-ink">Configuration Performance Table</h2>
                <p className="text-xs text-ink-soft">
                  Comparing all empirical measurements across models, embeddings, chunk sizes, and quantization.
                </p>
              </div>

              {/* Dataset Filter */}
              <div className="flex items-center gap-2 text-xs font-sans">
                <Filter className="w-3.5 h-3.5 text-ink-soft" />
                <span className="text-ink-soft">Dataset:</span>
                <select
                  aria-label="Filter results by dataset"
                  value={selectedDatasetFilter}
                  onChange={(e) => setSelectedDatasetFilter(e.target.value)}
                  className="bg-paper border border-line rounded px-2.5 py-1 text-ink font-mono text-xs"
                >
                  <option value="all">All Datasets ({results.length})</option>
                  {availableDatasets.map((ds) => (
                    <option key={ds} value={ds}>{ds}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-line text-ink-soft select-none">
                    <th className="py-2.5 px-3 font-sans font-semibold">Dataset</th>
                    <th className="py-2.5 px-3 font-sans font-semibold">Model</th>
                    <th className="py-2.5 px-3 font-sans font-semibold">Embedder</th>
                    <th className="py-2.5 px-3 font-sans font-semibold">Configuration</th>
                    <th className="py-2.5 px-3 font-sans font-semibold text-center">Repeats</th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-ink"
                      onClick={() => {
                        setSortField("f1");
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <span className="flex items-center gap-1 font-sans font-semibold">
                        F1 Score <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-ink"
                      onClick={() => {
                        setSortField("em");
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <span className="flex items-center gap-1 font-sans font-semibold">
                        Exact Match <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-ink"
                      onClick={() => {
                        setSortField("latency_p50");
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <span className="flex items-center gap-1 font-sans font-semibold">
                        Latency p50 <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="py-2.5 px-3 font-sans font-semibold">Peak Memory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {sortedResults.map((row: any) => {
                    const isPareto = paretoIds.has(row.config_id);
                    const lmShort = row.language_model.split("/").pop() || row.language_model;
                    const emShort = row.embedding_model.split("/").pop() || row.embedding_model;
                    const dsShort = row.dataset_id ? row.dataset_id.split("/").pop() : "squad_v2";

                    return (
                      <tr
                        key={row.config_id}
                        className={`hover:bg-paper/50 ${isPareto ? "bg-accent/5 font-medium" : ""}`}
                      >
                        {/* Dataset column */}
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-sans font-semibold bg-paper border border-line px-1.5 py-0.5 rounded text-ink-soft">
                            {dsShort}
                          </span>
                        </td>

                        {/* Model column */}
                        <td className="py-2.5 px-3 text-ink font-semibold">
                          <div className="flex items-center gap-1.5">
                            {isPareto && (
                              <span className="text-[9px] font-bold font-sans text-accent bg-accent/15 px-1 py-0.5 rounded">
                                PARETO
                              </span>
                            )}
                            <span title={row.language_model}>{lmShort}</span>
                          </div>
                        </td>

                        {/* Embedder column */}
                        <td className="py-2.5 px-3 text-ink-soft">
                          <span title={row.embedding_model}>{emShort}</span>
                        </td>

                        {/* Config (Chunk, Top-K, Quant) */}
                        <td className="py-2.5 px-3">
                          <span className="text-ink">
                            c={row.chunk_size}, k={row.top_k}
                            {row.quantization && row.quantization !== "none" ? ` (${row.quantization})` : ""}
                          </span>
                        </td>

                        {/* Repeats column (E11) */}
                        <td className="py-2.5 px-3 text-center">
                          {row.repeats > 1 ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sage/20 text-sage-deep font-bold border border-sage/40">
                              N={row.repeats}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-ink-soft">N=1</span>
                          )}
                        </td>

                        {/* F1 Score */}
                        <td className="py-2.5 px-3">
                          <MetricValue
                            value={row.f1}
                            n={row.n}
                            source="measured"
                            ciLower={row.ci_lower_f1}
                            ciUpper={row.ci_upper_f1}
                            formatter={() =>
                              row.f1_std != null
                                ? `${row.f1.toFixed(3)} ± ${row.f1_std.toFixed(3)}`
                                : row.f1.toFixed(3)
                            }
                          />
                        </td>

                        {/* Exact Match */}
                        <td className="py-2.5 px-3">
                          <MetricValue value={row.em} n={row.n} source="measured" />
                        </td>

                        {/* Latency (E7 & E8) */}
                        <td className="py-2.5 px-3">
                          <MetricValue
                            value={row.latency_p50}
                            unit="ms"
                            n={row.n}
                            source="local"
                            formatter={() =>
                              row.latency_p50_std != null
                                ? `${(row.latency_p50 / 1000).toFixed(2)} ± ${(row.latency_p50_std / 1000).toFixed(2)} s`
                                : undefined
                            }
                          />
                        </td>

                        {/* Peak Memory (E10) */}
                        <td className="py-2.5 px-3">
                          <MetricValue
                            value={row.memory_mb}
                            unit="MB"
                            n={row.n}
                            source={row.memory_source?.includes("measured") || row.memory_source?.includes("RAM") ? "measured" : "estimated"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Factor Effects */}
        {activeTab === "effects" && (
          <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-8">
            <div>
              <h2 className="font-serif text-xl font-bold text-ink">Single-Factor Marginal Effects & Paired Deltas</h2>
              <p className="text-xs text-ink-soft">
                Derived by pairing configurations that hold all other variables constant, isolating true marginal causal impact.
              </p>
            </div>

            {effectsData?.paired_effects ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Chunk Size Paired Effect */}
                <div className="p-5 bg-paper rounded-xl border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-semibold text-accent">Chunk Size Effect</span>
                    <span className="text-[10px] font-mono bg-paper-raised px-1.5 py-0.5 rounded border border-line">
                      512 vs 256
                    </span>
                  </div>
                  {effectsData.paired_effects.chunk_size?.pairs_count > 0 ? (
                    <div className="space-y-3">
                      <div className="text-lg font-bold font-mono text-ink">
                        Δ F1: {effectsData.paired_effects.chunk_size.delta_f1 > 0 ? "+" : ""}
                        {effectsData.paired_effects.chunk_size.delta_f1.toFixed(3)}
                      </div>
                      <p className="text-xs text-ink-soft leading-relaxed">
                        {effectsData.paired_effects.chunk_size.takeaway}
                      </p>
                      <div className="text-[11px] font-mono text-ink-soft pt-2 border-t border-line">
                        Pairs measured: {effectsData.paired_effects.chunk_size.pairs_count}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-ink-soft">
                        No paired 256 vs 512 sweep configurations found with identical parameters.
                      </p>
                      <Link to="/benchmark" className="text-xs text-accent underline block pt-1">
                        Run paired sweep in Benchmark →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Top-K Paired Effect */}
                <div className="p-5 bg-paper rounded-xl border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-semibold text-accent">Top-K Retrieval Depth</span>
                    <span className="text-[10px] font-mono bg-paper-raised px-1.5 py-0.5 rounded border border-line">
                      k=3 vs k=1
                    </span>
                  </div>
                  {effectsData.paired_effects.top_k?.pairs_count > 0 ? (
                    <div className="space-y-3">
                      <div className="text-lg font-bold font-mono text-ink">
                        Δ F1: {effectsData.paired_effects.top_k.delta_f1 > 0 ? "+" : ""}
                        {effectsData.paired_effects.top_k.delta_f1.toFixed(3)}
                      </div>
                      <p className="text-xs text-ink-soft leading-relaxed">
                        {effectsData.paired_effects.top_k.takeaway}
                      </p>
                      <div className="text-[11px] font-mono text-ink-soft pt-2 border-t border-line">
                        Pairs measured: {effectsData.paired_effects.top_k.pairs_count}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-ink-soft">
                        No paired k=1 vs k=3 configurations found with identical parameters.
                      </p>
                      <Link to="/benchmark" className="text-xs text-accent underline block pt-1">
                        Run paired sweep in Benchmark →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Quantization Paired Effect */}
                <div className="p-5 bg-paper rounded-xl border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-semibold text-accent">Quantization Precision</span>
                    <span className="text-[10px] font-mono bg-paper-raised px-1.5 py-0.5 rounded border border-line">
                      Q8_0 vs Q4_K_M
                    </span>
                  </div>
                  {effectsData.paired_effects.quantization?.pairs_count > 0 ? (
                    <div className="space-y-3">
                      <div className="text-lg font-bold font-mono text-ink">
                        Δ F1: {effectsData.paired_effects.quantization.delta_f1 > 0 ? "+" : ""}
                        {effectsData.paired_effects.quantization.delta_f1.toFixed(3)}
                      </div>
                      <p className="text-xs text-ink-soft leading-relaxed">
                        {effectsData.paired_effects.quantization.takeaway}
                      </p>
                      <div className="text-[11px] font-mono text-ink-soft pt-2 border-t border-line">
                        Pairs measured: {effectsData.paired_effects.quantization.pairs_count}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-ink-soft">
                        No paired Q4 vs Q8 configurations found with identical parameters.
                      </p>
                      <Link to="/benchmark" className="text-xs text-accent underline block pt-1">
                        Run paired sweep in Benchmark →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Marginal Averages by Factor */}
            {effectsData?.factors && (
              <div className="space-y-4 pt-4 border-t border-line">
                <h3 className="font-serif text-lg font-bold text-ink">Marginal Levels Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(effectsData.factors).map(([factorName, levels]: [string, any]) => (
                    <div key={factorName} className="p-4 bg-paper rounded-lg border border-line space-y-2 text-xs font-mono">
                      <div className="font-bold text-ink font-sans capitalize pb-1 border-b border-line">
                        {factorName.replace("_", " ")}
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {levels.map((lvl: any) => (
                          <div key={lvl.level} className="flex justify-between items-center p-1.5 bg-paper-raised rounded border border-line">
                            <span className="font-bold">{lvl.level}</span>
                            <span className="text-sage-deep">F1 {lvl.avg_f1.toFixed(3)}</span>
                            <span className="text-ink-soft">{(lvl.avg_latency_ms / 1000).toFixed(2)}s</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Reliability Lab */}
        {activeTab === "reliability" && (
          <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
              <div>
                <h2 className="font-serif text-xl font-bold text-ink">Reliability Detector Audit</h2>
                <p className="text-xs text-ink-soft">
                  Evaluated using question-split cross-validation to prevent context leakage across train/test splits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => trainMutation.mutate()}
                disabled={trainMutation.isPending}
                className="btn-secondary text-xs flex items-center gap-2 px-3 py-2"
              >
                <Sparkles className="w-4 h-4 text-accent" />
                <span>{trainMutation.isPending ? "Training detector..." : "Train checker on clean runs"}</span>
              </button>
            </div>

            {reliabilityData ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-paper rounded-xl border border-line space-y-1.5">
                  <span className="text-xs font-sans text-ink-soft">Detector AUROC</span>
                  <div className="text-2xl font-bold font-mono text-ink">
                    {reliabilityData.auroc?.toFixed(3) || "—"}
                  </div>
                  <p className="text-[11px] text-ink-soft">
                    Discriminative ability to flag hallucinated or ungrounded responses.
                  </p>
                </div>
                <div className="p-5 bg-paper rounded-xl border border-line space-y-1.5">
                  <span className="text-xs font-sans text-ink-soft">Errors Caught @ 20% Rejection</span>
                  <div className="text-2xl font-bold font-mono text-sage-deep">
                    {reliabilityData.rejection_20_caught
                      ? `${(reliabilityData.rejection_20_caught * 100).toFixed(1)}%`
                      : "—"}
                  </div>
                  <p className="text-[11px] text-ink-soft">
                    Percentage of incorrect model answers eliminated by rejecting top 20% lowest confidence.
                  </p>
                </div>
                <div className="p-5 bg-paper rounded-xl border border-line space-y-1.5">
                  <span className="text-xs font-sans text-ink-soft">Sample Count</span>
                  <div className="text-2xl font-bold font-mono text-ink">
                    {reliabilityData.n || 0} questions
                  </div>
                  <p className="text-[11px] text-ink-soft">
                    Clean audited model responses evaluated across splits.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-paper rounded-xl border border-line text-xs font-mono text-ink-soft text-center">
                Click "Train checker on clean runs" to compute empirical AUROC and selective prediction metrics.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
