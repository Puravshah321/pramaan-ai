import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSetup,
  fetchHealth,
  updateSetup,
  fetchModelDetails,
  testModelInference,
  searchModels,
  searchDatasets,
  fetchDatasetRows,
  loadDatasetIntoCorpus,
  fetchActiveDataset,
  fetchLocalModels,
  downloadLocalModel,
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
  HardDrive,
  Download,
  BookOpen,
} from "lucide-react";
import axios from "axios";

export const Models: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: setup } = useQuery({
    queryKey: ["setup"],
    queryFn: fetchSetup,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  const { data: activeDataset } = useQuery({
    queryKey: ["activeDataset"],
    queryFn: fetchActiveDataset,
  });

  const { data: localModels, refetch: refetchLocalModels } = useQuery({
    queryKey: ["localModels"],
    queryFn: fetchLocalModels,
  });

  const [activeEmbedding, setActiveEmbedding] = useState(
    setup?.embedding_model || "BAAI/bge-small-en-v1.5"
  );
  const [activeLanguage, setActiveLanguage] = useState(
    setup?.language_model || "Qwen/Qwen2.5-0.5B-Instruct"
  );

  // Candidate comparison list (prefilled with active models)
  const [candidateEmbeddings, setCandidateEmbeddings] = useState<string[]>([
    "BAAI/bge-small-en-v1.5",
    "sentence-transformers/all-MiniLM-L6-v2",
  ]);
  const [candidateLanguage, setCandidateLanguage] = useState<string[]>([
    "Qwen/Qwen2.5-0.5B-Instruct",
    "Qwen/Qwen2.5-1.5B-Instruct",
  ]);

  // Live search for adding models
  const [candidateInput, setCandidateInput] = useState("");
  const [candidateTask, setCandidateTask] = useState<"embedding" | "language">("language");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(candidateInput.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [candidateInput]);

  const { data: liveModelSearchResults, isLoading: isSearchingModels } = useQuery({
    queryKey: ["liveModelSearch", debouncedQuery, candidateTask],
    queryFn: () =>
      searchModels(
        debouncedQuery,
        candidateTask === "embedding" ? "sentence-similarity" : "text-generation",
        5
      ),
    enabled: debouncedQuery.length >= 2,
  });

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

  const addCandidate = (targetId: string, taskOverride?: "embedding" | "language") => {
    const cleanId = targetId.trim();
    if (!cleanId) return;
    const task = taskOverride || candidateTask;

    if (task === "embedding") {
      if (candidateEmbeddings.includes(cleanId)) return;
      if (candidateEmbeddings.length >= 4) return;
      setCandidateEmbeddings([...candidateEmbeddings, cleanId]);
    } else {
      if (candidateLanguage.includes(cleanId)) return;
      if (candidateLanguage.length >= 4) return;
      setCandidateLanguage([...candidateLanguage, cleanId]);
    }
    setCandidateInput("");
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

  // Popular local models with unified memory calculation
  const popularSmallModels = [
    {
      id: "Qwen/Qwen2.5-0.5B-Instruct",
      params: "0.5B",
      runner: "local",
      badge: "Ready (local)",
      fit: "Fits 1GB+",
      memory: "~0.6 GB",
    },
    {
      id: "Qwen/Qwen2.5-1.5B-Instruct",
      params: "1.5B",
      runner: "local",
      badge: "Local GGUF",
      fit: "Fits 2GB+",
      memory: "~1.2 GB",
    },
    {
      id: "HuggingFaceTB/SmolLM2-135M-Instruct",
      params: "0.13B",
      runner: "local",
      badge: "Local GGUF",
      fit: "Fits 1GB+",
      memory: "~0.3 GB",
    },
    {
      id: "meta-llama/Llama-3.2-1B-Instruct",
      params: "1.2B",
      runner: "local",
      badge: "Local GGUF",
      fit: "Fits 2GB+",
      memory: "~1.0 GB",
    },
  ];

  const popularEmbeddingModels = [
    {
      id: "BAAI/bge-small-en-v1.5",
      dim: "384-dim",
      badge: "Ready (local)",
      memory: "~0.3 GB",
    },
    {
      id: "sentence-transformers/all-MiniLM-L6-v2",
      dim: "384-dim",
      badge: "Local GGUF",
      memory: "~0.3 GB",
    },
    {
      id: "BAAI/bge-base-en-v1.5",
      dim: "768-dim",
      badge: "Local GGUF",
      memory: "~0.4 GB",
    },
  ];

  // ============================================================================
  // Dataset Flow: Live QA Dataset Cards & Ingestion Drawer
  // ============================================================================
  const [datasetSearch, setDatasetSearch] = useState("");
  const [debouncedDatasetQuery, setDebouncedDatasetQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDatasetQuery(datasetSearch.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [datasetSearch]);

  const { data: searchResults, isLoading: searchingDatasets } = useQuery({
    queryKey: ["datasets", debouncedDatasetQuery],
    queryFn: () => searchDatasets(debouncedDatasetQuery || "question-answering", 6),
  });

  // Selected dataset for preview drawer
  const [selectedDatasetForPreview, setSelectedDatasetForPreview] = useState<string | null>(null);
  const [selectedSplit, setSelectedSplit] = useState<string>("validation");
  const [selectedCount, setSelectedCount] = useState<number>(200);
  const [isIngestingDataset, setIsIngestingDataset] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  const { data: datasetPreviewData, isLoading: isLoadingPreviewRows } = useQuery({
    queryKey: ["datasetPreview", selectedDatasetForPreview, selectedSplit],
    queryFn: () => fetchDatasetRows(selectedDatasetForPreview!, 0, 5, selectedSplit),
    enabled: !!selectedDatasetForPreview,
  });

  const handleIngestDataset = async () => {
    if (!selectedDatasetForPreview) return;
    setIsIngestingDataset(true);
    setIngestStatus("Downloading rows and indexing into SQLite...");
    try {
      const res = await loadDatasetIntoCorpus(
        selectedDatasetForPreview,
        selectedSplit,
        selectedCount
      );
      setIngestStatus(`Success! Ingested ${res.num_questions} questions into SQLite.`);
      await queryClient.invalidateQueries({ queryKey: ["activeDataset"] });
      await queryClient.invalidateQueries({ queryKey: ["setup"] });
      setTimeout(() => {
        setSelectedDatasetForPreview(null);
        setIngestStatus(null);
        navigate("/benchmark");
      }, 1200);
    } catch (e: any) {
      setIngestStatus(`Error ingesting: ${e.response?.data?.detail || e.message}`);
    } finally {
      setIsIngestingDataset(false);
    }
  };

  // Model Download Handler
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const handleDownloadModel = async (modelId: string, isEmbedding: boolean) => {
    setDownloadingModelId(modelId);
    setDownloadMsg(`Downloading GGUF for ${modelId}...`);
    try {
      await downloadLocalModel(modelId, "q4_k_m", isEmbedding);
      setDownloadMsg(`Successfully downloaded ${modelId}!`);
      await refetchLocalModels();
    } catch (e: any) {
      setDownloadMsg(`Download failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setDownloadingModelId(null);
      setTimeout(() => setDownloadMsg(null), 3500);
    }
  };

  // Custom Document Upload
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
      await queryClient.invalidateQueries({ queryKey: ["activeDataset"] });
    } catch (err: any) {
      setUploadStatus(`Upload error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-10">
      {/* 1. Active Setup Header Card */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-xs font-sans font-semibold text-sage-deep block mb-1">
              Active Pipeline Setup
            </span>
            <h1 className="font-serif text-3xl font-bold text-ink">Active Models & Storage</h1>
            <p className="text-xs font-sans text-ink-soft mt-1">
              Current local GGUF models loaded in memory for offline retrieval and generation.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveSetup}
            disabled={updateMutation.isPending}
            className="btn-primary text-xs inline-flex items-center gap-1.5 shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{updateMutation.isPending ? "Saving..." : savedSuccess ? "Saved!" : "Save Setup"}</span>
          </button>
        </div>

        {/* 2-Row Active Setup Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active Embedding */}
          <div className="p-4 bg-paper rounded-lg border border-line flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-sans font-medium text-ink-soft block">Embedding Model</span>
              <div className="font-mono text-sm font-bold text-ink truncate">{activeEmbedding}</div>
              <p className="text-xs font-sans text-ink-soft">
                Vector representation for dense similarity indexing.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-sage/20 text-sage-deep font-semibold border border-sage-deep/20 shrink-0">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Ready (local GGUF)</span>
            </span>
          </div>

          {/* Active Language */}
          <div className="p-4 bg-paper rounded-lg border border-line flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-sans font-medium text-ink-soft block">Language Model</span>
              <div className="font-mono text-sm font-bold text-ink truncate">{activeLanguage}</div>
              <p className="text-xs font-sans text-ink-soft">
                Extracts context and synthesizes grounded answers.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-sage/20 text-sage-deep font-semibold border border-sage-deep/20 shrink-0">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Ready (local GGUF)</span>
            </span>
          </div>
        </div>

        {/* Change Active Models Pickers */}
        <div className="pt-4 border-t border-line space-y-3">
          <span className="text-xs font-sans font-semibold text-ink-soft block">
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

      {/* 2. Local Model Manager (Disk-computed storage & status) */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-xs font-sans font-semibold text-sage-deep block mb-1">
              Local Model Manager
            </span>
            <h2 className="font-serif text-2xl font-bold text-ink flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent" />
              <span>Offline Model Storage</span>
            </h2>
            <p className="text-xs font-sans text-ink-soft mt-1">
              GGUF weights stored in <code className="font-mono text-ink">data/models/</code>. Real disk space and status computed on disk.
            </p>
          </div>
          {localModels && localModels.length > 0 && (
            <div className="text-xs font-mono bg-paper px-3 py-1.5 rounded border border-line text-ink-soft">
              Free disk space: <strong className="text-ink">{localModels[0].free_disk_gb} GB</strong>
            </div>
          )}
        </div>

        {downloadMsg && (
          <div className="p-3 bg-sage/20 border border-sage-deep/30 rounded text-xs font-mono text-sage-deep">
            {downloadMsg}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-line text-ink-soft font-sans font-medium">
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Quant</th>
                <th className="py-2.5 px-3">File Size</th>
                <th className="py-2.5 px-3">RAM Fit</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {localModels?.map((lm) => (
                <tr key={`${lm.model_id}-${lm.quantization}`} className="hover:bg-paper/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-ink font-mono">{lm.model_id}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        lm.is_embedding ? "bg-sage/20 text-sage-deep" : "bg-accent/15 text-accent"
                      }`}
                    >
                      {lm.is_embedding ? "Embedding" : "Language"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 uppercase text-ink-soft">{lm.quantization}</td>
                  <td className="py-2.5 px-3 text-ink">
                    {lm.status === "ready" ? `${lm.size_mb} MB` : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-accent font-bold">~{lm.estimated_memory_gb} GB</td>
                  <td className="py-2.5 px-3">
                    {lm.status === "ready" ? (
                      <span className="inline-flex items-center gap-1 text-sage-deep bg-sage/20 px-2 py-0.5 rounded font-sans text-[11px] font-medium">
                        <CheckCircle className="w-3 h-3" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="text-ink-soft bg-paper border border-line px-2 py-0.5 rounded font-sans text-[11px] font-medium">
                        Not downloaded
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {lm.status === "ready" ? (
                      <button
                        type="button"
                        onClick={() => addCandidate(lm.model_id, lm.is_embedding ? "embedding" : "language")}
                        className="text-accent hover:underline font-sans text-xs font-medium"
                      >
                        + Compare
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDownloadModel(lm.model_id, lm.is_embedding)}
                        disabled={downloadingModelId === lm.model_id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-paper border border-line rounded hover:border-accent text-ink transition-colors disabled:opacity-50 font-sans text-xs"
                      >
                        {downloadingModelId === lm.model_id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-accent" />
                        ) : (
                          <Download className="w-3 h-3 text-accent" />
                        )}
                        <span>{downloadingModelId === lm.model_id ? "Downloading..." : "Download"}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Compare Models (OPEN BY DEFAULT) */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-xs font-sans font-semibold text-sage-deep block mb-1">
              Side-by-Side Evaluation
            </span>
            <h2 className="font-serif text-2xl font-bold text-ink">Compare Models</h2>
            <p className="text-xs font-sans text-ink-soft mt-1">
              Inspect model parameters, GGUF quantizations, and single-source memory fit.
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

        {/* Quick Add with Debounced Live Search */}
        <div className="p-4 bg-paper rounded-lg border border-line space-y-3 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <span className="text-xs font-sans text-ink-soft">
              Comparing <strong className="text-ink">{candidateLanguage.length}</strong> language and{" "}
              <strong className="text-ink">{candidateEmbeddings.length}</strong> embedding models.
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                aria-label="Select candidate model task"
                value={candidateTask}
                onChange={(e) => setCandidateTask(e.target.value as "embedding" | "language")}
                className="text-xs font-mono bg-paper-raised border border-line rounded px-2.5 py-1.5 text-ink"
              >
                <option value="language">Language Model ({candidateLanguage.length}/4)</option>
                <option value="embedding">Embedding Model ({candidateEmbeddings.length}/4)</option>
              </select>
              <div className="relative">
                <input
                  type="text"
                  aria-label="Candidate model search or repo ID"
                  placeholder="Type to search (e.g. mistral, qwen)..."
                  value={candidateInput}
                  onChange={(e) => setCandidateInput(e.target.value)}
                  className="text-xs font-mono bg-paper-raised border border-line rounded px-3 py-1.5 text-ink w-64 focus:outline-none focus:border-accent"
                />
                {isSearchingModels && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent absolute right-2.5 top-2" />
                )}
              </div>
              <button
                type="button"
                onClick={() => addCandidate(candidateInput)}
                disabled={!candidateInput.trim()}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Live Search Dropdown Suggestions */}
          {debouncedQuery.length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-paper border border-line rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto divide-y divide-line/40">
              {isSearchingModels ? (
                <div className="p-3 text-xs font-mono text-ink-soft flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  <span>Searching Hugging Face and local registry...</span>
                </div>
              ) : liveModelSearchResults && liveModelSearchResults.length > 0 ? (
                liveModelSearchResults.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 hover:bg-paper-raised flex items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-ink block truncate">{m.id}</span>
                      <span className="text-[11px] text-ink-soft font-sans">
                        {m.parameters ? `${(m.parameters / 1e9).toFixed(1)}B params` : "Local candidate"} · ~{m.estimated_memory_gb || 0.8} GB RAM
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addCandidate(m.id)}
                      className="btn-secondary text-[11px] py-1 px-2 shrink-0"
                    >
                      + Add to Compare
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-3 text-xs font-sans text-ink-soft">
                  No models matching "{debouncedQuery}" found. Try "qwen", "smollm", or "bge".
                </div>
              )}
            </div>
          )}
        </div>

        {/* Popular Language Models 1-Click Addition */}
        <div className="space-y-3">
          <span className="text-xs font-sans font-semibold text-ink-soft block">
            Popular Small Language Models (&lt; 4B Parameters)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {popularSmallModels.map((pm) => {
              const isAdded = candidateLanguage.includes(pm.id);
              return (
                <div
                  key={pm.id}
                  className="p-3 bg-paper rounded border border-line flex flex-col justify-between space-y-2 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-ink truncate">{pm.id.split("/")[1] || pm.id}</span>
                      <span className="font-mono text-[10px] text-sage-deep bg-sage/20 px-1.5 py-0.5 rounded font-bold">
                        {pm.params}
                      </span>
                    </div>
                    <p className="text-ink-soft text-[11px] font-sans mt-1">
                      {pm.fit} · <strong className="text-accent">{pm.memory}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCandidate(pm.id, "language")}
                    disabled={isAdded}
                    className={`w-full py-1 rounded text-[11px] font-sans font-semibold transition-colors ${
                      isAdded
                        ? "bg-line/40 text-ink-soft cursor-default"
                        : "bg-paper-raised border border-line text-ink hover:border-accent"
                    }`}
                  >
                    {isAdded ? "Added" : "+ Add to compare"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Embedding Models 1-Click Addition (resolves S6) */}
        <div className="space-y-3">
          <span className="text-xs font-sans font-semibold text-ink-soft block">
            Popular Local Embedding Models
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {popularEmbeddingModels.map((pem) => {
              const isAdded = candidateEmbeddings.includes(pem.id);
              return (
                <div
                  key={pem.id}
                  className="p-3 bg-paper rounded border border-line flex flex-col justify-between space-y-2 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-ink truncate">{pem.id.split("/")[1] || pem.id}</span>
                      <span className="font-mono text-[10px] text-sage-deep bg-sage/20 px-1.5 py-0.5 rounded font-bold">
                        {pem.dim}
                      </span>
                    </div>
                    <p className="text-ink-soft text-[11px] font-sans mt-1">
                      Dense vectors · <strong className="text-accent">{pem.memory}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCandidate(pem.id, "embedding")}
                    disabled={isAdded}
                    className={`w-full py-1 rounded text-[11px] font-sans font-semibold transition-colors ${
                      isAdded
                        ? "bg-line/40 text-ink-soft cursor-default"
                        : "bg-paper-raised border border-line text-ink hover:border-accent"
                    }`}
                  >
                    {isAdded ? "Added" : "+ Add to compare"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-line text-ink-soft font-sans font-medium">
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Model Repository</th>
                <th className="py-2.5 px-3">Inference Mode</th>
                <th className="py-2.5 px-3">Parameters</th>
                <th className="py-2.5 px-3">RAM Fit (Q4)</th>
                <th className="py-2.5 px-3">License</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {candidateLanguage.map((mid) => (
                <ModelTableRow
                  key={mid}
                  modelId={mid}
                  type="Language"
                  onTest={() => handleTestModel(mid)}
                  onRemove={() => removeCandidate(mid, "language")}
                />
              ))}
              {candidateEmbeddings.map((mid) => (
                <ModelTableRow
                  key={mid}
                  modelId={mid}
                  type="Embedding"
                  onTest={() => handleTestModel(mid)}
                  onRemove={() => removeCandidate(mid, "embedding")}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Active QA Dataset & Hub Search Flow (resolves S2 & S3) */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <span className="text-xs font-sans font-semibold text-sage-deep block mb-1">
              Evaluation Corpora
            </span>
            <h2 className="font-serif text-2xl font-bold text-ink flex items-center gap-2">
              <Database className="w-5 h-5 text-accent" />
              <span>QA Datasets & Ingestion</span>
            </h2>
            <p className="text-xs font-sans text-ink-soft mt-1">
              Select or import ground truth question-answering pairs into SQLite for local benchmarking.
            </p>
          </div>
          {activeDataset && (
            <div className="p-3 bg-paper rounded-lg border border-accent/40 text-xs font-mono">
              Active Dataset: <strong className="text-accent">{activeDataset.name}</strong> ({activeDataset.num_questions} questions)
            </div>
          )}
        </div>

        {/* Live Hugging Face Dataset Cards */}
        <div className="space-y-3">
          <span className="text-xs font-sans font-semibold text-ink-soft block">
            Featured Question-Answering Datasets (Live from Hugging Face Hub)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {searchResults?.map((ds: any) => (
              <div
                key={ds.id}
                className="p-4 bg-paper rounded-lg border border-line flex flex-col justify-between space-y-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink font-sans text-sm truncate">{ds.id.split("/")[1] || ds.id}</span>
                  </div>
                  <p className="text-ink-soft text-[11px] font-sans line-clamp-2">
                    {ds.id} · QA benchmark with verified passages and answers.
                  </p>
                </div>
                <div className="pt-2 border-t border-line/60 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-ink-soft">{ds.downloads?.toLocaleString() || "10k+"} dls</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDatasetForPreview(ds.id)}
                    className="font-bold text-accent hover:underline flex items-center gap-1 font-sans"
                  >
                    <span>Use Dataset →</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Search & Upload Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-line">
          {/* Hugging Face Datasets Live Search */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
              <Search className="w-4 h-4 text-accent" />
              <span>Search Hugging Face QA Datasets</span>
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
          </div>

          {/* Custom Document Upload */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
              <Upload className="w-4 h-4 text-sage-deep" />
              <span>Upload Custom Documents</span>
            </h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Upload PDF or plain text files. Questions will be generated with the local language model.
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

      {/* 5. Dataset Preview & Ingestion Modal / Drawer (resolves S2) */}
      {selectedDatasetForPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-paper border border-line rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="space-y-1">
                <span className="text-xs font-sans font-semibold text-sage-deep">Dataset Preview & Ingestion</span>
                <h3 className="font-serif text-xl font-bold text-ink">{selectedDatasetForPreview}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDatasetForPreview(null)}
                className="text-ink-soft hover:text-ink p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split & Count Selectors */}
            <div className="grid grid-cols-2 gap-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-ink-soft font-semibold">Evaluation Split</label>
                <select
                  value={selectedSplit}
                  onChange={(e) => setSelectedSplit(e.target.value)}
                  className="w-full p-2 bg-paper-raised border border-line rounded font-mono text-ink text-xs"
                >
                  <option value="validation">validation / test (Recommended)</option>
                  <option value="train">train</option>
                </select>
                <p className="text-[10px] text-ink-soft">
                  Defaults to validation split for honest benchmark evaluation.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-ink-soft font-semibold">Question Count to Ingest</label>
                <select
                  value={selectedCount}
                  onChange={(e) => setSelectedCount(Number(e.target.value))}
                  className="w-full p-2 bg-paper-raised border border-line rounded font-mono text-ink text-xs"
                >
                  <option value={20}>20 questions (Fast test)</option>
                  <option value={50}>50 questions (Balanced)</option>
                  <option value={100}>100 questions (Standard)</option>
                  <option value={200}>200 questions (Recommended for Section 14)</option>
                </select>
              </div>
            </div>

            {/* Sample Rows Preview */}
            <div className="space-y-2">
              <span className="text-xs font-sans font-semibold text-ink-soft block">
                Sample Live Rows (from Datasets Server)
              </span>
              {isLoadingPreviewRows ? (
                <div className="p-8 text-center text-xs font-mono text-ink-soft">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
                  Fetching live rows...
                </div>
              ) : datasetPreviewData?.rows && datasetPreviewData.rows.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {datasetPreviewData.rows.map((r: any, idx: number) => {
                    const q = r.question || r.query || "Question";
                    let ansDisplay = "No answer in the passage (unanswerable)";
                    if (Array.isArray(r.answers) && r.answers.length > 0) {
                      const unique = Array.from(new Set(r.answers.map((x: any) => String(x).trim()).filter(Boolean)));
                      if (unique.length > 0) ansDisplay = unique.join(", ");
                    } else if (r.answers && typeof r.answers === "object" && Array.isArray(r.answers.text) && r.answers.text.length > 0) {
                      const unique = Array.from(new Set(r.answers.text.map((x: any) => String(x).trim()).filter(Boolean)));
                      if (unique.length > 0) ansDisplay = unique.join(", ");
                    } else if (typeof r.answers === "string" && r.answers.trim()) {
                      ansDisplay = r.answers.trim();
                    } else if (typeof r.answer === "string" && r.answer.trim()) {
                      ansDisplay = r.answer.trim();
                    }
                    const ctx = r.context || r.passage || r.text || "";
                    return (
                      <div key={idx} className="p-3 bg-paper-raised rounded border border-line text-xs font-mono space-y-1">
                        <div className="font-bold text-ink">Q: {q}</div>
                        <div className="text-sage-deep">A: {ansDisplay}</div>
                        <p className="text-[11px] text-ink-soft line-clamp-2">{String(ctx)}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-paper-raised rounded border border-line text-xs font-sans text-ink-soft">
                  Live preview unavailable for this split. Ingest will pull from Hub datasets API.
                </div>
              )}
            </div>

            {ingestStatus && (
              <div className="p-3 bg-sage/20 border border-sage-deep/30 rounded text-xs font-mono text-sage-deep">
                {ingestStatus}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setSelectedDatasetForPreview(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIngestDataset}
                disabled={isIngestingDataset}
                className="btn-primary text-xs px-5 py-2 flex items-center gap-2"
              >
                {isIngestingDataset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>{isIngestingDataset ? "Ingesting..." : `Ingest & Set Active (${selectedCount} Qs)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
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
        <td colSpan={7} className="py-2.5 px-3 text-ink-soft">
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
        <span className="text-sage-deep bg-sage/20 px-2 py-0.5 rounded font-sans font-medium inline-flex items-center gap-1 text-[11px]">
          <Cpu className="w-3 h-3" />
          <span>Local GGUF</span>
        </span>
      </td>
      <td className="py-2.5 px-3 font-mono">{formatParams(details?.parameters)}</td>
      <td className="py-2.5 px-3 font-mono font-bold text-accent">
        ~{details?.estimated_memory_gb || 0.8} GB
      </td>
      <td className="py-2.5 px-3 font-mono">{details?.license || "Apache-2.0"}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {type === "Language" && (
            <button
              type="button"
              onClick={onTest}
              className="text-xs font-sans text-accent hover:underline px-2 py-1"
              title="Run quick local test call"
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
