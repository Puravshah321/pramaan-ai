import React from "react";
import { useLocation } from "react-router-dom";
import { X, BookOpen, Lightbulb } from "lucide-react";

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

const PAGE_TIPS: Record<string, { title: string; tips: string[] }> = {
  "/": {
    title: "Home Page Tips",
    tips: [
      "Pick your embedding and language models using live search from Hugging Face Hub.",
      "Click 'Run a quick check' to execute a verified benchmark across standard QA test questions.",
      "Check your live workspace metrics to see completed benchmarks.",
    ],
  },
  "/guide": {
    title: "Guide & Methodology Tips",
    tips: [
      "Review the RAG architecture diagram to understand retrieval vs. generation stages.",
      "Explore the glossary of terms like Top-K, chunk size, quantization, and AUROC.",
      "Learn what Reliable, Uncertain, and Unreliable status tags mean for answer trust.",
    ],
  },
  "/models": {
    title: "Models & Data Tips",
    tips: [
      "Compare up to 3 candidate models with live parameter counts, licenses, and route tags.",
      "Check estimated memory: parameters × 2 bytes for fp16.",
      "Use 'Test model' to trigger a live test inference and measure roundtrip latency.",
    ],
  },
  "/benchmark": {
    title: "Benchmark Planner Tips",
    tips: [
      "Select factorial sweep values for chunk sizes, Top-K, and quantizations.",
      "Review the live cost and duration estimate before launching.",
      "Watch real-time Server-Sent Events (SSE) stream question-by-question progress.",
    ],
  },
  "/results": {
    title: "Results Explorer Tips",
    tips: [
      "Inspect the sortable table showing Recall@K, Exact Match, F1, and p50/p95 latency.",
      "Switch to Trade-offs tab to see the Pareto frontier highlighting optimal configurations.",
      "Check the Reliability tab for detector AUROC and error rejection rates.",
    ],
  },
  "/recommend": {
    title: "Recommendation Tips",
    tips: [
      "Input your hardware memory cap (e.g. 4 GB) and maximum latency threshold.",
      "Select your goal: Best Quality, Balanced, Fastest, or Smallest.",
      "The recommendation engine strictly uses real measured data, never guesswork.",
    ],
  },
  "/try-it": {
    title: "Try It Playground Tips",
    tips: [
      "Ask any question against your indexed documents and view retrieved chunks with similarity scores.",
      "Inspect stage-by-stage timings for embedding, search, and generation.",
      "Examine the reliability badge with signal explanations (lexical support, similarity margin).",
    ],
  },
};

export const HelpDrawer: React.FC<HelpDrawerProps> = ({ isOpen, onClose, onStartTour }) => {
  const location = useLocation();
  if (!isOpen) return null;

  const currentInfo = PAGE_TIPS[location.pathname] || {
    title: "Page Guide",
    tips: ["Explore Pramaan AI's empirical benchmarking tools."],
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/30 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-paper border-l border-line p-6 flex flex-col h-full shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line mb-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-accent" />
            <h3 className="font-serif text-lg font-bold text-ink">{currentInfo.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink hover:text-accent hover:bg-paper-raised"
            aria-label="Close help drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="card-paper p-4 border border-line bg-paper-raised">
            <h4 className="font-semibold text-sm text-ink mb-2">Tips for this page:</h4>
            <ul className="space-y-2 text-sm text-ink-soft">
              {currentInfo.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-accent font-bold">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {onStartTour && (
            <div className="card-paper p-4 border border-line bg-paper-raised mt-6">
              <h4 className="font-semibold text-sm text-ink mb-1">New to Pramaan AI?</h4>
              <p className="text-xs text-ink-soft mb-3">
                Take the interactive 2-minute walkthrough covering setup, benchmarking, and reliability.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartTour();
                }}
                className="btn-secondary w-full text-xs"
              >
                <BookOpen className="w-4 h-4" />
                <span>Launch Welcome Tour</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
