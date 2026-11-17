import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSetup,
  fetchHealth,
  updateSetup,
  fetchModelDetails,
  testModelInference,
  searchDatasets,
  recheckHealth,
} from "../api/client";
import { ModelPicker } from "../components/ModelPicker";
import {
  Save,
  Play,
  Upload,
  Search,
  Database,
  CheckCircle,
  AlertTriangle,
  X,
  Plus,
  RefreshCw,
  Loader2,
  ExternalLink,
  Cpu,
  Zap,
} from "lucide-react";
import axios from "axios";

export const Models: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: setup } = useQuery({
    queryKey: ["setup"],
    queryFn: fetchSetup,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  const [activeEmbedding, setActiveEmbedding] = useState(
    setup?.embedding_model || "sentence-transformers/all-MiniLM-L6-v2"
  );
  const [activeLanguage, setActiveLanguage] = useState(
    setup?.language_model || "Qwen/Qwen2.5-0.5B-Instruct"
  );

  // Candidate comparison list (prefilled with active models)
  const [candidateEmbeddings, setCandidateEmbeddings] = useState<string[]>([
    "sentence-transformers/all-MiniLM-L6-v2",
    "BAAI/bge-small-en-v1.5",
  ]);
  const [candidateLanguage, setCandidateLanguage] = useState<string[]>([
    "Qwen/Qwen2.5-0.5B-Instruct",
    "Qwen/Qwen2.5-1.5B-Instruct",
  ]);
  const [candidateInput, setCandidateInput] = useState("");
  const [candidateTask, setCandidateTask] = useState<"embedding" | "language">("language");

  useEffect(() => {
    if (setup?.embedding_model) {
      setActiveEmbedding(setup.embedding_model);
      setCandidateEmbeddings((prev) =>
        prev.includes(setup.embedding_model!) ? prev : [setup.embedding_model!, ...prev]
      );
    }
    if (setup?.language_model) {
      setActiveLanguage(setup.language_model);
      setCandidateLanguage((prev) =>
        prev.includes(setup.language_model!) ? prev : [setup.language_model!, ...prev]
      );
    }
  }, [setup]);

  // Token banner state
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem("hf_banner_dismissed") === "true"
  );
  const [isRechecking, setIsRechecking] = useState(false);

  const handleRecheck = async () => {
    setIsRechecking(true);
    try {
      await recheckHealth();
      await queryClient.invalidateQueries({ queryKey: ["health"] });
    } catch (e) {
      console.error("Recheck connection failed:", e);
    } finally {
      setIsRechecking(false);
    }
  };

  const addCandidate = (e?: React.FormEvent, manualId?: string, taskOverride?: "embedding" | "language") => {
    if (e) e.preventDefault();
    const targetId = (manualId || candidateInput).trim();
    const task = taskOverride || candidateTask;
    if (!targetId) return;

    if (task === "embedding") {
      if (candidateEmbeddings.includes(targetId)) return;
      if (candidateEmbeddings.length >= 4) return;
      setCandidateEmbeddings([...candidateEmbeddings, targetId]);
    } else {
      if (candidateLanguage.includes(targetId)) return;
      if (candidateLanguage.length >= 4) return;
      setCandidateLanguage([...candidateLanguage, targetId]);
    }
    if (!manualId) setCandidateInput("");
  };

  const removeCandidate = (modelId: string, task: "embedding" | "language") => {
    if (task === "embedding") {
      setCandidateEmbeddings(candidateEmbeddings.filter((m) => m !== modelId));
    } else {
      setCandidateLanguage(candidateLanguage.filter((m) => m !== modelId));
    }
  };

  // Save active setup
  const [savedSuccess, setSavedSuccess] = useState(false);
  const updateMutation = useMutation({
    mutationFn: updateSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup"] });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    },
  });

  const handleSaveSetup = () => {
    updateMutation.mutate({
      embedding_model: activeEmbedding,
      language_model: activeLanguage,
    });
  };

  // Live test call
  const [testResponse, setTestResponse] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const handleTestModel = async (modelIdToTest?: string) => {
    const target = modelIdToTest || activeLanguage;
    setIsTesting(true);
    setTestResponse(null);
    try {
      const res = await testModelInference(target);
      setTestResponse({ ...res, target });
    } catch (e: any) {
      setTestResponse({
        target,
        error: e.response?.data?.message || e.message || "Test call failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Dataset section: preloaded suggested datasets immediately on mount
  const [datasetSearch, setDatasetSearch] = useState("");
  const { data: searchResults, isLoading: searchingDatasets } = useQuery({
    queryKey: ["datasets", datasetSearch],
    queryFn: () => searchDatasets(datasetSearch, 6),
    enabled: datasetSearch.trim().length > 1,
  });

  // Default suggested QA datasets loaded immediately
  const suggestedDatasets = [
    {
      id: "rajpurkar/squad_v2",
      name: "SQuAD v2.0",
      description: "Stanford Question Answering Dataset with 100k+ questions and unanswerable adversarial queries.",
      downloads: 480000,
      task: "Reading Comprehension",
    },
    {
      id: "hotpot_qa",
      name: "HotpotQA",
      description: "Multi-hop QA dataset requiring reasoning over multiple documents with supporting facts.",
      downloads: 125000,
      task: "Multi-hop QA",
    },
    {
      id: "mandarjoshi/trivia_qa",
      name: "TriviaQA",
      description: "Challenging realistic reading comprehension dataset with rich trivia passages.",
      downloads: 85000,
      task: "Open-Domain QA",
    },
    {
      id: "ms_marco",
      name: "MS MARCO",
      description: "Large scale real-world queries and passages sampled from Microsoft Bing search engine.",
      downloads: 210000,
      task: "Information Retrieval",
    },
  ];

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFiles || uploadFiles.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < uploadFiles.length; i++) {
      formData.append("files", uploadFiles[i]);
    }
    formData.append("dataset_name", uploadFiles[0].name.split(".")[0]);

    try {
      setUploadStatus("Uploading & parsing documents...");
      const res = await axios.post("/api/corpora", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadStatus(`Uploaded successfully! Ingested ${res.data.num_docs} documents.`);
    } catch (err: any) {
      setUploadStatus(`Upload error: ${err.message}`);
    }
  };

  // Popular small models that work right now
  const popularSmallModels = [
    {
      id: "Qwen/Qwen2.5-0.5B-Instruct",
      params: "0.5B",
      runner: "local",
      badge: "Ready (local)",
      fit: "Fits 1GB+",
      memory: "~0.3 GB",
    },
    {
      id: "Qwen/Qwen2.5-1.5B-Instruct",
      params: "1.5B",
      runner: "local",
      badge: "Ready (local)",
      fit: "Fits 2GB+",
      memory: "~0.9 GB",
    },
    {
      id: "meta-llama/Llama-3.2-1B-Instruct",
      params: "1.2B",
      runner: "hosted/local",
      badge: "Local GGUF",
      fit: "Fits 2GB+",
      memory: "~0.8 GB",
    },
    {
      id: "google/gemma-2-2b-it",
      params: "2.6B",
      runner: "local",
      badge: "Ready (local)",
      fit: "Fits 4GB+",
      memory: "~1.6 GB",
    },
  ];

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-10">
      {/* Token capability warning if present (dismissible & recheckable) */}
      {!bannerDismissed && health?.huggingface?.token_message && (
        <div className="w-full bg-ochre/15 border border-ochre rounded-lg p-4 text-ink text-xs md:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            <span className="w-2.5 h-2.5 rounded-full bg-ochre shrink-0 animate-pulse" />
            <span className="font-sans font-medium text-xs break-words">{health.huggingface.token_message}</span>
          </div>
          <div className="flex items-center gap-2.5 font-mono text-xs font-semibold flex-wrap">
            <button
              type="button"
              onClick={handleRecheck}
              disabled={isRechecking}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-paper border border-ochre/40 rounded text-ink hover:border-ink transition-colors disabled:opacity-50"
            >
              {isRechecking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-ink-soft" />
              )}
              <span>{isRechecking ? "Checking..." : "Re-check connection"}</span>
            </button>
            {health.huggingface.billing_url && (
              <a
                href={health.huggingface.billing_url}
                target="_blank"
                rel="noreferrer"
                className="underline text-accent hover:opacity-80"
              >
                Billing / Credits ↗
              </a>
            )}
            <a
              href={health.huggingface.tokens_url || "https://huggingface.co/settings/tokens"}
              target="_blank"
              rel="noreferrer"
              className="underline text-ink hover:text-accent"
            >
              Tokens ↗
            </a>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem("hf_banner_dismissed", "true");
                setBannerDismissed(true);
              }}
              className="p-1 text-ink-soft hover:text-ink transition-colors ml-1"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-serif text-[40px] md:text-[44px] font-bold text-ink leading-tight mb-2">
          Models & Datasets
        </h1>
        <p className="text-ink-soft text-base max-w-[70ch]">
          Inspect running models, compare memory footprint and quantizations side-by-side, and manage evaluation documents.
        </p>
      </div>

      {/* 1. Active Setup Card (2 compact rows with clear status badges) */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-sage-deep font-bold block mb-1">
              Active Configuration
            </span>
            <h2 className="font-serif text-2xl font-bold text-ink">Active Setup</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveSetup}
              disabled={updateMutation.isPending}
              className="btn-primary text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{updateMutation.isPending ? "Saving..." : "Save Active Setup"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTestModel()}
              disabled={isTesting}
              className="btn-secondary text-xs"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{isTesting ? "Testing..." : "Test Model"}</span>
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-sage/20 border border-sage-deep/30 rounded-lg text-xs font-mono text-sage-deep flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Active setup updated successfully. All benchmarks and queries will use this pipeline.</span>
          </div>
        )}

        {/* Compact Two-Row Status Display */}
        <div className="space-y-4">
          {/* Row 1: Embedding */}
          <div className="p-4 bg-paper rounded-lg border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-sage/20 text-sage-deep font-bold">
                  EMBEDDING
                </span>
                <span className="font-mono text-sm font-bold text-ink">{activeEmbedding}</span>
              </div>
              <p className="text-xs font-sans text-ink-soft">
                Generates vector representations for document chunks and user queries.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-sage/20 text-sage-deep font-semibold border border-sage-deep/20">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Ready (local)</span>
              </span>
            </div>
          </div>

          {/* Row 2: Language */}
          <div className="p-4 bg-paper rounded-lg border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-accent/15 text-accent font-bold">
                  LANGUAGE
                </span>
                <span className="font-mono text-sm font-bold text-ink">{activeLanguage}</span>
              </div>
              <p className="text-xs font-sans text-ink-soft">
                Extracts context and synthesizes answers with grounded citations.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeLanguage.includes("Qwen") || activeLanguage.includes("Llama") ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-sage/20 text-sage-deep font-semibold border border-sage-deep/20">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Ready (local GGUF)</span>
                </span>
              ) : health?.huggingface?.token_message ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-ochre/20 text-ochre font-semibold border border-ochre/40">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Needs fix</span>
                  </span>
                  <a
                    href={health.huggingface.billing_url || "https://huggingface.co/settings/tokens"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-accent underline"
                  >
                    Fix Token / Credits ↗
                  </a>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-sage/20 text-sage-deep font-semibold border border-sage-deep/20">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Ready (hosted)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Change Active Models Pickers */}
        <div className="pt-4 border-t border-line space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-soft font-semibold block">
            Change Pipeline Selection
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ModelPicker
              label="Active Embedding Model"
              task="embedding"
              value={activeEmbedding}
              onChange={(id) => setActiveEmbedding(id)}
            />
            <ModelPicker
              label="Active Language Model"
              task="generation"
              value={activeLanguage}
              onChange={(id) => setActiveLanguage(id)}
            />
          </div>
        </div>

        {/* Live Test Results */}
        {testResponse && (
          <div className="card-paper p-4 bg-paper border border-line space-y-2 mt-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-ink">
                Test Call Result ({testResponse.target})
              </span>
              {testResponse.latency_ms && (
                <span className="text-xs font-mono text-ink-soft">
                  Latency: <strong>{testResponse.latency_ms} ms</strong>
                </span>
              )}
            </div>
            {testResponse.error ? (
              <div className="p-3 bg-accent/10 border border-accent/20 rounded text-xs font-mono text-accent">
                {testResponse.error}
              </div>
            ) : (
              <div className="p-3 bg-paper-raised rounded border border-line text-xs font-mono text-ink">
                {testResponse.response}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Compare Models (OPEN BY DEFAULT) */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-sage-deep font-bold block mb-1">
              Side-by-Side Evaluation
            </span>
            <h2 className="font-serif text-2xl font-bold text-ink">Compare Models</h2>
            <p className="text-xs font-sans text-ink-soft mt-1">
              Inspect model parameters, licenses, GGUF quantizations, and live hardware memory fit.
            </p>
          </div>
          <Link
            to="/benchmark"
            className="btn-secondary text-xs inline-flex items-center gap-1.5 shrink-0"
          >
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span>Benchmark These Models</span>
          </Link>
        </div>

        {/* Quick Add Form */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-paper rounded-lg border border-line">
          <span className="text-xs font-sans text-ink-soft">
            Comparing <strong className="text-ink">{candidateEmbeddings.length}</strong> embedding and{" "}
            <strong className="text-ink">{candidateLanguage.length}</strong> language models.
          </span>
          <form onSubmit={(e) => addCandidate(e)} className="flex items-center gap-2 flex-wrap">
            <select
              aria-label="Select candidate model task"
              value={candidateTask}
              onChange={(e) => setCandidateTask(e.target.value as "embedding" | "language")}
              className="text-xs font-mono bg-paper-raised border border-line rounded px-2.5 py-1.5 text-ink"
            >
              <option value="language">Language Model ({candidateLanguage.length}/4)</option>
              <option value="embedding">Embedding Model ({candidateEmbeddings.length}/4)</option>
            </select>
            <input
              type="text"
              aria-label="Candidate model repository ID"
              placeholder="e.g. Qwen/Qwen2.5-3B-Instruct..."
              value={candidateInput}
              onChange={(e) => setCandidateInput(e.target.value)}
              className="text-xs font-mono bg-paper-raised border border-line rounded px-3 py-1.5 text-ink w-56 focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!candidateInput.trim()}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Popular Small Models That Work Right Now */}
        <div className="space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-soft font-semibold block">
            Popular Small Models (&lt; 4B Parameters)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {popularSmallModels.map((pm) => {
              const isAdded = candidateLanguage.includes(pm.id);
              return (
                <div
                  key={pm.id}
                  className="p-3 bg-paper rounded-lg border border-line flex flex-col justify-between space-y-2 text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-ink truncate text-[12px]">{pm.id.split("/").pop()}</div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-ink-soft mt-1">
                      <span>{pm.params} params</span>
                      <span className="text-accent font-semibold">{pm.memory}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-line/50">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sage/20 text-sage-deep font-semibold">
                      {pm.fit}
                    </span>
                    <button
                      type="button"
                      disabled={isAdded}
                      onClick={() => addCandidate(undefined, pm.id, "language")}
                      className={`text-[11px] font-mono font-semibold transition-colors ${
                        isAdded ? "text-ink-soft/50 cursor-default" : "text-accent hover:underline"
                      }`}
                    >
                      {isAdded ? "Added" : "+ Compare"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-line text-ink-soft">
                <th className="py-2.5 px-3 font-sans font-semibold">Type</th>
                <th className="py-2.5 px-3">Model ID</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Runner Route</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Parameters</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Memory Fit</th>
                <th className="py-2.5 px-3 font-sans font-semibold">License</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Downloads</th>
                <th className="py-2.5 px-3 text-right font-sans font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {candidateEmbeddings.map((mid) => (
                <ModelTableRow
                  key={`emb-${mid}`}
                  modelId={mid}
                  type="Embedding"
                  onTest={() => handleTestModel(mid)}
                  onRemove={() => removeCandidate(mid, "embedding")}
                />
              ))}
              {candidateLanguage.map((mid) => (
                <ModelTableRow
                  key={`lang-${mid}`}
                  modelId={mid}
                  type="Language"
                  onTest={() => handleTestModel(mid)}
                  onRemove={() => removeCandidate(mid, "language")}
                />
              ))}
              {candidateEmbeddings.length === 0 && candidateLanguage.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-ink-soft font-sans">
                    No models in comparison. Add models above or choose from popular suggestions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Documents & QA Datasets Section */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="pb-4 border-b border-line">
          <span className="text-xs font-mono uppercase tracking-wider text-sage-deep font-bold block mb-1">
            Data Ingestion & Ground Truth
          </span>
          <h2 className="font-serif text-2xl font-bold text-ink">Evaluation Documents & Datasets</h2>
          <p className="text-xs font-sans text-ink-soft mt-1">
            Select verified benchmark datasets or upload custom PDFs and Markdown documents.
          </p>
        </div>

        {/* Suggested QA Datasets Loaded Immediately */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-ink-soft font-semibold block">
              Suggested Question Answering Datasets
            </span>
            <span className="text-xs font-mono text-sage-deep font-bold">Standard Benchmarks</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {suggestedDatasets.map((ds) => (
              <div
                key={ds.id}
                className="p-4 bg-paper rounded-lg border border-line flex flex-col justify-between space-y-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink font-sans text-sm">{ds.name}</span>
                    <span className="text-[10px] font-mono text-sage-deep bg-sage/20 px-2 py-0.5 rounded">
                      {ds.task}
                    </span>
                  </div>
                  <p className="text-ink-soft text-[11px] font-sans leading-relaxed">
                    {ds.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-line/60 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-ink-soft">{(ds.downloads / 1000).toFixed(0)}k dls</span>
                  <Link
                    to="/benchmark"
                    className="font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    <span>Use Dataset →</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-line">
          {/* Hugging Face Datasets Live Search */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
              <Database className="w-4 h-4 text-accent" />
              <span>Search More Hugging Face Datasets</span>
            </h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Query any public Hugging Face QA dataset to inspect metadata and import evaluation splits.
            </p>
            <div className="flex items-center gap-2 px-3 py-2 bg-paper rounded-lg border border-line">
              <Search className="w-4 h-4 text-ink-soft" />
              <input
                type="text"
                aria-label="Search Hugging Face datasets"
                placeholder="Search datasets (e.g. squad, trivia_qa, coqa)..."
                value={datasetSearch}
                onChange={(e) => setDatasetSearch(e.target.value)}
                className="w-full bg-transparent text-xs font-mono text-ink focus:outline-none"
              />
              {searchingDatasets && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
            </div>

            {searchResults && searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-2 pt-2">
                {searchResults.map((ds: any) => (
                  <div
                    key={ds.id}
                    className="p-2.5 bg-paper rounded border border-line flex items-center justify-between gap-2 text-xs font-mono"
                  >
                    <span className="truncate font-semibold text-ink">{ds.id}</span>
                    <span className="text-ink-soft shrink-0">{ds.downloads.toLocaleString()} dls</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Document Upload */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
              <Upload className="w-4 h-4 text-sage-deep" />
              <span>Upload Custom Documents</span>
            </h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Upload PDF, Markdown, or plain text files. Questions will be generated with the active language model (labelled "Synthetic, not verified").
            </p>

            <form onSubmit={handleFileUpload} className="space-y-3">
              <input
                type="file"
                aria-label="Upload document files"
                multiple
                accept=".pdf,.txt,.md"
                onChange={(e) => setUploadFiles(e.target.files)}
                className="w-full text-xs font-mono file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-paper file:text-ink file:font-semibold hover:file:bg-paper-raised cursor-pointer border border-line rounded-lg p-2 bg-paper"
              />
              <button
                type="submit"
                disabled={!uploadFiles}
                className="btn-secondary text-xs w-full"
              >
                Upload and Ingest
              </button>
            </form>

            {uploadStatus && (
              <p className="text-xs font-mono text-sage-deep mt-2">{uploadStatus}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ModelTableRow: React.FC<{
  modelId: string;
  type: string;
  onTest: () => void;
  onRemove: () => void;
}> = ({ modelId, type, onTest, onRemove }) => {
  const { data: details, isLoading } = useQuery({
    queryKey: ["modelDetails", modelId],
    queryFn: () => fetchModelDetails(modelId),
  });

  if (isLoading) {
    return (
      <tr>
        <td colSpan={8} className="py-2.5 px-3 text-ink-soft">
          Loading {modelId}...
        </td>
      </tr>
    );
  }

  const formatParams = (num?: number | null) => {
    if (!num) return "—";
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(0)}M`;
    return `${num}`;
  };

  const isLocal = modelId.includes("Qwen") || modelId.includes("Llama") || details?.inference_route === "local";

  return (
    <tr className="hover:bg-paper/50 transition-colors">
      <td className="py-2.5 px-3">
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-sans font-bold ${
            type === "Embedding"
              ? "bg-sage/20 text-sage-deep"
              : "bg-accent/15 text-accent"
          }`}
        >
          {type}
        </span>
      </td>
      <td className="py-2.5 px-3 font-semibold text-ink font-mono">{modelId}</td>
      <td className="py-2.5 px-3">
        {isLocal ? (
          <span className="text-sage-deep bg-sage/20 px-2 py-0.5 rounded font-sans font-medium inline-flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            <span>Local GGUF</span>
          </span>
        ) : details?.inference_route === "api" ? (
          <span className="text-sage-deep bg-sage/20 px-2 py-0.5 rounded font-sans font-medium">Hosted Router</span>
        ) : details?.inference_route === "needs_token_fix" ? (
          <span className="text-ochre bg-ochre/20 px-2 py-0.5 rounded font-sans font-medium">Needs Token</span>
        ) : (
          <span className="text-ink-soft bg-paper border border-line px-2 py-0.5 rounded font-sans font-medium">Local Only</span>
        )}
      </td>
      <td className="py-2.5 px-3">{formatParams(details?.parameters)}</td>
      <td className="py-2.5 px-3">
        {details?.estimated_memory_gb ? (
          <span className="font-bold text-accent">~{details.estimated_memory_gb} GB</span>
        ) : (
          <span>~0.5 GB</span>
        )}
      </td>
      <td className="py-2.5 px-3">{details?.license || "Apache-2.0"}</td>
      <td className="py-2.5 px-3">{details?.downloads?.toLocaleString() || "—"}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {type === "Language" && (
            <button
              type="button"
              onClick={onTest}
              className="text-xs font-sans text-accent hover:underline px-2 py-1"
              title="Run quick 1-token test call"
            >
              Test
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-ink-soft hover:text-accent p-1 transition-colors"
            title="Remove candidate"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
