import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SetupChip } from "./SetupChip";
import { fetchHealth, fetchSetup } from "../api/client";
import { Menu, X, HelpCircle, Cpu, ShieldCheck } from "lucide-react";

interface HeaderProps {
  onOpenHelp?: () => void;
}

const NAV_ITEMS = [
  { name: "Home", path: "/" },
  { name: "Guide", path: "/guide" },
  { name: "Models", path: "/models" },
  { name: "Benchmark", path: "/benchmark" },
  { name: "Results", path: "/results" },
  { name: "Recommend", path: "/recommend" },
  { name: "Try It", path: "/try-it" },
];

export const Header: React.FC<HeaderProps> = ({ onOpenHelp }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  const { data: setup } = useQuery({
    queryKey: ["setup"],
    queryFn: fetchSetup,
  });

  return (
    <header className="sticky top-0 z-50 w-full h-[72px] border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="max-w-[1160px] mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        {/* Left: Logo & Brand */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <span className="w-5 h-5 bg-accent rounded-sm inline-flex items-center justify-center text-paper-raised text-xs font-bold leading-none select-none">
            ◼
          </span>
          <span className="font-serif font-bold text-xl text-ink tracking-tight">
            Pramaan AI
          </span>
        </Link>

        {/* Centre: Navigation (Desktop, >= 1100px to guarantee zero wrapping) */}
        <nav className="hidden min-[1100px]:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? "text-accent bg-paper-raised font-semibold border-b-2 border-accent"
                    : "text-ink hover:text-accent hover:bg-paper-raised/60"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right: Local mode pill, Active setup chip & Help button */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Local Mode Status Pill with Detailed Tooltip (hidden below 1280px to avoid clutter) */}
          <div className="relative group hidden min-[1280px]:block">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-sans bg-sage/20 text-sage-deep font-semibold border border-sage-deep/20 cursor-default select-none whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-sage-deep animate-pulse shrink-0" />
              <span>Local mode</span>
            </div>
            {/* Tooltip */}
            <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-72 p-3.5 bg-paper border border-line rounded-lg shadow-xl text-xs z-50 animate-in fade-in">
              <div className="font-bold text-ink font-sans pb-1.5 border-b border-line mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sage-deep" />
                  <span>Free Local Execution</span>
                </span>
                <span className="text-[10px] font-sans text-sage-deep bg-sage/20 px-1.5 py-0.5 rounded">llama-cpp</span>
              </div>
              <div className="space-y-1.5 font-sans text-[11px] text-ink-soft">
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="text-ink font-semibold">{health?.engine || "llama-cpp-python"}</span>
                </div>
                <div className="flex justify-between">
                  <span>LLM:</span>
                  <span className="text-ink font-semibold truncate max-w-[150px]">{setup?.language_model?.split("/")[1] || "Qwen 0.5B"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Embedding:</span>
                  <span className="text-ink font-semibold truncate max-w-[150px]">{setup?.embedding_model?.split("/")[1] || "BGE-Small"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Device:</span>
                  <span className="text-accent font-semibold">{health?.device?.toUpperCase() || "GPU"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hardware VRAM:</span>
                  <span className="text-ink font-semibold">{health?.gpu?.vram_total_mb ? `${Math.round(health.gpu.vram_total_mb)} MB` : "System RAM"}</span>
                </div>
                <div className="text-[10px] text-sage-deep font-sans pt-1.5 border-t border-line/60">
                  ✓ 100% Free · Zero API calls · Air-gapped capable
                </div>
              </div>
            </div>
          </div>

          <div className="hidden sm:block">
            <SetupChip />
          </div>

          <button
            type="button"
            onClick={onOpenHelp}
            className="p-2 rounded-lg text-ink hover:text-accent hover:bg-paper-raised transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            title="Open page guide and tips"
            aria-label="Open page guide"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Mobile hamburger button (< 1100px) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-[1100px]:hidden p-2 rounded-lg text-ink hover:text-accent hover:bg-paper-raised transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="min-[1100px]:hidden border-b border-line bg-paper-raised px-4 pt-2 pb-4 space-y-2">
          <div className="pb-2 border-b border-line sm:hidden">
            <span className="text-xs text-ink-soft block mb-1">Active Setup:</span>
            <SetupChip />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 text-base font-medium rounded-md transition-colors ${
                    isActive
                      ? "text-accent bg-paper font-semibold border-l-4 border-accent"
                      : "text-ink hover:text-accent hover:bg-paper"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};
