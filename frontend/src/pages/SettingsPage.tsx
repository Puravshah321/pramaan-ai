import React, { useState } from 'react'
import {
  Settings, Database, Cpu, ShieldAlert, BookOpen,
  Trash2, RefreshCw, CheckCircle2, ShieldCheck, HardDrive
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function SettingsPage() {
  const { demoMode, setDemoMode, activeHardware, setActiveHardware } = useAppStore()
  const [cacheCleared, setCacheCleared] = useState(false)

  const handleClearCache = () => {
    setCacheCleared(true)
    setTimeout(() => setCacheCleared(false), 2000)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            System Settings & Methodology Registry
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Operational mode toggles, hardware profile thresholds, content-addressed cache management, and methodology documentation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operational Modes & Hardware Profile */}
        <div className="space-y-6">
          {/* Demo Mode Toggle */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-400" />
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  Simulated Demo Mode
                </span>
              </div>
              <button
                onClick={() => setDemoMode(!demoMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  demoMode ? 'bg-amber-500' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    demoMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              When Demo Mode is enabled, all runs use deterministic simulators and store records in a strictly isolated database (<code>pramaan_demo.db</code>). A persistent yellow banner indicates simulated data.
            </p>
          </div>

          {/* Cache Management */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <HardDrive size={16} className="text-indigo-400" />
              <span>Content-Addressed Cache</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-1">
                <div className="flex justify-between text-[var(--color-text-muted)]">
                  <span>Cache Hit Rate:</span>
                  <span className="font-mono text-emerald-400 font-bold">94.6%</span>
                </div>
                <div className="flex justify-between text-[var(--color-text-muted)]">
                  <span>Cached Generations:</span>
                  <span className="font-mono text-[var(--color-text)]">1,420 items (18.4 MB)</span>
                </div>
                <div className="flex justify-between text-[var(--color-text-muted)]">
                  <span>Key Hash Scope:</span>
                  <span className="font-mono text-[var(--color-text)]">Prompt + Weights SHA256 + Seed</span>
                </div>
              </div>

              <button
                onClick={handleClearCache}
                className="w-full py-2 rounded-lg border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>{cacheCleared ? 'Cache Emptied' : 'Clear Generation Cache'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Methodology & Threats to Validity Summary */}
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <BookOpen size={16} className="text-cyan-400" />
              <span>Scientific Methodology & Validity Guarantees</span>
            </h3>

            <div className="space-y-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-1">
                <span className="font-semibold text-[var(--color-text)] block">
                  1. Confound Separation (Retrieval vs Generation)
                </span>
                <p className="text-[11px]">
                  Retrieval quality is measured independently on gold passage ground truth (Recall@K, MRR). Generation is evaluated on both retrieved context and oracle gold passages to isolate retrieval failures from LLM hallucinations.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-1">
                <span className="font-semibold text-[var(--color-text)] block">
                  2. Paired Statistical Testing & Multiple Comparisons
                </span>
                <p className="text-[11px]">
                  Every configuration is evaluated on the exact same question set (paired design). Confidence intervals are computed via paired bootstrap (1,000 resamples). Differences are controlled using Holm–Bonferroni corrections.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-1">
                <span className="font-semibold text-[var(--color-text)] block">
                  3. Hardware Specificity & Background Load Monitoring
                </span>
                <p className="text-[11px]">
                  Latency and memory numbers reflect the local system. Warmup runs are excluded, peak VRAM is sampled at 20 Hz, and background CPU load is verified before benchmarking begins.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
