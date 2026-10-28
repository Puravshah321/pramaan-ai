import React, { useState } from 'react'
import {
  MessageSquare, Send, ShieldCheck, AlertTriangle, XCircle,
  Clock, Cpu, Layers, Sparkles, SlidersHorizontal, ChevronRight,
  GitCompare, ArrowRight
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function PlaygroundPage() {
  const { activeHardware, demoMode } = useAppStore()

  const [question, setQuestion] = useState(
    'What was the reported capital expenditure on GPU acquisition in fiscal year 2024?'
  )
  const [chunkSize, setChunkSize] = useState<number>(512)
  const [topK, setTopK] = useState<number>(5)
  const [model, setModel] = useState<string>('Qwen2.5-1.5B-Instruct')
  const [quant, setQuant] = useState<string>('Q4_K_M')
  const [isAbMode, setIsAbMode] = useState<boolean>(false)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  // Verdict state
  const verdict = {
    label: 'RELIABLE',
    score: 0.94,
    status: 'reliable', // 'reliable' | 'uncertain' | 'unreliable'
    explanation: 'Every factual claim is directly corroborated by retrieved Passage 1 and Passage 2.',
  }

  // Timing waterfall breakdown
  const timings = {
    embed_ms: 18,
    retrieval_ms: 14,
    prompt_prep_ms: 4,
    generation_ms: 320,
    total_ms: 356,
  }

  // Retrieved evidence with similarity bars
  const evidence = [
    {
      rank: 1,
      doc: 'Annual_Report_2024.pdf (Page 1)',
      sim: 0.89,
      text: 'Capital expenditure dedicated to GPU acquisition was capped at $45M. We prioritized high memory-bandwidth LPDDR5 systems to maximize token throughput per watt across distributed retail branches.',
      supported: true,
    },
    {
      rank: 2,
      doc: 'Annual_Report_2024.pdf (Page 1)',
      sim: 0.81,
      text: 'In fiscal year 2024, our operational efficiency improved by 23% following the migration of core inference workloads to quantized edge models. Gross revenue reached $412M.',
      supported: false,
    },
  ]

  const handleSend = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
    }, 600)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Title & Mode switch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Interactive RAG Playground
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Test arbitrary queries against configured pipelines with live evidence grounding, reliability verdict banner, and timing waterfalls.
          </p>
        </div>

        <button
          onClick={() => setIsAbMode(!isAbMode)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
            isAbMode
              ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
              : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <GitCompare size={14} />
          <span>A/B Comparison Mode {isAbMode ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Grid: Config Panel vs Query & Evidence Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration & Resource Cap Check */}
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-[var(--color-primary)]" />
              <span>Pipeline Configuration</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[var(--color-text-muted)] block mb-1">Model & Quantization:</label>
                <div className="space-y-2">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-2 text-[var(--color-text)] font-medium"
                  >
                    <option value="Qwen2.5-1.5B-Instruct">Qwen2.5-1.5B-Instruct</option>
                    <option value="Llama-3.2-1B-Instruct">Llama-3.2-1B-Instruct</option>
                    <option value="Qwen2.5-3B-Instruct">Qwen2.5-3B-Instruct</option>
                  </select>

                  <select
                    value={quant}
                    onChange={(e) => setQuant(e.target.value)}
                    className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-2 text-[var(--color-text)] font-medium"
                  >
                    <option value="Q4_K_M">Q4_K_M (Recommended 4-bit)</option>
                    <option value="Q8_0">Q8_0 (8-bit High Fidelity)</option>
                    <option value="Q2_K">Q2_K (2-bit Extreme Low VRAM)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--color-text-muted)]">Chunk Size:</span>
                  <span className="font-mono text-[var(--color-text)] font-semibold">{chunkSize} tokens</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[256, 512, 1024].map((s) => (
                    <button
                      key={s}
                      onClick={() => setChunkSize(s)}
                      className={`py-1 rounded text-xs font-mono transition-colors ${
                        chunkSize === s
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--color-text-muted)]">Top-K Passages:</span>
                  <span className="font-mono text-[var(--color-text)] font-semibold">{topK}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Live Resource Estimation */}
            <div className="pt-3 border-t border-[var(--color-border)] text-xs space-y-2">
              <span className="text-[var(--color-text-muted)] font-medium">Live Resource Footprint:</span>
              <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Est. Peak VRAM:</span>
                  <span className="text-emerald-400 font-mono font-bold">2.14 GB / 4.0 GB Cap</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Est. Latency:</span>
                  <span className="text-indigo-400 font-mono font-bold">~350 ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timing Waterfall */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Clock size={16} className="text-cyan-400" />
              <span>Timing Waterfall ({timings.total_ms} ms)</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-1">
                  <span>Embedding Query</span>
                  <span className="font-mono">{timings.embed_ms} ms</span>
                </div>
                <div className="w-full bg-[var(--color-surface-raised)] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full" style={{ width: '5%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-1">
                  <span>Vector Search (FAISS Flat)</span>
                  <span className="font-mono">{timings.retrieval_ms} ms</span>
                </div>
                <div className="w-full bg-[var(--color-surface-raised)] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: '4%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-1">
                  <span>LLM Generation (Greedy T=0)</span>
                  <span className="font-mono">{timings.generation_ms} ms</span>
                </div>
                <div className="w-full bg-[var(--color-surface-raised)] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[var(--color-primary)] h-full rounded-full" style={{ width: '90%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center & Right: Prompt, Answer & Evidence Grounding */}
        <div className="lg:col-span-2 space-y-6">
          {/* Query Bar */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about the uploaded corpus..."
                className="flex-1 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <button
                onClick={handleSend}
                disabled={isGenerating}
                className="btn-primary px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Send size={14} />
                <span>Run</span>
              </button>
            </div>
          </div>

          {/* Verdict Banner */}
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-start gap-3">
            <ShieldCheck size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wide">
                  Reliability Verdict: {verdict.label}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Confidence: {(verdict.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                {verdict.explanation}
              </p>
            </div>
          </div>

          {/* Generated Answer Display */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--color-primary)]" />
                <span>Generated Answer (Greedy Decoding)</span>
              </span>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                Seed: 42 • Hash: 8f2a1b9c
              </span>
            </div>

            <div className="text-xs text-[var(--color-text)] leading-relaxed p-4 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
              In fiscal year 2024, the capital expenditure dedicated to GPU acquisition was capped at{' '}
              <span className="bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-semibold border border-emerald-500/30" title="Corroborated by Passage 1">
                $45M
              </span>
              . High memory-bandwidth LPDDR5 systems were prioritized to optimize token throughput per watt across distributed retail branches.
            </div>
          </div>

          {/* Evidence Panel with Similarity Bars & Claim Highlighting */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-2">
                <Layers size={14} className="text-indigo-400" />
                <span>Retrieved Evidence ({evidence.length} Passages)</span>
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-mono">Cosine Similarity</span>
            </div>

            <div className="space-y-3">
              {evidence.map((item) => (
                <div
                  key={item.rank}
                  className={`p-3.5 rounded-lg border text-xs space-y-2 transition-all ${
                    item.supported
                      ? 'bg-[var(--color-surface-raised)] border-emerald-500/30'
                      : 'bg-[var(--color-surface-raised)] border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-[var(--color-primary)]">Passage #{item.rank}</span>
                      <span className="text-[var(--color-text-muted)] text-[11px]">[{item.doc}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        Sim: {item.sim}
                      </span>
                      {item.supported && (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">
                          Grounding Source
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
