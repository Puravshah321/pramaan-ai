import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRecommendation, fetchHardware, type HardwareProfile } from "../api/client";
import {
  Award,
  AlertCircle,
  Loader2,
  Cpu,
  Search,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Info,
} from "lucide-react";

export const Recommend: React.FC = () => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>("detected_machine");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const [memoryLimit, setMemoryLimit] = useState<number>(4.8);
  const [latencyLimit, setLatencyLimit] = useState<number>(5.0);
  const [goal, setGoal] = useState<string>("best_quality");

  // Fetch detected machine and all verified profiles
  const { data: hwData, isLoading: hwLoading } = useQuery({
    queryKey: ["hardware"],
    queryFn: fetchHardware,
  });

  // When hardware detection returns, initialize memoryLimit with detected budget
  useEffect(() => {
    if (hwData?.detected && selectedProfileId === "detected_machine") {
      setMemoryLimit(hwData.detected.budget_gb);
    }
  }, [hwData, selectedProfileId]);

  // Selected profile details
  const currentProfile = useMemo(() => {
    if (selectedProfileId === "detected_machine" && hwData?.detected) {
      return {
        id: "detected_machine",
        name: hwData.detected.name,
        category: hwData.detected.category,
        memory_gb: hwData.detected.total_gb,
        memory_type: hwData.detected.type,
        budget_gb: hwData.detected.budget_gb,
        source: "",
        description: `Auto-detected host configuration: ${hwData.detected.chip} (${hwData.detected.total_gb}GB total, ${hwData.detected.budget_gb}GB usable budget).`,
      };
    }
    return hwData?.profiles.find((p) => p.id === selectedProfileId) || null;
  }, [hwData, selectedProfileId]);

  const selectProfile = (p: HardwareProfile | { id: string; budget_gb: number }) => {
    setSelectedProfileId(p.id);
    setIsCustom(false);
    setMemoryLimit(p.budget_gb);
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
    setSelectedProfileId("custom");
  };

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    if (!hwData?.profiles) return [];
    return hwData.profiles.filter((p) => {
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchSearch =
        searchQuery.trim() === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [hwData, activeCategory, searchQuery]);

  const { data: recData, isLoading: recLoading } = useQuery({
    queryKey: ["recommend", memoryLimit, latencyLimit, goal],
    queryFn: () =>
      fetchRecommendation({
        memory_gb: memoryLimit,
        latency_s: latencyLimit,
        goal: goal,
      }),
  });

  const categories = ["All", "NVIDIA Consumer", "Apple Silicon", "NVIDIA Cloud", "CPU / System RAM"];

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-10">
      {/* Page Header */}
      <div>
        <h1 className="font-serif text-[40px] md:text-[44px] font-bold text-ink leading-tight mb-2">
          Hardware-Aware Recommendations
        </h1>
        <p className="text-ink-soft text-base max-w-[75ch]">
          Filter strictly measured, verified RAG configurations to find the optimal setup for your GPU or unified memory envelope. No synthetic estimations or fake latency numbers.
        </p>
      </div>

      {/* Hardware Profile Selector Card */}
      <div className="card-paper p-4 sm:p-6 md:p-8 bg-paper-raised space-y-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-sage-deep font-bold block mb-1">
              Step 1: Choose Hardware Profile
            </span>
            <h2 className="font-serif text-2xl font-bold text-ink">Target Hardware & Usable VRAM</h2>
          </div>
          <div className="text-xs font-mono text-ink-soft bg-paper px-3 py-1.5 rounded-md border border-line">
            Usable Budget: <strong className="text-accent">{memoryLimit} GB</strong>
          </div>
        </div>

        {/* Primary Quick Chips: Auto-Detected & Popular Presets */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Auto-detected machine chip */}
            {hwData?.detected && (
              <button
                type="button"
                onClick={() => selectProfile({ id: "detected_machine", budget_gb: hwData.detected.budget_gb })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all border max-w-full ${
                  selectedProfileId === "detected_machine"
                    ? "bg-ink text-paper border-ink shadow-sm"
                    : "bg-paper text-ink border-line hover:border-ink/50"
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate max-w-[240px] sm:max-w-none">Your Machine: {hwData.detected.name}</span>
                {selectedProfileId === "detected_machine" && <CheckCircle2 className="w-3.5 h-3.5 text-accent ml-1 shrink-0" />}
              </button>
            )}

            {/* Popular presets */}
            {[
              { id: "rtx_3060_12gb", name: "RTX 3060 (12GB)", budget: 10.0 },
              { id: "rtx_4060_ti_16gb", name: "RTX 4060 Ti (16GB)", budget: 13.8 },
              { id: "apple_m3_pro_18gb", name: "Apple M3 Pro (18GB)", budget: 13.5 },
              { id: "apple_m4_16gb", name: "Apple M4 (16GB)", budget: 10.7 },
              { id: "cpu_16gb", name: "CPU Host (16GB RAM)", budget: 10.5 },
            ].map((preset) => {
              const active = selectedProfileId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => selectProfile({ id: preset.id, budget_gb: preset.budget })}
                  className={`px-3 py-2 rounded-lg text-xs font-mono transition-all border ${
                    active
                      ? "bg-ink text-paper border-ink font-semibold"
                      : "bg-paper text-ink-soft border-line hover:border-ink/40 hover:text-ink"
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}

            {/* Custom toggle button */}
            <button
              type="button"
              onClick={handleCustomToggle}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all border ${
                isCustom
                  ? "bg-accent text-white border-accent font-semibold"
                  : "bg-paper text-ink-soft border-line hover:border-ink/40 hover:text-ink"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Custom Limits</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter for Hardware Library */}
        <div className="pt-2 border-t border-line/60 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 max-w-full overflow-hidden">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find your device (e.g. RTX 3060, M3 Max, T4, 32GB)..."
                className="w-full bg-paper border border-line rounded-lg pl-9 pr-3 py-1.5 text-xs font-sans text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-sans whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? "bg-ink text-paper font-semibold"
                      : "text-ink-soft hover:bg-paper hover:text-ink"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped Profiles Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            {filteredProfiles.map((p) => {
              const isSelected = selectedProfileId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProfile(p)}
                  className={`text-left p-2.5 rounded-lg border transition-all text-xs ${
                    isSelected
                      ? "border-accent bg-paper shadow-sm"
                      : "border-line bg-paper/60 hover:bg-paper hover:border-ink/30"
                  }`}
                >
                  <div className="font-semibold text-ink truncate font-sans">{p.name}</div>
                  <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-ink-soft">
                    <span>{p.category.split(" ")[0]}</span>
                    <span className="font-bold text-accent">{p.budget_gb} GB budget</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Profile Info / Verified Specs Banner */}
        {currentProfile && (
          <div className="p-4 bg-paper rounded-lg border border-line text-xs font-sans text-ink-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-ink block">{currentProfile.name}</span>
              <p className="text-[12px] text-ink-soft mt-0.5">{currentProfile.description}</p>
            </div>
            {currentProfile.source && (
              <a
                href={currentProfile.source}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-accent hover:underline shrink-0"
              >
                <span>Verified Specs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Custom Memory Slider (HIDDEN by default, visible only if Custom selected) */}
        {isCustom && (
          <div className="p-4 bg-paper rounded-lg border-2 border-accent/40 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">
                Manual Hardware Envelope
              </span>
              <span className="font-mono text-sm font-bold text-ink">{memoryLimit} GB</span>
            </div>
            <div className="space-y-1">
              <input
                type="range"
                aria-label="Custom memory limit in GB"
                min={0.5}
                max={32.0}
                step={0.5}
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-ink-soft">
                <span>0.5 GB (Edge)</span>
                <span>8 GB</span>
                <span>16 GB</span>
                <span>32 GB (Workstation)</span>
              </div>
            </div>
          </div>
        )}

        {/* Latency & Optimization Priority Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-line">
          {/* Latency Limit */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-sans">
              <span className="text-ink-soft font-medium">Latency limit target (seconds)</span>
              <span className="font-mono font-bold text-ink">{latencyLimit}s</span>
            </div>
            <input
              type="range"
              aria-label="Latency limit in seconds"
              min={0.5}
              max={15.0}
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

      {/* Latency Disclaimer Banner (Strict Honesty Requirement) */}
      <div className="p-4 bg-paper-raised rounded-lg border border-line flex items-start gap-3 text-xs font-sans text-ink-soft">
        <Info className="w-4 h-4 text-sage-deep shrink-0 mt-0.5" />
        <div>
          <strong className="text-ink font-semibold">Latency Measurement Integrity: </strong>
          Benchmark latencies were measured on{" "}
          <span className="font-mono text-ink font-bold">
            {hwData?.benchmark_hardware?.name || "Local Test Runner"}
          </span>
          . Target devices (e.g. {currentProfile?.name || "selected GPU"}) have distinct memory bandwidths and compute cores; expect different latency numbers on target hardware.
        </div>
      </div>

      {/* Insufficient Setups / Sample Size Banner */}
      {recData?.insufficient_setups && (
        <div className="p-5 bg-paper-raised border-2 border-ochre rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-ochre font-bold font-serif text-lg">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Preliminary Recommendation ({recData.setup_count} / {recData.required_setups} setups measured)</span>
          </div>
          <p className="text-sm font-sans text-ink-soft leading-relaxed">
            At least 3 distinct benchmark setups are required before making definitive Pareto-optimal claims without bias.
            Current recommendations reflect the best candidate among existing runs.
          </p>
          <div className="pt-2">
            <Link
              to="/benchmark"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-accent hover:underline"
            >
              <span>Run more benchmark configurations to unlock high-confidence Pareto ranking →</span>
            </Link>
          </div>
        </div>
      )}

      {/* Recommendation Output */}
      {recLoading ? (
        <div className="py-12 text-center text-xs font-mono text-ink-soft">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
          Filtering verified configurations against {memoryLimit} GB budget...
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
                <span>F1: {recData.closest_option.f1.toFixed(3)}</span>
                <span>Latency: {recData.closest_option.latency_p50.toFixed(0)} ms</span>
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
          {/* Result Card */}
          <div className="bg-[#141210] text-paper border border-[#201D1A] rounded-xl p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#201D1A]">
              <div className="flex items-center gap-2.5">
                <Award className="w-6 h-6 text-accent" />
                <div>
                  <h2 className="font-serif text-2xl md:text-3xl font-bold text-paper">
                    Recommended configuration
                  </h2>
                  <span className="text-xs font-mono text-sage/80 block mt-0.5">
                    For {currentProfile?.name || `${memoryLimit} GB budget`}
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono text-sage bg-[#201D1A] px-3 py-1 rounded-full border border-line/20">
                Priority: {goal.replace("_", " ")}
              </span>
            </div>

            {/* Why Chosen Statement */}
            <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20 text-sm font-sans text-paper leading-relaxed space-y-2">
              <div className="font-medium">💡 {recData.why_chosen}</div>
              {recData.low_sample_warning && (
                <div className="text-xs font-mono text-ochre/90 pt-1 border-t border-line/10">
                  ⚠️ {recData.low_sample_warning}
                </div>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20">
                <span className="text-sage block mb-1 font-sans">Token F1</span>
                <span className="text-paper text-2xl font-bold font-mono">
                  {recData.chosen.f1.toFixed(3)}
                </span>
                <span className="text-sage/60 text-[11px] block mt-0.5">
                  n={recData.chosen.n} questions (100% completed)
                </span>
              </div>

              <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20">
                <span className="text-sage block mb-1 font-sans">Latency (p50)</span>
                <span className="text-paper text-2xl font-bold font-mono">
                  {(recData.chosen.latency_p50 / 1000).toFixed(2)}s
                </span>
                <span className="text-sage/60 text-[11px] block mt-0.5">
                  {recData.chosen.latency_p50.toFixed(0)} ms on test host
                </span>
              </div>

              <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20">
                <span className="text-sage block mb-1 font-sans">Peak Memory</span>
                <span className="text-paper text-2xl font-bold font-mono">
                  {(recData.chosen.memory_mb / 1024).toFixed(2)} GB
                </span>
                <span className="text-sage/60 text-[11px] block mt-0.5">
                  Fits {memoryLimit} GB budget
                </span>
              </div>

              <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20">
                <span className="text-sage block mb-1 font-sans">Setup</span>
                <span className="text-paper text-sm font-bold font-mono block">
                  Chunk: {recData.chosen.chunk_size}w, k={recData.chosen.top_k}
                </span>
                <span className="text-sage text-xs font-mono block mt-1 truncate">
                  {recData.chosen.quantization && recData.chosen.quantization !== "none"
                    ? `${recData.chosen.language_model.split("/").pop()} (${recData.chosen.quantization})`
                    : recData.chosen.language_model.split("/").pop()}
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
                      #{idx + 2} c={alt.chunk_size}, k={alt.top_k} ({alt.quantization})
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
