import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchResults,
  fetchFactorEffects,
  fetchReliabilitySummary,
  trainReliabilityChecker,
} from "../api/client";
import { MetricValue } from "../components/MetricValue";
import { EmptyState } from "../components/EmptyState";
import { Tip } from "../components/Tip";
import {
  Table,
  BarChart2,
  ShieldCheck,
  ArrowUpDown,
  Sparkles,
  Loader2,
  AlertTriangle,
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

  // Fetch results
  const { data: results, isLoading: isResultsLoading } = useQuery({
    queryKey: ["results", runId, showInvalid],
    queryFn: () => fetchResults(runId, showInvalid),
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

  if (isResultsLoading) {
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
        <div className="flex justify-end">
          <label className="text-xs font-sans text-ink-soft flex items-center gap-1.5 cursor-pointer select-none bg-paper-raised px-3 py-2 rounded-lg border border-line">
            <input
              type="checkbox"
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

  // Calculate Pareto frontier points
  const sortedByX = [...results].sort((a, b) => a[axisX] - b[axisX]);
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
  const sortedResults = [...results].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (valA === valB) return 0;
    if (valA > valB) return sortAsc ? 1 : -1;
    return sortAsc ? -1 : 1;
  });

  const scatterData = results.map((r: any) => ({
    x: r[axisX],
    y: r[axisY],
    name: `${r.language_model} (k=${r.top_k}, ${r.chunk_size}w)`,
    isPareto: paretoIds.has(r.config_id),
    raw: r,
  }));

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[44px] font-bold text-ink leading-tight mb-2">
            Results
          </h1>
          <p className="text-ink-soft text-base max-w-[70ch]">
            Measured trade-offs across chunk size, Top-K, model size and quantization, computed directly from stored evaluation runs.
          </p>
        </div>
        <label className="text-xs font-sans text-ink-soft flex items-center gap-1.5 cursor-pointer select-none bg-paper-raised px-3 py-2 rounded-lg border border-line self-start md:self-auto shrink-0">
          <input
            type="checkbox"
            checked={showInvalid}
            onChange={(e) => setShowInvalid(e.target.checked)}
            className="rounded accent-accent"
          />
          <span>Show invalid / contaminated runs</span>
        </label>
      </div>

      {/* ONE Primary Chart & Reading Help */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-xs font-sans font-semibold text-sage-deep">Trade-offs</span>
            <h2 className="font-serif text-2xl font-bold text-ink mt-0.5">Pareto efficiency frontier</h2>
            <p className="text-xs text-ink-soft mt-1">
              Points in red-orange represent the Pareto frontier: no other measured configuration provides both higher quality and lower resource cost.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-sans">
            <label className="flex items-center gap-1.5">
              <span className="text-ink-soft">X axis:</span>
              <select
                value={axisX}
                onChange={(e) => setAxisX(e.target.value as any)}
                className="bg-paper border border-line rounded px-2 py-1 text-ink"
              >
                <option value="latency_p50">Latency p50 (seconds)</option>
                <option value="memory_mb">Peak Memory (MB)</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5">
              <span className="text-ink-soft">Y axis:</span>
              <select
                value={axisY}
                onChange={(e) => setAxisY(e.target.value as any)}
                className="bg-paper border border-line rounded px-2 py-1 text-ink"
              >
                <option value="f1">Token F1 Score</option>
                <option value="recall_at_k">Recall@K</option>
              </select>
            </label>
          </div>
        </div>

        {/* Scatter Chart */}
        <div className="h-80 w-full bg-paper rounded-xl border border-line p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <XAxis
                type="number"
                dataKey="x"
                name={axisX === "latency_p50" ? "Latency p50 (s)" : "Memory (MB)"}
                unit={axisX === "latency_p50" ? "s" : "MB"}
                stroke="#5E574C"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={axisY === "f1" ? "Token F1" : "Recall@K"}
                domain={[0, 1]}
                stroke="#5E574C"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-paper-raised p-3 rounded-lg border border-line text-xs font-mono text-ink shadow-md space-y-1">
                      <p className="font-bold">{d.name}</p>
                      <p>{axisY.toUpperCase()}: {d.y?.toFixed(3)}</p>
                      <p>{axisX}: {d.x} {axisX === "latency_p50" ? "s" : "MB"}</p>
                      {d.isPareto && <p className="text-accent font-bold">★ Pareto-optimal</p>}
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isPareto ? "#EA2E00" : "#9DBDB8"}
                    r={entry.isPareto ? 8 : 5}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs: Table, Factor Effects, Reliability */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-line">
          {[
            { id: "table", label: "Results Table", icon: <Table className="w-4 h-4" /> },
            { id: "effects", label: "Factor Effects", icon: <BarChart2 className="w-4 h-4" /> },
            { id: "reliability", label: "Reliability Lab", icon: <ShieldCheck className="w-4 h-4" /> },
          ].map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-sans font-semibold transition-colors border-b-2 -mb-[1px] ${
                  isActive
                    ? "border-accent text-accent bg-paper-raised"
                    : "border-transparent text-ink-soft hover:text-ink hover:bg-paper-raised/50"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Table (shows 6 columns by default) */}
        {activeTab === "table" && (
          <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h2 className="font-serif text-xl font-bold text-ink">Measured configurations</h2>
              <span className="text-xs font-sans text-ink-soft">{results.length} configurations measured</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-line text-ink-soft">
                    <th className="py-2.5 px-3">Configuration</th>
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
                    <th className="py-2.5 px-3 font-sans font-semibold">Sample (n)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {sortedResults.map((row: any) => {
                    const isPareto = paretoIds.has(row.config_id);
                    return (
                      <tr
                        key={row.config_id}
                        className={`hover:bg-paper/50 ${isPareto ? "bg-accent/5 font-medium" : ""}`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {isPareto && (
                              <span className="text-[10px] font-bold font-sans text-accent bg-accent/15 px-1 py-0.5 rounded">
                                PARETO
                              </span>
                            )}
                            {!row.is_valid && (
                              <span
                                className="text-[10px] font-medium font-sans text-ochre bg-ochre/20 px-1 py-0.5 rounded"
                                title={row.invalid_reason || "Contaminated / invalid run"}
                              >
                                INVALID
                              </span>
                            )}
                            <span>
                              c={row.chunk_size}, k={row.top_k}
                              {row.quantization !== "none" ? ` (${row.quantization})` : ""}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <MetricValue
                            value={row.f1}
                            n={row.n}
                            source="measured"
                            ciLower={row.ci_lower_f1}
                            ciUpper={row.ci_upper_f1}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <MetricValue value={row.em} n={row.n} source="measured" />
                        </td>
                        <td className="py-2.5 px-3">
                          <MetricValue
                            value={row.latency_p50}
                            unit="s"
                            n={row.n}
                            source="api"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <MetricValue
                            value={row.memory_mb}
                            unit="MB"
                            n={row.n}
                            source={row.memory_source === "measured" ? "measured" : "estimated"}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-ink-soft">
                          n={row.n}
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
          <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
            <div>
              <h2 className="font-serif text-xl font-bold text-ink">Single-factor marginal effects</h2>
              <p className="text-xs text-ink-soft">
                Average delta in F1, latency, and memory when holding all other factors constant.
              </p>
            </div>

            {effectsData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top-K Effect */}
                <div className="p-4 bg-paper rounded-lg border border-line space-y-3">
                  <h3 className="font-serif text-base font-bold text-ink">Top-K marginal yield</h3>
                  <p className="text-xs text-ink-soft">
                    Marginal F1 gain per additional retrieved chunk vs added latency cost:
                  </p>
                  <div className="space-y-2">
                    {effectsData.top_k_effects?.map((eff: any) => (
                      <div key={eff.top_k} className="flex justify-between items-center text-xs font-mono p-2 bg-paper-raised rounded border border-line">
                        <span className="font-bold">K = {eff.top_k}</span>
                        <div className="flex gap-4">
                          <span className="text-sage-deep">Avg F1: {eff.avg_f1.toFixed(3)}</span>
                          <span className="text-ink-soft">Lat: {eff.avg_latency_s.toFixed(2)}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chunk Size Effect */}
                <div className="p-4 bg-paper rounded-lg border border-line space-y-3">
                  <h3 className="font-serif text-base font-bold text-ink">Chunk size efficiency</h3>
                  <p className="text-xs text-ink-soft">
                    Trade-off between retrieval specificity and context window budget:
                  </p>
                  <div className="space-y-2">
                    {effectsData.chunk_size_effects?.map((eff: any) => (
                      <div key={eff.chunk_size} className="flex justify-between items-center text-xs font-mono p-2 bg-paper-raised rounded border border-line">
                        <span className="font-bold">{eff.chunk_size} words</span>
                        <div className="flex gap-4">
                          <span className="text-sage-deep">Avg F1: {eff.avg_f1.toFixed(3)}</span>
                          <span className="text-ink-soft">Lat: {eff.avg_latency_s.toFixed(2)}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Reliability Lab */}
        {activeTab === "reliability" && (
          <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div>
                <h2 className="font-serif text-xl font-bold text-ink">Reliability detector audit</h2>
                <p className="text-xs text-ink-soft">
                  Evaluated using question-split cross-validation to prevent context leakage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => trainMutation.mutate()}
                disabled={trainMutation.isPending}
                className="btn-secondary text-xs"
              >
                <Sparkles className="w-4 h-4 text-accent" />
                <span>{trainMutation.isPending ? "Training..." : "Train checker on my runs"}</span>
              </button>
            </div>

            {reliabilityData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-3 bg-paper rounded border border-line">
                    <span className="text-ink-soft block font-sans">Ensemble AUROC</span>
                    <span className="font-bold text-ink text-base">{reliabilityData.auroc.toFixed(3)}</span>
                    <span className="text-[10px] text-ink-soft block font-sans">Baseline: {reliabilityData.baseline_auroc.toFixed(3)}</span>
                  </div>
                  <div className="p-3 bg-paper rounded border border-line">
                    <span className="text-ink-soft block font-sans">20% Rejection Caught</span>
                    <span className="font-bold text-sage-deep text-base">
                      {(reliabilityData.rejection_20_caught * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-ink-soft block font-sans">Errors eliminated</span>
                  </div>
                  <div className="p-3 bg-paper rounded border border-line">
                    <span className="text-ink-soft block font-sans">Abstention Rate</span>
                    <span className="font-bold text-ink text-base">
                      {(reliabilityData.abstention_rate * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-ink-soft block font-sans">Unanswerable caught</span>
                  </div>
                  <div className="p-3 bg-paper rounded border border-line">
                    <span className="text-ink-soft block font-sans">Sample Size</span>
                    <span className="font-bold text-ink text-base">n = {reliabilityData.n}</span>
                    <span className="text-[10px] text-ink-soft block font-sans">Labelled answers</span>
                  </div>
                </div>

                {reliabilityData.n < 300 && (
                  <div className="p-3 bg-ochre/15 border border-ochre/40 rounded-lg text-ochre text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Small sample: fewer than 300 labelled answers available in the workspace. AUROC and abstention values should be interpreted with caution.</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
