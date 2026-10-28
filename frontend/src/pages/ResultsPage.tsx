import React, { useState } from 'react'
import {
  BarChart3, Filter, ArrowUpDown, CheckCircle2, ShieldCheck,
  TrendingDown, TrendingUp, Layers, Cpu, Clock, HelpCircle,
  GitBranch, Eye, Scale
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function ResultsPage() {
  const { demoMode, activeHardware } = useAppStore()
  const [filterModel, setFilterModel] = useState<string>('all')
  const [filterQuant, setFilterQuant] = useState<string>('all')

  // Sample factorial run results with paired bootstrap 95% CIs
  const results = [
    {
      id: 'cfg_opt_1',
      model: 'Qwen2.5-1.5B',
      quant: 'Q4_K_M',
      chunk: 512,
      topK: 5,
      embed: 'bge-small',
      recall_ci: '0.912 [0.884–0.938]',
      f1_ci: '0.742 [0.698–0.782]',
      peak_vram_gb: 2.4,
      p95_latency_ms: 388,
      is_pareto: true,
      stat_tied: true,
    },
    {
      id: 'cfg_opt_2',
      model: 'Qwen2.5-1.5B',
      quant: 'Q8_0',
      chunk: 512,
      topK: 5,
      embed: 'bge-small',
      recall_ci: '0.912 [0.884–0.938]',
      f1_ci: '0.751 [0.706–0.790]',
      peak_vram_gb: 3.1,
      p95_latency_ms: 450,
      is_pareto: false,
      stat_tied: true,
    },
    {
      id: 'cfg_opt_3',
      model: 'Llama-3.2-1B',
      quant: 'Q4_K_M',
      chunk: 512,
      topK: 5,
      embed: 'bge-small',
      recall_ci: '0.912 [0.884–0.938]',
      f1_ci: '0.718 [0.672–0.759]',
      peak_vram_gb: 1.9,
      p95_latency_ms: 310,
      is_pareto: true,
      stat_tied: false,
    },
    {
      id: 'cfg_opt_4',
      model: 'Qwen2.5-3B',
      quant: 'Q4_K_M',
      chunk: 512,
      topK: 5,
      embed: 'bge-small',
      recall_ci: '0.912 [0.884–0.938]',
      f1_ci: '0.784 [0.741–0.824]',
      peak_vram_gb: 3.6,
      p95_latency_ms: 620,
      is_pareto: true,
      stat_tied: false,
    },
    {
      id: 'cfg_opt_5',
      model: 'Qwen2.5-3B',
      quant: 'Q8_0',
      chunk: 512,
      topK: 5,
      embed: 'bge-small',
      recall_ci: '0.912 [0.884–0.938]',
      f1_ci: '0.792 [0.752–0.831]',
      peak_vram_gb: 4.6,
      p95_latency_ms: 780,
      is_pareto: false,
      infeasible: true, // exceeds 4.0 GB cap
    },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Results Explorer & Statistical CIs
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Paired Bootstrap (n=300, α=0.05)
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Compare all RAG factor combinations with honest confidence intervals, multiple-testing control (Holm–Bonferroni), and trade-off exchange rates.
          </p>
        </div>
      </div>

      {/* Exchange Rate Highlight Card */}
      <div className="p-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
            <Scale size={16} />
            <span>Key Research Insight: Quantization Exchange-Rate</span>
          </div>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">Causal Analysis (OFAT)</span>
        </div>
        <p className="text-xs text-[var(--color-text)] leading-relaxed">
          Switching from <strong>Qwen2.5-3B (Q4_K_M)</strong> to <strong>Qwen2.5-1.5B (Q4_K_M)</strong>:
          <span className="text-emerald-400 font-semibold ml-1">saves 1.2 GB VRAM (−33%)</span> and{' '}
          <span className="text-emerald-400 font-semibold">cuts latency by 232 ms (−37%)</span>, at a modest loss of{' '}
          <span className="text-amber-400 font-semibold">4.2 F1 points [95% CI: 2.1–6.4]</span>.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
        <div className="flex items-center gap-3">
          <Filter size={15} className="text-[var(--color-primary)]" />
          <span className="font-semibold text-[var(--color-text)]">Filters:</span>

          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md px-2.5 py-1 text-[var(--color-text)] font-medium"
          >
            <option value="all">All Models</option>
            <option value="Qwen2.5-1.5B">Qwen2.5-1.5B</option>
            <option value="Llama-3.2-1B">Llama-3.2-1B</option>
            <option value="Qwen2.5-3B">Qwen2.5-3B</option>
          </select>

          <select
            value={filterQuant}
            onChange={(e) => setFilterQuant(e.target.value)}
            className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md px-2.5 py-1 text-[var(--color-text)] font-medium"
          >
            <option value="all">All Quants</option>
            <option value="Q4_K_M">Q4_K_M</option>
            <option value="Q8_0">Q8_0</option>
          </select>
        </div>

        <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Statistically tied configs share a badge</span>
        </div>
      </div>

      {/* Results Table with Virtualized Styling */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-3.5">Config ID</th>
                <th className="p-3.5">Pipeline Factors</th>
                <th className="p-3.5">Recall@K (95% CI)</th>
                <th className="p-3.5">Answer F1 (95% CI)</th>
                <th className="p-3.5">Peak VRAM</th>
                <th className="p-3.5">Latency (p95)</th>
                <th className="p-3.5 text-right">Status / Pareto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] font-mono">
              {results.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[var(--color-surface-raised)]/60 transition-colors ${
                    row.infeasible ? 'opacity-50 bg-rose-500/5' : ''
                  }`}
                >
                  <td className="p-3.5 font-bold text-[var(--color-text)]">
                    {row.id}
                  </td>
                  <td className="p-3.5 font-sans">
                    <div className="font-semibold text-[var(--color-text)]">
                      {row.model} ({row.quant})
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
                      Chunk: {row.chunk} tok • k={row.topK} • {row.embed}
                    </div>
                  </td>
                  <td className="p-3.5 text-emerald-400 font-semibold">
                    {row.recall_ci}
                  </td>
                  <td className="p-3.5">
                    <span className="font-semibold text-cyan-300">{row.f1_ci}</span>
                    {row.stat_tied && (
                      <span className="ml-2 text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-sans font-medium" title="Not statistically distinguishable under Holm-Bonferroni test">
                        TIED
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`font-semibold ${
                        row.peak_vram_gb > 4.0 ? 'text-rose-400' : 'text-[var(--color-text)]'
                      }`}
                    >
                      {row.peak_vram_gb.toFixed(1)} GB
                    </span>
                  </td>
                  <td className="p-3.5 text-[var(--color-text-muted)]">
                    {row.p95_latency_ms} ms
                  </td>
                  <td className="p-3.5 text-right font-sans">
                    {row.infeasible ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        Exceeds 4GB Cap
                      </span>
                    ) : row.is_pareto ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Pareto Optimal
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--color-text-muted)]">Dominated</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
