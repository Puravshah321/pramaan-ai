import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchSetup,
  askTryIt,
  suggestQuestions,
  fetchDatasetRows,
} from "../api/client";
import { ReliabilityBadge } from "../components/ReliabilityBadge";
import {
  Send,
  Upload,
  BookOpen,
  FileText,
  CheckCircle,
  Loader2,
  ChevronDown,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import axios from "axios";

export const TryIt: React.FC = () => {
  const { data: setup } = useQuery({
    queryKey: ["setup"],
    queryFn: fetchSetup,
  });

  // Step 1: Document selection
  const [docSourceType, setDocSourceType] = useState<"upload" | "example" | "paste">("example");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [exampleRows, setExampleRows] = useState<any[]>([]);
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number>(0);

  const [activeDocTitle, setActiveDocTitle] = useState("SQuAD v2 Sample Passage");
  const [activeDocContent, setActiveDocContent] = useState("");
  const [preparedDatasetId, setPreparedDatasetId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareMessage, setPrepareMessage] = useState<string | null>(null);

  // Load example rows from rajpurkar/squad_v2
  const { data: squadData, isLoading: isSquadLoading } = useQuery({
    queryKey: ["squadExamples"],
    queryFn: () => fetchDatasetRows("rajpurkar/squad_v2"),
  });

  useEffect(() => {
    if (squadData?.rows && squadData.rows.length > 0) {
      setExampleRows(squadData.rows);
      const row = squadData.rows[0];
      const text = row.context || row.passage || row.text || "";
      setActiveDocContent(text);
      setActiveDocTitle(row.title || "Beyoncé - SQuAD v2");
    }
  }, [squadData]);

  // Step 2: Question & Suggestions
  const [question, setQuestion] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Advanced options (Compare mode, chunk size, top_k)
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [chunkSize, setChunkSize] = useState<number>(256);
  const [topK, setTopK] = useState<number>(3);
  const [chunkSizeB, setChunkSizeB] = useState<number>(512);
  const [topKB, setTopKB] = useState<number>(5);

  // Step 3: Results
  const [resultA, setResultA] = useState<any>(null);
  const [resultB, setResultB] = useState<any>(null);
  const [queryError, setQueryError] = useState<{ message: string; fix: string } | null>(null);

  // Mutation to prepare / upload document
  const handlePrepareDocument = async () => {
    setIsPreparing(true);
    setPrepareMessage(null);
    setQueryError(null);

    try {
      let title = "Document";
      let content = "";

      if (docSourceType === "upload" && uploadedFile) {
        title = uploadedFile.name;
        const formData = new FormData();
        formData.append("files", uploadedFile);
        formData.append("dataset_name", uploadedFile.name.split(".")[0]);
        const res = await axios.post("/api/corpora", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setPreparedDatasetId(res.data.id);
        setActiveDocTitle(title);
        // If text file, read text locally for display
        if (uploadedFile.type.includes("text") || uploadedFile.name.endsWith(".txt") || uploadedFile.name.endsWith(".md")) {
          content = await uploadedFile.text();
          setActiveDocContent(content);
        } else {
          setActiveDocContent("Document contents extracted from " + uploadedFile.name);
        }
        setPrepareMessage(`Document prepared! Ingested ${res.data.num_docs} document(s).`);
      } else if (docSourceType === "paste" && pastedText.trim()) {
        title = "Pasted Text Document";
        content = pastedText.trim();
        const formData = new FormData();
        formData.append("raw_text", content);
        formData.append("dataset_name", title);
        const res = await axios.post("/api/corpora", formData);
        setPreparedDatasetId(res.data.id);
        setActiveDocTitle(title);
        setActiveDocContent(content);
        setPrepareMessage("Document prepared and chunked into memory index.");
      } else {
        // Example selected
        const row = exampleRows[selectedExampleIdx] || exampleRows[0];
        content = row?.context || row?.passage || row?.text || "";
        title = row?.title || "SQuAD v2 Document";
        const formData = new FormData();
        formData.append("raw_text", content);
        formData.append("dataset_name", title);
        const res = await axios.post("/api/corpora", formData);
        setPreparedDatasetId(res.data.id);
        setActiveDocTitle(title);
        setActiveDocContent(content);
        setPrepareMessage("Example document indexed and ready for retrieval.");
      }

      // Generate 3 suggested questions
      setIsSuggesting(true);
      try {
        const sq = await suggestQuestions({
          document_text: content,
          language_model: setup?.language_model || "Qwen/Qwen2.5-0.5B-Instruct",
        });
        if (sq?.questions && sq.questions.length > 0) {
          setSuggestedQuestions(sq.questions);
        }
      } catch (err) {
        console.error("Suggestion error", err);
      } finally {
        setIsSuggesting(false);
      }
    } catch (err: any) {
      setPrepareMessage(`Error preparing document: ${err.message}`);
    } finally {
      setIsPreparing(false);
    }
  };

  // Mutation to ask question
  const askMutation = useMutation({
    mutationFn: askTryIt,
  });

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;

    setResultA(null);
    setResultB(null);
    setQueryError(null);

    const payloadA = {
      question: question.trim(),
      dataset_id: preparedDatasetId || undefined,
      embedding_model: setup?.embedding_model || "sentence-transformers/all-MiniLM-L6-v2",
      language_model: setup?.language_model || "Qwen/Qwen2.5-0.5B-Instruct",
      chunk_size: chunkSize,
      top_k: topK,
    };

    try {
      const resA = await askMutation.mutateAsync(payloadA);
      setResultA(resA);

      if (isCompareMode) {
        const payloadB = {
          ...payloadA,
          chunk_size: chunkSizeB,
          top_k: topKB,
        };
        const resB = await askMutation.mutateAsync(payloadB);
        setResultB(resB);
      }
    } catch (err: any) {
      setQueryError({
        message: err.response?.data?.message || err.message || "Query failed",
        fix: "Check your network connection or verify that the active model is accessible.",
      });
    }
  };

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-12">
      {/* Page Header */}
      <div>
        <h1 className="font-serif text-[44px] font-bold text-ink leading-tight mb-2">
          Try It
        </h1>
        <p className="text-ink-soft text-base max-w-[70ch]">
          Query your documents with live retrieval, inspect confidence badges and stage latencies, and audit answer grounding.
        </p>
      </div>

      {/* 3-Step Guided Flow */}
      <div className="space-y-8">
        {/* Step 1: Document */}
        <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <span className="text-xs font-sans font-semibold text-sage-deep">Step 1</span>
              <h2 className="font-serif text-2xl font-bold text-ink">Choose and prepare document</h2>
            </div>
            {preparedDatasetId && (
              <span className="text-xs font-sans font-semibold text-sage-deep bg-sage/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Ready</span>
              </span>
            )}
          </div>

          {/* Document Source Tabs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDocSourceType("example")}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-colors flex items-center gap-1.5 ${
                docSourceType === "example"
                  ? "bg-accent text-paper"
                  : "bg-paper border border-line text-ink hover:border-accent"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Use an example (SQuAD v2)</span>
            </button>

            <button
              type="button"
              onClick={() => setDocSourceType("upload")}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-colors flex items-center gap-1.5 ${
                docSourceType === "upload"
                  ? "bg-accent text-paper"
                  : "bg-paper border border-line text-ink hover:border-accent"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload (PDF, TXT, MD)</span>
            </button>

            <button
              type="button"
              onClick={() => setDocSourceType("paste")}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-colors flex items-center gap-1.5 ${
                docSourceType === "paste"
                  ? "bg-accent text-paper"
                  : "bg-paper border border-line text-ink hover:border-accent"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste text</span>
            </button>
          </div>

          {/* Tab 1: Example */}
          {docSourceType === "example" && (
            <div className="space-y-3">
              <label className="text-xs font-sans font-semibold text-ink-soft block">
                Select sample passage from SQuAD v2:
              </label>
              {isSquadLoading ? (
                <div className="text-xs font-mono text-ink-soft py-2">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                  Loading live rows from Hugging Face Datasets Server...
                </div>
              ) : exampleRows.length > 0 ? (
                <div className="space-y-2">
                  <select
                    aria-label="Select SQuAD example document"
                    value={selectedExampleIdx}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setSelectedExampleIdx(idx);
                      const r = exampleRows[idx];
                      if (r) {
                        setActiveDocContent(r.context || r.passage || r.text || "");
                        setActiveDocTitle(r.title || `SQuAD Row #${idx + 1}`);
                      }
                    }}
                    className="w-full text-xs font-mono bg-paper border border-line rounded px-3 py-2 text-ink"
                  >
                    {exampleRows.slice(0, 10).map((r, i) => (
                      <option key={r.id || i} value={i}>
                        {r.title || `Document #${i + 1}`} — {r.question?.slice(0, 60)}...
                      </option>
                    ))}
                  </select>
                  <div className="p-3 bg-paper rounded border border-line text-xs font-mono text-ink-soft max-h-32 overflow-y-auto">
                    {activeDocContent}
                  </div>
                </div>
              ) : (
                <p className="text-xs font-mono text-ink-soft">Using default overview passage.</p>
              )}
            </div>
          )}

          {/* Tab 2: Upload */}
          {docSourceType === "upload" && (
            <div className="space-y-3">
              <label className="text-xs font-sans font-semibold text-ink-soft block">
                Select PDF, Markdown, or plain text file:
              </label>
              <input
                type="file"
                aria-label="Upload document file"
                accept=".pdf,.txt,.md"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setUploadedFile(e.target.files[0]);
                  }
                }}
                className="w-full text-xs font-mono file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-paper file:text-ink file:font-semibold hover:file:bg-paper-raised cursor-pointer border border-line rounded-lg p-2 bg-paper"
              />
            </div>
          )}

          {/* Tab 3: Paste */}
          {docSourceType === "paste" && (
            <div className="space-y-3">
              <label className="text-xs font-sans font-semibold text-ink-soft block">
                Paste document content:
              </label>
              <textarea
                aria-label="Paste document text"
                rows={4}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste text here to evaluate retrieval grounding..."
                className="w-full bg-paper border border-line rounded-lg p-3 text-xs font-mono text-ink focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {/* Prepare Document Button */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handlePrepareDocument}
              disabled={isPreparing}
              className="btn-secondary text-xs px-4 py-2 font-semibold"
            >
              {isPreparing ? "Chunking & embedding..." : "Prepare document"}
            </button>
            {prepareMessage && (
              <span className="text-xs font-sans font-medium text-sage-deep">
                {prepareMessage}
              </span>
            )}
          </div>
        </div>

        {/* Step 2: Ask */}
        <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
          <div className="pb-3 border-b border-line">
            <span className="text-xs font-sans font-semibold text-sage-deep">Step 2</span>
            <h2 className="font-serif text-2xl font-bold text-ink">Ask a question</h2>
          </div>

          {/* AI Suggested Questions (live from document) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-sans font-semibold text-ink">Suggested questions</span>
              <span className="text-[10px] font-sans text-ink-soft bg-paper px-2 py-0.5 rounded border border-line">
                Suggested by AI, not verified
              </span>
            </div>

            {isSuggesting ? (
              <div className="text-xs font-mono text-ink-soft">
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                Generating candidate questions with {setup?.language_model || "active LLM"}...
              </div>
            ) : suggestedQuestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQuestion(q)}
                    className="px-3 py-1.5 rounded-lg border border-line bg-paper text-xs font-sans text-ink hover:border-accent transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setQuestion("What are the key trade-offs evaluated by Pramaan AI?")}
                  className="px-3 py-1.5 rounded-lg border border-line bg-paper text-xs font-sans text-ink hover:border-accent transition-colors"
                >
                  What are the key trade-offs evaluated?
                </button>
                <button
                  type="button"
                  onClick={() => setQuestion("How does Top-K impact retrieval latency?")}
                  className="px-3 py-1.5 rounded-lg border border-line bg-paper text-xs font-sans text-ink hover:border-accent transition-colors"
                >
                  How does Top-K impact retrieval latency?
                </button>
              </div>
            )}

            {/* Guided chips */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs font-sans text-ink-soft">Test angles:</span>
              <button
                type="button"
                onClick={() => setQuestion("What specific fact is mentioned in the first section?")}
                className="text-xs font-sans text-sage-deep hover:underline"
              >
                A fact in the document
              </button>
              <span className="text-line">·</span>
              <button
                type="button"
                onClick={() => setQuestion("What numbers, dates, or measurements are stated?")}
                className="text-xs font-sans text-sage-deep hover:underline"
              >
                A number or date
              </button>
              <span className="text-line">·</span>
              <button
                type="button"
                onClick={() => setQuestion("What was the outcome of the 2028 election?")}
                className="text-xs font-sans text-sage-deep hover:underline"
              >
                Something the document does not say
              </button>
            </div>
          </div>

          {/* Question Input Form */}
          <form onSubmit={handleAsk} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                aria-label="Question to evaluate"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask any factual question about this document..."
                className="flex-1 bg-paper border border-line rounded-lg px-4 py-2.5 text-sm font-sans text-ink focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={askMutation.isPending || !question.trim()}
                className="btn-primary px-5 py-2.5 text-sm font-bold text-paper flex items-center gap-2"
              >
                {askMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Ask question</span>
              </button>
            </div>

            {/* Advanced options (collapsed by default) */}
            <details className="group pt-2 border-t border-line/60">
              <summary className="text-xs font-sans font-semibold text-ink-soft cursor-pointer hover:text-ink flex items-center justify-between py-1">
                <span>Advanced parameters (Top-K, chunk size, compare mode)</span>
                <ChevronDown className="w-4 h-4 text-ink-soft group-open:rotate-180 transition-transform" />
              </summary>
              <div className="pt-3 space-y-4">
                <div className="flex items-center gap-4 flex-wrap text-xs font-sans">
                  <label className="flex items-center gap-2">
                    <span className="text-ink-soft font-medium">Chunk size:</span>
                    <select
                      aria-label="Retrieval chunk size"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                      className="bg-paper border border-line rounded px-2 py-1 font-mono text-ink"
                    >
                      {[128, 256, 512, 1024].map((s) => (
                        <option key={s} value={s}>{s}w</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    <span className="text-ink-soft font-medium">Top-K:</span>
                    <select
                      aria-label="Retrieval Top-K"
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="bg-paper border border-line rounded px-2 py-1 font-mono text-ink"
                    >
                      {[1, 3, 5, 8].map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 ml-4">
                    <input
                      type="checkbox"
                      aria-label="Enable compare mode"
                      checked={isCompareMode}
                      onChange={(e) => setIsCompareMode(e.target.checked)}
                      className="accent-accent"
                    />
                    <span className="text-ink font-semibold">Compare mode (two configurations)</span>
                  </label>
                </div>

                {isCompareMode && (
                  <div className="p-3 bg-paper rounded border border-line flex items-center gap-4 text-xs font-sans">
                    <span className="font-bold text-accent">Config B:</span>
                    <label className="flex items-center gap-1.5">
                      <span>Chunk size:</span>
                      <select
                        aria-label="Configuration B chunk size"
                        value={chunkSizeB}
                        onChange={(e) => setChunkSizeB(Number(e.target.value))}
                        className="bg-paper-raised border border-line rounded px-2 py-1 font-mono text-ink"
                      >
                        {[128, 256, 512, 1024].map((s) => (
                          <option key={s} value={s}>{s}w</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span>Top-K:</span>
                      <select
                        aria-label="Configuration B Top-K"
                        value={topKB}
                        onChange={(e) => setTopKB(Number(e.target.value))}
                        className="bg-paper-raised border border-line rounded px-2 py-1 font-mono text-ink"
                      >
                        {[1, 3, 5, 8].map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </details>
          </form>

          {queryError && (
            <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg text-xs font-sans text-accent space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Error: {queryError.message}</span>
              </div>
              <p className="text-ink-soft">Suggested fix: {queryError.fix}</p>
            </div>
          )}
        </div>

        {/* Step 3: Read the answer */}
        {(resultA || resultB) && (
          <div className="space-y-6">
            <div className="pb-2 border-b border-line">
              <span className="text-xs font-sans font-semibold text-sage-deep">Step 3</span>
              <h2 className="font-serif text-2xl font-bold text-ink">Read answer & inspect evidence</h2>
            </div>

            <div className={`grid grid-cols-1 ${isCompareMode ? "lg:grid-cols-2" : "lg:grid-cols-12"} gap-8`}>
              {/* Answer card (BLACK card) */}
              <div className={isCompareMode ? "space-y-6" : "lg:col-span-7 space-y-6"}>
                {resultA && <AnswerCard title="Configuration A" result={resultA} />}
                {resultB && <AnswerCard title="Configuration B" result={resultB} />}
              </div>

              {/* Document with highlighted evidence (if single config) */}
              {!isCompareMode && resultA && (
                <div className="lg:col-span-5 card-paper p-6 bg-paper-raised space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <span className="font-serif text-lg font-bold text-ink">{activeDocTitle}</span>
                    <span className="text-xs font-sans text-ink-soft">
                      {resultA.chunks?.length || 0} retrieved passage(s)
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {resultA.chunks?.map((chunk: any, i: number) => (
                      <div key={i} className="p-3 bg-paper rounded border border-line space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between items-center font-bold text-ink">
                          <span className="text-accent font-sans">
                            [#{i + 1}] Passage
                          </span>
                          <span className="text-sage-deep bg-sage/20 px-2 py-0.5 rounded font-sans text-[11px]">
                            Similarity: {chunk.score?.toFixed(3) || "0.00"}
                          </span>
                        </div>
                        <p className="text-ink leading-relaxed bg-sage/15 p-2 rounded">
                          {chunk.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Black Answer Card with Reliability Badge, Timings, and Collapsed Details */
const AnswerCard: React.FC<{ title: string; result: any }> = ({ title, result }) => {
  return (
    <div className="bg-[#141210] text-paper border border-[#201D1A] rounded-xl p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#201D1A]">
        <span className="text-xs font-mono font-bold text-sage uppercase">{title}</span>
        {result.reliability && (
          <ReliabilityBadge
            status={result.reliability.status}
            confidence={result.reliability.confidence}
          />
        )}
      </div>

      {/* Generated Answer */}
      <div className="space-y-2">
        <span className="text-xs font-sans text-sage">Generated Answer</span>
        <div className="p-4 bg-[#201D1A] rounded-lg border border-line/20 font-sans text-base text-paper leading-relaxed">
          {result.answer || "No answer generated."}
        </div>
      </div>

      {/* Reliability Reasons */}
      {result.reliability?.reasons && result.reliability.reasons.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-sans text-sage">Confidence Rationale</span>
          <div className="p-3 bg-[#201D1A] rounded-lg border border-line/20">
            <ul className="text-xs font-sans text-paper/80 space-y-1 list-disc list-inside">
              {result.reliability.reasons.map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Stage Timings */}
      <div className="space-y-2">
        <span className="text-xs font-sans text-sage">Stage Timings</span>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-[#201D1A] rounded border border-line/20">
            <span className="text-sage block font-sans text-[11px]">Embed</span>
            <span className="font-bold text-paper">{result.timings?.embed_ms} ms</span>
          </div>
          <div className="p-2.5 bg-[#201D1A] rounded border border-line/20">
            <span className="text-sage block font-sans text-[11px]">Search</span>
            <span className="font-bold text-paper">{result.timings?.search_ms} ms</span>
          </div>
          <div className="p-2.5 bg-[#201D1A] rounded border border-line/20">
            <span className="text-sage block font-sans text-[11px]">Generate</span>
            <span className="font-bold text-paper">{result.timings?.generation_ms} ms</span>
          </div>
        </div>
        <div className="flex justify-between text-[11px] font-mono text-sage pt-1">
          <span>Total: {result.timings?.total_ms} ms</span>
          <span>Throughput: {result.tokens_per_second} tok/s</span>
        </div>
      </div>

      {/* Collapsed Details Section */}
      <details className="group pt-2 border-t border-[#201D1A]">
        <summary className="text-xs font-sans text-sage cursor-pointer hover:text-paper flex items-center justify-between py-1">
          <span>Technical execution details</span>
          <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="pt-3 space-y-2 text-xs font-mono text-sage/80 bg-[#201D1A] p-3 rounded mt-2 border border-line/10">
          <p>Tokens: {result.tokens}</p>
          <p>Top Similarity: {result.reliability?.signals?.top_similarity}</p>
          <p>Margin Gap: {result.reliability?.signals?.margin_gap}</p>
          <p>Lexical Support: {result.reliability?.signals?.lexical_support}</p>
          {result.error && <p className="text-accent">Notice: {result.error}</p>}
        </div>
      </details>
    </div>
  );
};
