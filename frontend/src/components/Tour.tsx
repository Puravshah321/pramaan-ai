import React, { useState } from "react";
import { X, ArrowRight, ArrowLeft, Check } from "lucide-react";

interface TourProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOUR_STEPS = [
  {
    step: 1,
    title: "1. What is Pramaan AI?",
    text: "Pramaan AI is an empirical benchmark and reliability decision platform for Retrieval-Augmented Generation (RAG) on resource-constrained hardware. It measures real trade-offs rather than using guesswork.",
  },
  {
    step: 2,
    title: "2. What do the settings mean?",
    text: "RAG depends on chunk sizes, retrieval Top-K, vector embeddings, and LLM quantizations. Each choice alters accuracy (F1, EM), memory footprint, and latency. Pramaan tests these factorial factors.",
  },
  {
    step: 3,
    title: "3. How do I run and read a benchmark?",
    text: "Select your candidate models and sweep factors on the Benchmark page. Watch live progress stream via Server-Sent Events, and review the Pareto frontier to find setups that maximize quality per watt.",
  },
  {
    step: 4,
    title: "4. How do I trust an answer?",
    text: "Our multi-signal reliability detector analyzes retrieval similarity, context gap, and lexical grounding. Every answer is classified as Reliable, Uncertain, or Unreliable with clear explanatory reasons.",
  },
];

export const Tour: React.FC<TourProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const current = TOUR_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="card-paper p-6 max-w-lg w-full border border-line bg-paper-raised relative shadow-xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-soft hover:text-accent hover:bg-paper"
          aria-label="Skip tour"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step Indicator */}
        <div className="text-xs font-mono font-semibold text-accent mb-2">
          Step {current.step} of {TOUR_STEPS.length}
        </div>

        <h3 className="font-serif text-xl font-bold text-ink mb-3">{current.title}</h3>
        <p className="text-ink-soft text-sm leading-relaxed mb-6">{current.text}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-ink-soft hover:text-accent underline"
          >
            Skip walkthrough
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="btn-primary text-xs px-4 py-1.5"
            >
              <span>{currentStep === TOUR_STEPS.length - 1 ? "Finish" : "Next"}</span>
              {currentStep === TOUR_STEPS.length - 1 ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
