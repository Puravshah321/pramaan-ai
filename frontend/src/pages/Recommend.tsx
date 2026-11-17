import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRecommendation } from "../api/client";
import { MetricValue } from "../components/MetricValue";
import {
  Award,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";

export const Recommend: React.FC = () => {
  const [memoryLimit, setMemoryLimit] = useState<number>(4.0);
  const [latencyLimit, setLatencyLimit] = useState<number>(2.5);
  const [goal, setGoal] = useState<string>("best_quality");

  const { data: recData, isLoading } = useQuery({
    queryKey: ["recommend", memoryLimit, latencyLimit, goal],
    queryFn: () =>
      fetchRecommendation({
        memory_gb: memoryLimit,
        latency_s: latencyLimit,
        goal: goal,
      }),
  });

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-12">
      {/* Page Header */}
      <div>
        <h1 className="font-serif text-[44px] font-bold text-ink leading-tight mb-2">
          Recommend
        </h1>
        <p className="text-ink-soft text-base max-w-[70ch]">
          Filter verified configurations against your hardware memory and latency limits to find the Pareto-optimal setup for your goal.
        </p>
      </div>

      {/* Constraints & Goal in ONE row */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {/* Memory limit slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-sans">
              <span className="text-ink-soft font-medium">Memory limit (GB)</span>
              <span className="font-mono font-bold text-ink">{memoryLimit} GB</span>
            </div>
            <input
              type="range"
              aria-label="Memory limit in GB"
              min={1.0}
              max={16.0}
              step={0.5}
              value={memoryLimit}
              onChange={(e) => setMemoryLimit(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Latency limit slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-sans">
              <span className="text-ink-soft font-medium">Latency limit (seconds)</span>
              <span className="font-mono font-bold text-ink">{latencyLimit}s</span>
            </div>
            <input
              type="range"
              aria-label="Latency limit in seconds"
              min={0.5}
              max={10.0}
              step={0.5}
              value={latencyLimit}
              onChange={(e) => setLatencyLimit(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Goal selection */}
          <div className="space-y-2">
            <label htmlFor="goal-select" className="text-xs font-sans font-medium text-ink-soft block">
              Optimization priority
            </label>
            <select
              id="goal-select"
              aria-label="Optimization priority"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-accent"
            >
              <option value="best_quality">Best Quality (highest F1)</option>
              <option value="balanced">Balanced (quality per cost)</option>
              <option value="fastest">Fastest (lowest latency)</option>
              <option value="smallest">Smallest (lowest memory)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recommendation Output */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-mono text-ink-soft">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
          Filtering verified configurations...
        </div>
      ) : recData?.nothing_fits ? (
        <div className="card-paper p-6 md:p-8 bg-paper-raised border-2 border-ochre space-y-4">
          <div className="flex items-center gap-2 text-ochre font-bold font-serif text-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>No configuration fits within these limits</span>
          </div>
          <p className="text-sm font-sans text-ink-soft leading-relaxed">{recData.why_chosen}</p>

          {recData.closest_option && (
            <div className="p-4 bg-paper rounded-lg border border-line space-y-2">
              <span className="text-xs font-sans font-bold text-ink block">Closest measured option:</span>
              <div className="text-xs font-mono text-ink-soft flex items-center gap-4 flex-wrap">
                <span>c={recData.closest_option.chunk_size}, k={recData.closest_option.top_k}</span>
                <span>F1: {recData.closest_option.f1}</span>
                <span>Latency: {recData.closest_option.latency_p50} ms</span>
                <span>Memory: {(recData.closest_option.memory_mb / 1024).toFixed(2)} GB</span>
              </div>
              <p className="text-xs font-sans text-accent">
                Required limits to admit:{" "}
                <strong>{recData.admitting_limits?.required_memory_gb} GB</strong> memory and{" "}
                <strong>{recData.admitting_limits?.required_latency_s}s</strong> latency.
              </p>
            </div>
          )}
        </div>
      ) : recData?.chosen ? (
        <div className="space-y-8">
          {/* Result in a BLACK card */}
          <div className="bg-[#141210] text-paper border border-[#201D1A] rounded-xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#201D1A]">
              <div className="flex items-center gap-2.5">
                <Award className="w-6 h-6 text-accent" />
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-paper">
                  Recommended configuration
                </h2>
              </div>
              <span className="text-xs font-mono text-sage bg-[#201D1A] px-3 py-1 rounded-full border border-line/20">
                Priority: {goal.replace("_", " ")}
              </span>
            </div>

            {/* Why Chosen Statement or comparative claim */}
            <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20 text-sm font-sans text-paper leading-relaxed">
              {recData.total_measured_configs >= 3 && (recData.chosen.n >= 100) ? (
                <span>💡 {recData.why_chosen}</span>
              ) : (
                <span>
                  Based on {recData.total_measured_configs || 1} measured setup(s) in this workspace.{" "}
                  <Link to="/benchmark" className="text-accent underline font-semibold">
                    Run more benchmark sweeps
                  </Link>{" "}
                  with n ≥ 100 to unlock high-confidence comparative claims.
                </span>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20">
                <span className="text-sage block mb-1 font-sans">Token F1</span>
                <span className="text-paper text-2xl font-bold font-mono">
                  {recData.chosen.f1.toFixed(3)}
                </span>
                <span className="text-sage/60 text-[11px] block mt-0.5">n={recData.chosen.n}</span>
              </div>

              <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20">
                <span className="text-sage block mb-1 font-sans">Latency (p50)</span>
                <span className="text-paper text-2xl font-bold font-mono">
                  {(recData.chosen.latency_p50 / 1000).toFixed(2)}s
                </span>
                <span className="text-sage/60 text-[11px] block mt-0.5">
                  {recData.chosen.latency_p50} ms
                </span>
              </div>

              <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20">
                <span className="text-sage block mb-1 font-sans">Peak memory</span>
                <span className="text-paper text-2xl font-bold font-mono">
                  {(recData.chosen.memory_mb / 1024).toFixed(2)} GB
                </span>
                <span className="text-sage/60 text-[11px] block mt-0.5">
                  {recData.chosen.memory_source}
                </span>
              </div>

              <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20">
                <span className="text-sage block mb-1 font-sans">Setup</span>
                <span className="text-paper text-sm font-bold font-mono block">
                  Chunk: {recData.chosen.chunk_size}w
                </span>
                <span className="text-sage text-sm font-mono block">
                  Top-K: {recData.chosen.top_k}
                </span>
              </div>
            </div>
          </div>

          {/* Next Best Options */}
          {recData.next_best && recData.next_best.length > 0 && (
            <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-4">
              <h3 className="font-serif text-xl font-bold text-ink">Next-best alternatives</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {recData.next_best.map((alt: any, idx: number) => (
                  <div key={alt.config_id} className="p-4 bg-paper rounded-lg border border-line space-y-2 text-xs font-mono">
                    <span className="font-bold text-ink block font-sans">
                      #{idx + 2} c={alt.chunk_size}, k={alt.top_k}
                    </span>
                    <div className="flex justify-between text-ink-soft">
                      <span>F1: {alt.f1.toFixed(3)}</span>
                      <span>Lat: {(alt.latency_p50 / 1000).toFixed(2)}s</span>
                    </div>
                    <div className="text-ink-soft">
                      Mem: {(alt.memory_mb / 1024).toFixed(2)} GB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
