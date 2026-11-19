import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../api/client";

export const Footer: React.FC = () => {
  const { data: health, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15000,
  });

  const backendOk = !isError && health?.status === "ok";
  const hfOk = health?.huggingface?.reachable ?? false;

  return (
    <footer className="w-full bg-[#141210] text-paper border-t border-line/20 py-10">
      <div className="max-w-[1160px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Brand, Links & Licence */}
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap text-sm">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="w-4 h-4 bg-accent rounded-xs inline-flex items-center justify-center text-paper text-[10px] font-bold">
              ◼
            </span>
            <span className="font-serif font-bold text-paper text-base">
              Pramaan AI
            </span>
          </Link>

          <span className="hidden sm:inline text-sage/40">|</span>

          <nav className="flex items-center gap-4 text-xs font-medium text-sage">
            <Link to="/guide" className="hover:text-paper transition-colors">
              Guide
            </Link>
            <Link to="/guide#methodology" className="hover:text-paper transition-colors">
              Methodology
            </Link>
            <a
              href="https://github.com/Puravshah321/pramaan-ai"
              target="_blank"
              rel="noreferrer"
              className="hover:text-paper transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://huggingface.co"
              target="_blank"
              rel="noreferrer"
              className="hover:text-paper transition-colors"
            >
              Hugging Face
            </a>
          </nav>

          <span className="hidden sm:inline text-sage/40">|</span>
          <span className="text-xs text-sage/70">MIT Licence</span>
        </div>

        {/* Right: Live Local Engine Status indicator */}
        <div className="flex items-center gap-3 text-xs font-mono bg-[#201D1A] px-3.5 py-1.5 rounded-full border border-line/20 text-paper">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${backendOk ? "bg-sage-deep" : "bg-accent"}`}
            />
            <span className="text-sage">Backend: {backendOk ? "Online" : "Offline"}</span>
          </div>

          <span className="text-sage/40">/</span>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sage-deep" />
            <span className="text-sage">Runner: Local (llama-cpp)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
