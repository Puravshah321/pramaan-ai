import React, { useState } from 'react'
import {
  FolderOpen, Upload, FileText, Scissors, AlertCircle,
  CheckCircle2, Search, Eye, BarChart2, ShieldCheck
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function CorpusPage() {
  const { demoMode } = useAppStore()
  const [selectedCorpus, setSelectedCorpus] = useState('financial-reports-2024')
  const [chunkSize, setChunkSize] = useState<number>(512)
  const [chunkOverlap, setChunkOverlap] = useState<number>(10)
  const [strategy, setStrategy] = useState<string>('recursive')

  // Sample preview chunks with boundary-damage metric
  const sampleChunks = [
    {
      id: 'chk_001',
      doc: 'Annual_Report_2024.pdf',
      page: 1,
      tokens: 498,
      boundary_damage: 'None',
      boundary_score: 0.98,
      text: 'In fiscal year 2024, our operational efficiency improved by 23% following the migration of core inference workloads to quantized edge models. Gross revenue reached $412M, compared to $335M in fiscal year 2023.',
    },
    {
      id: 'chk_002',
      doc: 'Annual_Report_2024.pdf',
      page: 1,
      tokens: 510,
      boundary_damage: 'Minor (sentence-split preserved)',
      boundary_score: 0.94,
      text: 'Capital expenditure dedicated to GPU acquisition was capped at $45M. We prioritized high memory-bandwidth LPDDR5 systems to maximize token throughput per watt across distributed retail branches.',
    },
    {
      id: 'chk_003',
      doc: 'Annual_Report_2024.pdf',
      page: 2,
      tokens: 486,
      boundary_damage: 'None',
      boundary_score: 0.99,
      text: 'The risk management committee established a strict zero-hallucination tolerance policy for all public-facing automated advisory tools, requiring verification via automated natural language inference.',
    },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Corpus Management & Chunk Lab
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Ingest documents, configure chunking strategies, inspect boundary damage, and index for dense & hybrid retrieval.
          </p>
        </div>

        <button className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg">
          <Upload size={16} />
          <span>Upload Document (PDF / MD / TXT)</span>
        </button>
      </div>

      {/* Grid: Upload & Chunk Config vs Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Corpora List & Chunk Strategy */}
        <div className="space-y-6 lg:col-span-1">
          {/* Active Corpus Card */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <FolderOpen size={16} className="text-[var(--color-primary)]" />
              <span>Active Corpus</span>
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-[var(--color-text-muted)]">Select Corpus</label>
              <select
                value={selectedCorpus}
                onChange={(e) => setSelectedCorpus(e.target.value)}
                className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-xs rounded-lg p-2.5 font-medium"
              >
                <option value="financial-reports-2024">financial-reports-2024 (12 docs, 184 KB)</option>
                <option value="legal-contracts-rag">legal-contracts-rag (8 docs, 340 KB)</option>
                <option value="technical-manuals-v2">technical-manuals-v2 (15 docs, 520 KB)</option>
              </select>
            </div>

            <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-xs space-y-1">
              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>Dataset Hash:</span>
                <span className="font-mono text-[var(--color-text)]">d3a98f12...</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>Total Words:</span>
                <span className="font-mono text-[var(--color-text)]">42,850</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-muted)]">
                <span>Synthetic QA Pairs:</span>
                <span className="font-mono text-emerald-400">120 (Gold Verified)</span>
              </div>
            </div>
          </div>

          {/* Chunk Lab Controls */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Scissors size={16} className="text-indigo-400" />
              <span>Chunking Parameters</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--color-text-muted)]">Chunk Size:</span>
                  <span className="font-mono font-bold text-[var(--color-text)]">{chunkSize} tokens</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[128, 256, 512, 1024].map((size) => (
                    <button
                      key={size}
                      onClick={() => setChunkSize(size)}
                      className={`py-1.5 rounded text-xs font-mono transition-colors ${
                        chunkSize === size
                          ? 'bg-[var(--color-primary)] text-white font-semibold'
                          : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--color-text-muted)]">Overlap:</span>
                  <span className="font-mono font-bold text-[var(--color-text)]">{chunkOverlap}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="5"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="text-[var(--color-text-muted)] block mb-1">Strategy:</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] text-xs rounded-lg p-2 font-medium"
                >
                  <option value="recursive">Recursive (Preserves paragraphs & sentences)</option>
                  <option value="fixed-token">Fixed-Token (Exact token windowing)</option>
                  <option value="sentence-window">Sentence-Window (Centered target with neighbor context)</option>
                </select>
              </div>
            </div>

            {/* Boundary Damage Metric Warning */}
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Boundary Integrity: 97.4%</span>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  Recursive chunker at 512 tokens splits on structural boundaries without cutting numeric tables or sentences.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Chunks Preview Table & Inspector */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Eye size={16} className="text-cyan-400" />
              <span>Chunks Inspector ({sampleChunks.length} Sample Chunks Shown)</span>
            </h3>
            <span className="text-xs text-[var(--color-text-muted)]">Strategy: {strategy}</span>
          </div>

          <div className="space-y-3">
            {sampleChunks.map((chunk) => (
              <div
                key={chunk.id}
                className="p-4 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[var(--color-primary)] font-bold">{chunk.id}</span>
                    <span className="text-[var(--color-text-muted)]">[{chunk.doc} • Page {chunk.page}]</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-0.5 rounded font-mono text-[var(--color-text-muted)]">
                      {chunk.tokens} tokens
                    </span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-medium">
                      Integrity: {(chunk.boundary_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text)] leading-relaxed font-sans bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border)]/60">
                  {chunk.text}
                </p>

                <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2">
                  <span>Boundary damage check:</span>
                  <span className="text-emerald-400">{chunk.boundary_damage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
