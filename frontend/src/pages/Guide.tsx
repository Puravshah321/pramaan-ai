import React, { useState } from "react";
import { GLOSSARY } from "../lib/glossary";
import { ReliabilityBadge } from "../components/ReliabilityBadge";
import { Search } from "lucide-react";

export const Guide: React.FC = () => {
  const [glossaryQuery, setGlossaryQuery] = useState("");

  const filteredGlossary = Object.entries(GLOSSARY).filter(([term, desc]) => {
    const q = glossaryQuery.toLowerCase();
    return term.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-12">
      {/* Page Header */}
      <div>
        <h1 className="font-serif text-[44px] font-bold text-ink leading-tight mb-2">
          Guide
        </h1>
        <p className="text-ink-soft text-base max-w-[70ch]">
          Plain-English reference on RAG pipeline architecture, experimental factors, reliability detection, and metric provenance.
        </p>
      </div>

      {/* Section 1: What is RAG with SVG diagram with arrows on every connector */}
      <section id="what-is-rag" className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <h2 className="font-serif text-2xl font-bold text-ink">1. What is RAG?</h2>
        <p className="text-ink-soft text-sm leading-relaxed max-w-[70ch]">
          Retrieval-Augmented Generation (RAG) grounds language model answers in external documents. Rather than relying on an LLM's parametric memory, the pipeline retrieves relevant text chunks and supplies them as prompt context.
        </p>

        {/* SVG Diagram with arrows on every connector */}
        <div className="w-full overflow-x-auto py-4 bg-paper rounded-lg border border-line p-4">
          <svg viewBox="0 0 800 220" className="w-full max-w-[800px] mx-auto text-ink font-mono text-xs">
            {/* User Query */}
            <rect x="20" y="80" width="120" height="50" rx="8" fill="#F8F2E6" stroke="#D9CCB4" strokeWidth="1.5" />
            <text x="80" y="105" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">User Query</text>

            <path d="M 140 105 L 185 105" stroke="#1F1B16" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Embedding */}
            <rect x="190" y="80" width="130" height="50" rx="8" fill="#9DBDB8" fillOpacity="0.3" stroke="#3D7A70" strokeWidth="1.5" />
            <text x="255" y="100" textAnchor="middle" fontWeight="bold">Dense Embedder</text>
            <text x="255" y="118" textAnchor="middle" fill="#5E574C" fontSize="10">vector space</text>

            <path d="M 320 105 L 365 105" stroke="#1F1B16" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Vector DB / FAISS */}
            <rect x="370" y="70" width="130" height="70" rx="8" fill="#F8F2E6" stroke="#D9CCB4" strokeWidth="1.5" />
            <text x="435" y="98" textAnchor="middle" fontWeight="bold">Vector Index</text>
            <text x="435" y="115" textAnchor="middle" fill="#5E574C" fontSize="10">FAISS / Top-K</text>
            <text x="435" y="128" textAnchor="middle" fill="#3D7A70" fontSize="9">Cosine similarity</text>

            <path d="M 500 105 L 545 105" stroke="#1F1B16" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* LLM Generation */}
            <rect x="550" y="80" width="120" height="50" rx="8" fill="#F8F2E6" stroke="#EA2E00" strokeWidth="1.5" />
            <text x="610" y="100" textAnchor="middle" fontWeight="bold">Language Model</text>
            <text x="610" y="118" textAnchor="middle" fill="#EA2E00" fontSize="10">Grounded prompt</text>

            <path d="M 670 105 L 705 105" stroke="#1F1B16" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Final Answer */}
            <rect x="710" y="80" width="70" height="50" rx="8" fill="#3D7A70" fillOpacity="0.2" stroke="#3D7A70" strokeWidth="1.5" />
            <text x="745" y="105" textAnchor="middle" dominantBaseline="middle" fontWeight="bold" fill="#3D7A70">Answer</text>

            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#1F1B16" />
              </marker>
            </defs>
          </svg>
        </div>
      </section>

      {/* Section 2: What each setting does */}
      <section id="settings-guide" className="card-paper p-6 md:p-8 bg-paper-raised space-y-4">
        <h2 className="font-serif text-2xl font-bold text-ink">2. What each setting does</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-ink-soft">
          <div className="p-4 bg-paper rounded-lg border border-line">
            <strong className="text-ink block mb-1">Chunk size (128 – 1024 words)</strong>
            Controls context granularities. Smaller chunks isolate specific facts and improve vector precision, while larger chunks preserve paragraph continuity at higher memory cost.
          </div>
          <div className="p-4 bg-paper rounded-lg border border-line">
            <strong className="text-ink block mb-1">Retrieval Top-K (1 – 10)</strong>
            The number of chunks retrieved. Higher K increases Recall@K but increases LLM prompt length, raising inference latency and risk of distraction.
          </div>
          <div className="p-4 bg-paper rounded-lg border border-line">
            <strong className="text-ink block mb-1">Quantization (16-bit, 8-bit, 4-bit)</strong>
            Compresses neural weights to reduce VRAM requirements. Pramaan measures whether down-quantization causes accuracy degradation.
          </div>
          <div className="p-4 bg-paper rounded-lg border border-line">
            <strong className="text-ink block mb-1">Embedding models</strong>
            Maps words into dense vector spaces. Evaluated for both accuracy and indexing throughput.
          </div>
        </div>
      </section>

      {/* Section 3: Statuses */}
      <section id="statuses" className="card-paper p-6 md:p-8 bg-paper-raised space-y-4">
        <h2 className="font-serif text-2xl font-bold text-ink">3. Understanding answer reliability</h2>
        <p className="text-ink-soft text-sm leading-relaxed max-w-[70ch]">
          Every generated answer is scored across multiple signals: cosine similarity, gap to 2nd chunk, lexical overlap, and model abstention.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-paper rounded-lg border border-line space-y-2">
            <ReliabilityBadge status="Reliable" confidence={0.92} />
            <p className="text-xs text-ink-soft leading-relaxed">
              Target accuracy ≥ 90%. The top chunk exhibits high similarity and strong lexical grounding in the source document.
            </p>
          </div>

          <div className="p-4 bg-paper rounded-lg border border-line space-y-2">
            <ReliabilityBadge status="Uncertain" confidence={0.61} />
            <p className="text-xs text-ink-soft leading-relaxed">
              Moderate confidence. Chunks have partial overlap or conflicting similarity scores. Manual verification advised.
            </p>
          </div>

          <div className="p-4 bg-paper rounded-lg border border-line space-y-2">
            <ReliabilityBadge status="Unreliable" confidence={0.28} />
            <p className="text-xs text-ink-soft leading-relaxed">
              High risk of hallucination or lack of supporting evidence in the retrieved context.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: What Was Really Measured (Methodology) */}
      <section id="methodology" className="card-paper p-6 md:p-8 bg-paper-raised space-y-4">
        <h2 className="font-serif text-2xl font-bold text-ink">4. What was really measured (Methodology)</h2>
        <p className="text-ink-soft text-sm leading-relaxed">
          Pramaan AI enforces strict honesty about metric sources:
        </p>
        <ul className="text-sm text-ink-soft space-y-2 list-disc list-inside">
          <li><strong>Measured:</strong> Timed with <code>time.perf_counter</code> across real calls after discarding an initial warm-up call.</li>
          <li><strong>API Latency:</strong> Network roundtrip plus server processing via Hugging Face Inference Providers.</li>
          <li><strong>Estimated Memory:</strong> Calculated from safetensors parameter count × 2 bytes per weight (for 16-bit). Real RAM/VRAM is measured when using the local runner.</li>
          <li><strong>Bootstrap Confidence Intervals:</strong> 95% paired bootstrap intervals computed when n ≥ 100.</li>
        </ul>
      </section>

      {/* Section 5: Searchable Glossary */}
      <section id="glossary" className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line">
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">5. Technical glossary</h2>
            <p className="text-xs text-ink-soft mt-1">
              Definitions of all technical terms used across benchmarks, charts, and recommendations.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-paper rounded-lg border border-line w-full sm:w-64">
            <Search className="w-4 h-4 text-ink-soft shrink-0" />
            <input
              type="text"
              aria-label="Search glossary"
              placeholder="Search glossary..."
              value={glossaryQuery}
              onChange={(e) => setGlossaryQuery(e.target.value)}
              className="w-full bg-transparent text-xs font-mono text-ink focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGlossary.map(([term, desc]) => (
            <div key={term} className="p-3 bg-paper rounded-lg border border-line space-y-1">
              <span className="font-mono text-xs font-bold text-accent capitalize block">
                {term}
              </span>
              <p className="text-xs text-ink-soft leading-relaxed">{desc}</p>
            </div>
          ))}
          {filteredGlossary.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs font-mono text-ink-soft">
              No glossary terms matching "{glossaryQuery}"
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
