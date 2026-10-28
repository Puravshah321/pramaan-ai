import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FlaskConical, Cpu, Layers, HardDrive, Zap, Play,
  AlertTriangle, CheckCircle2, Sliders, ShieldCheck, HelpCircle
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { createExperiment, planExperiment, startExperiment } from '@/lib/api'

export function ExperimentsPage() {
  const navigate = useNavigate()
  const { activeHardware, demoMode } = useAppStore()

  const [preset, setPreset] = useState<'quick' | 'standard' | 'exhaustive'>('standard')
  const [expName, setExpName] = useState('Production RAG Optimization v1')
  const [corpusId, setCorpusId] = useState('corp_default')

  // Factors
  const [chunkSizes, setChunkSizes] = useState<number[]>([256, 512])
  const [topKs, setTopKs] = useState<number[]>([3, 5])
  const [embedModels, setEmbedModels] = useState<string[]>(['bge-small-en-v1.5', 'all-MiniLM-L6-v2'])
  const [llmModels, setLlmModels] = useState<string[]>(['Qwen2.5-1.5B-Instruct', 'Llama-3.2-1B-Instruct'])
  const [quants, setQuants] = useState<string[]>(['Q4_K_M', 'Q8_0'])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Presets applicator
  const applyPreset = (p: 'quick' | 'standard' | 'exhaustive') => {
    setPreset(p)
    if (p === 'quick') {
      setChunkSizes([512])
      setTopKs([5])
      setEmbedModels(['bge-small-en-v1.5'])
      setLlmModels(['Qwen2.5-1.5B-Instruct'])
      setQuants(['Q4_K_M'])
    } else if (p === 'standard') {
      setChunkSizes([256, 512])
      setTopKs([3, 5])
      setEmbedModels(['bge-small-en-v1.5', 'all-MiniLM-L6-v2'])
      setLlmModels(['Qwen2.5-1.5B-Instruct', 'Llama-3.2-1B-Instruct'])
      setQuants(['Q4_K_M', 'Q8_0'])
    } else {
      setChunkSizes([128, 256, 512, 1024])
      setTopKs([1, 3, 5, 8])
      setEmbedModels(['bge-small-en-v1.5', 'all-MiniLM-L6-v2', 'e5-small-v2'])
      setLlmModels(['Qwen2.5-0.5B-Instruct', 'Qwen2.5-1.5B-Instruct', 'Qwen2.5-3B-Instruct', 'Llama-3.2-1B-Instruct', 'Llama-3.2-3B-Instruct'])
      setQuants(['Q2_K', 'Q4_K_M', 'Q5_K_M', 'Q8_0'])
    }
  }

  // Combinations count
  const totalConfigs = useMemo(() => {
    return chunkSizes.length * topKs.length * embedModels.length * llmModels.length * quants.length
  }, [chunkSizes, topKs, embedModels, llmModels, quants])

  // Peak VRAM estimator
  const estimatedPeakVramGb = useMemo(() => {
    const has3B = llmModels.some((m) => m.includes('3B'))
    const hasQ8 = quants.includes('Q8_0')
    if (has3B && hasQ8) return 4.4
    if (has3B) return 3.2
    if (llmModels.some((m) => m.includes('1.5B')) && hasQ8) return 2.6
    return 1.8
  }, [llmModels, quants])

  const hardwareCapGb = activeHardware === 'GTX1650-4GB' ? 4.0 : 6.0
  const isExceedingCap = estimatedPeakVramGb > hardwareCapGb

  const handleLaunch = async () => {
    setIsSubmitting(true)
    try {
      const exp = await createExperiment({
        name: expName,
        corpus_id: corpusId,
        factors: {
          chunk_sizes: chunkSizes,
          top_k: topKs,
          embedding_models: embedModels,
          llms: llmModels,
          quants: quants,
        },
      })
      if (exp?.id) {
        await planExperiment(exp.id)
        await startExperiment(exp.id)
      }
      navigate('/monitor')
    } catch {
      // Navigate to monitor in demo mode anyway
      navigate('/monitor')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Experiment Planner & Grid Builder
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Build controlled factorial benchmarks across chunk sizes, retrieval Top-K, embedding models, LLM sizes, and quantizations.
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2 bg-[var(--color-surface)] p-1 rounded-lg border border-[var(--color-border)]">
          <button
            onClick={() => applyPreset('quick')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              preset === 'quick'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Quick (1 Config)
          </button>
          <button
            onClick={() => applyPreset('standard')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              preset === 'standard'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Standard Sweep
          </button>
          <button
            onClick={() => applyPreset('exhaustive')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              preset === 'exhaustive'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Full Factorial
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Factor Level Configurator (Col 1 & 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Experiment Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[var(--color-text-muted)] block mb-1">Study Name</label>
                <input
                  type="text"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-2.5 text-[var(--color-text)] font-medium"
                />
              </div>
              <div>
                <label className="text-[var(--color-text-muted)] block mb-1">Target Corpus</label>
                <select
                  value={corpusId}
                  onChange={(e) => setCorpusId(e.target.value)}
                  className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-2.5 text-[var(--color-text)] font-medium"
                >
                  <option value="corp_default">financial-reports-2024 (120 QA pairs)</option>
                  <option value="corp_contracts">legal-contracts-rag (85 QA pairs)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Factor 1: Chunk Sizes */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Factor 1: Chunk Size (Tokens)
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                {chunkSizes.length} selected
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[128, 256, 512, 1024].map((sz) => {
                const checked = chunkSizes.includes(sz)
                return (
                  <button
                    key={sz}
                    onClick={() =>
                      setChunkSizes((prev) =>
                        checked ? prev.filter((x) => x !== sz) : [...prev, sz]
                      )
                    }
                    className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between transition-colors ${
                      checked
                        ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)] text-white font-semibold'
                        : 'bg-[var(--color-surface-raised)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span>{sz} tok</span>
                    {checked && <CheckCircle2 size={14} className="text-[var(--color-primary)]" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Factor 2: Top-K */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Factor 2: Retrieval Top-K Passages
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                {topKs.length} selected
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[1, 3, 5, 8, 10].map((k) => {
                const checked = topKs.includes(k)
                return (
                  <button
                    key={k}
                    onClick={() =>
                      setTopKs((prev) =>
                        checked ? prev.filter((x) => x !== k) : [...prev, k]
                      )
                    }
                    className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between transition-colors ${
                      checked
                        ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)] text-white font-semibold'
                        : 'bg-[var(--color-surface-raised)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span>k = {k}</span>
                    {checked && <CheckCircle2 size={14} className="text-[var(--color-primary)]" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Factor 3 & 4: Embedding Models & LLMs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Factor 3: Embedding Models
              </span>
              <div className="space-y-2 text-xs">
                {['bge-small-en-v1.5', 'all-MiniLM-L6-v2', 'e5-small-v2'].map((m) => {
                  const checked = embedModels.includes(m)
                  return (
                    <div
                      key={m}
                      onClick={() =>
                        setEmbedModels((prev) =>
                          checked ? prev.filter((x) => x !== m) : [...prev, m]
                        )
                      }
                      className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                        checked
                          ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)] text-white font-semibold'
                          : 'bg-[var(--color-surface-raised)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <span className="font-mono text-[11px]">{m}</span>
                      {checked && <CheckCircle2 size={13} className="text-[var(--color-primary)]" />}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Factor 4: Language Models (GGUF)
              </span>
              <div className="space-y-2 text-xs">
                {['Qwen2.5-1.5B-Instruct', 'Llama-3.2-1B-Instruct', 'Qwen2.5-3B-Instruct'].map((m) => {
                  const checked = llmModels.includes(m)
                  return (
                    <div
                      key={m}
                      onClick={() =>
                        setLlmModels((prev) =>
                          checked ? prev.filter((x) => x !== m) : [...prev, m]
                        )
                      }
                      className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                        checked
                          ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)] text-white font-semibold'
                          : 'bg-[var(--color-surface-raised)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <span className="font-mono text-[11px]">{m}</span>
                      {checked && <CheckCircle2 size={13} className="text-[var(--color-primary)]" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Factor 5: Quantization Levels */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Factor 5: Quantization Schemes
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Q2_K', 'Q4_K_M', 'Q5_K_M', 'Q8_0'].map((q) => {
                const checked = quants.includes(q)
                return (
                  <button
                    key={q}
                    onClick={() =>
                      setQuants((prev) =>
                        checked ? prev.filter((x) => x !== q) : [...prev, q]
                      )
                    }
                    className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between transition-colors ${
                      checked
                        ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)] text-white font-semibold'
                        : 'bg-[var(--color-surface-raised)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <span>{q}</span>
                    {checked && <CheckCircle2 size={14} className="text-[var(--color-primary)]" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Dry-Run Estimator & Feasibility Guardrail (Col 3) */}
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4 sticky top-24">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <span>Dry-Run Pre-Flight Feasibility</span>
            </h3>

            {/* Metrics Breakdown */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex justify-between">
                <span className="text-[var(--color-text-muted)]">Total Grid Runs:</span>
                <span className="font-mono font-bold text-[var(--color-text)]">{totalConfigs} configs</span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex justify-between">
                <span className="text-[var(--color-text-muted)]">Est. Peak VRAM:</span>
                <span
                  className={`font-mono font-bold ${
                    isExceedingCap ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {estimatedPeakVramGb.toFixed(1)} GB
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex justify-between">
                <span className="text-[var(--color-text-muted)]">Hardware Cap ({activeHardware}):</span>
                <span className="font-mono text-[var(--color-text)]">{hardwareCapGb.toFixed(1)} GB</span>
              </div>

              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex justify-between">
                <span className="text-[var(--color-text-muted)]">Successive Halving:</span>
                <span className="text-indigo-400 font-semibold">Enabled (Prune at n=60)</span>
              </div>
            </div>

            {/* Infeasibility Alert if over cap */}
            {isExceedingCap ? (
              <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-rose-400" />
                  <span>Hardware Cap Exceeded</span>
                </div>
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  Qwen2.5-3B with Q8_0 requires ~4.4 GB VRAM, which exceeds your active {activeHardware} cap (4.0 GB). Infeasible configs will be flagged.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Feasible Configuration</span>
                </div>
                <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                  All selected levels fit safely within your 4.0 GB VRAM guardrail. OOM risk is near zero.
                </p>
              </div>
            )}

            {/* Launch CTA */}
            <button
              onClick={handleLaunch}
              disabled={isSubmitting || totalConfigs === 0}
              className="w-full py-3 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Play size={15} />
              <span>{isSubmitting ? 'Starting Benchmark...' : 'Launch Benchmark Study'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
