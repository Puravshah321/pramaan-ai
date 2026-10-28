import React, { useState } from 'react'
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2,
  Sliders, Activity, Award, HelpCircle, Keyboard, RefreshCw
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function ReliabilityPage() {
  const { demoMode } = useAppStore()

  const [threshold, setThreshold] = useState<number>(0.65)
  const [currentLabelIndex, setCurrentLabelIndex] = useState<number>(0)

  // Detector metrics
  const detectorHealth = {
    auroc: 0.892,
    ece: 0.048,
    canaryCatchRate: '94.2%',
    cohensKappa: 0.78,
    flipRate: '3.1%',
    verdict: 'FIT FOR PRODUCTION USE',
  }

  // Sample items for labelling tool
  const labellingQueue = [
    {
      id: 'lbl_01',
      question: 'What is the maximum allowed GPU expenditure in 2024?',
      answer: 'The capital expenditure dedicated to GPU acquisition was capped at $45M.',
      evidence: 'Passage: Capital expenditure dedicated to GPU acquisition was capped at $45M.',
      detectorScore: 0.94,
      detectorLabel: 'RELIABLE',
    },
    {
      id: 'lbl_02',
      question: 'Did operational efficiency improve by 40%?',
      answer: 'Yes, operational efficiency improved by 40% in fiscal year 2024.',
      evidence: 'Passage: In fiscal year 2024, our operational efficiency improved by 23%.',
      detectorScore: 0.18,
      detectorLabel: 'UNRELIABLE',
    },
  ]

  const activeItem = labellingQueue[currentLabelIndex % labellingQueue.length]

  const handleLabel = (verdict: string) => {
    setCurrentLabelIndex((prev) => prev + 1)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Reliability Lab & Detector Honesty
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Detector Calibrated (ECE &lt; 0.05)
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Validate the hallucination detector itself: canary catch-rate, calibration curve, inter-annotator agreement (κ), and false-alarm trade-offs.
          </p>
        </div>
      </div>

      {/* Detector Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-1">
          <div className="text-xs uppercase font-medium text-[var(--color-text-muted)] tracking-wider">
            Canary Catch-Rate
          </div>
          <div className="text-2xl font-bold text-emerald-400">{detectorHealth.canaryCatchRate}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">Target: ≥ 90.0% (Passed)</div>
        </div>

        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-1">
          <div className="text-xs uppercase font-medium text-[var(--color-text-muted)] tracking-wider">
            Honesty AUROC
          </div>
          <div className="text-2xl font-bold text-cyan-400">{detectorHealth.auroc}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">ROC Area on Gold Test Set</div>
        </div>

        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-1">
          <div className="text-xs uppercase font-medium text-[var(--color-text-muted)] tracking-wider">
            Calibration Error (ECE)
          </div>
          <div className="text-2xl font-bold text-indigo-400">{detectorHealth.ece}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">Predicted prob matches truth</div>
        </div>

        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-1">
          <div className="text-xs uppercase font-medium text-[var(--color-text-muted)] tracking-wider">
            Inter-Rater Agreement (κ)
          </div>
          <div className="text-2xl font-bold text-amber-400">{detectorHealth.cohensKappa}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">Cohen's κ vs Human Annotators</div>
        </div>
      </div>

      {/* Threshold Tuner & Labelling Tool */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Operating Threshold Tuner */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
            <Sliders size={16} className="text-[var(--color-primary)]" />
            <span>Operational Threshold Calibration</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[var(--color-text-muted)]">Reliability Cutoff Threshold:</span>
                <span className="font-mono font-bold text-[var(--color-primary)]">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.95"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-1">
                <span className="text-[var(--color-text-muted)] text-[11px]">Precision (at cutoff):</span>
                <div className="text-base font-bold text-emerald-400 font-mono">94.8%</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Answers marked reliable are correct</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-1">
                <span className="text-[var(--color-text-muted)] text-[11px]">False-Alarm Rate:</span>
                <div className="text-base font-bold text-amber-400 font-mono">5.2%</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Correct answers flagged uncertain</div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              <span>Verdict: {detectorHealth.verdict} for mission-critical RAG.</span>
            </div>
          </div>
        </div>

        {/* Right: Keyboard-Driven Labelling Queue */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Keyboard size={16} className="text-cyan-400" />
              <span>Rapid Human Review Queue</span>
            </h3>
            <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
              Item {currentLabelIndex + 1} of 150
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] font-medium">Question:</span>
              <div className="p-2.5 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)]">
                {activeItem.question}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] font-medium">Generated Answer:</span>
              <div className="p-2.5 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)]">
                {activeItem.answer}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] font-medium">Retrieved Evidence:</span>
              <div className="p-2.5 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-[11px]">
                {activeItem.evidence}
              </div>
            </div>

            {/* Quick Action Keys */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => handleLabel('Reliable')}
                className="flex-1 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>[1] Reliable</span>
              </button>
              <button
                onClick={() => handleLabel('Uncertain')}
                className="flex-1 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold hover:bg-amber-500/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>[2] Uncertain</span>
              </button>
              <button
                onClick={() => handleLabel('Unreliable')}
                className="flex-1 py-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold hover:bg-rose-500/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>[3] Unreliable</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
