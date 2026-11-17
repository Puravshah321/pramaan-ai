import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSetup,
  fetchHealth,
  updateSetup,
  fetchModelDetails,
  testModelInference,
  searchDatasets,
} from "../api/client";
import { ModelPicker } from "../components/ModelPicker";
import {
  Save,
  Play,
  Upload,
  Search,
  Database,
  CheckCircle,
  X,
  Plus,
  ChevronDown,
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
    setup?.language_model || ""
  );

  // Candidate comparison list (up to 3 embedding, 3 language models)
  const [candidateEmbeddings, setCandidateEmbeddings] = useState<string[]>([]);
  const [candidateLanguage, setCandidateLanguage] = useState<string[]>([]);
  const [candidateInput, setCandidateInput] = useState("");
  const [candidateTask, setCandidateTask] = useState<"embedding" | "language">("embedding");

  useEffect(() => {
    if (setup?.embedding_model) {
      const em = setup.embedding_model;
      setActiveEmbedding(em);
      setCandidateEmbeddings((prev) =>
        prev.length === 0 ? [em] : prev
      );
    }
    if (setup?.language_model) {
      const lm = setup.language_model;
      setActiveLanguage(lm);
      setCandidateLanguage((prev) =>
        prev.length === 0 ? [lm] : prev
      );
    }
  }, [setup]);

  const addCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = candidateInput.trim();
    if (!trimmed) return;
    if (candidateTask === "embedding") {
      if (candidateEmbeddings.includes(trimmed)) return;
      if (candidateEmbeddings.length >= 3) return;
      setCandidateEmbeddings([...candidateEmbeddings, trimmed]);
    } else {
      if (candidateLanguage.includes(trimmed)) return;
      if (candidateLanguage.length >= 3) return;
      setCandidateLanguage([...candidateLanguage, trimmed]);
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
  const handleTestModel = async () => {
    setIsTesting(true);
    setTestResponse(null);
    try {
      const res = await testModelInference(activeLanguage);
      setTestResponse(res);
    } catch (e: any) {
      setTestResponse({
        error: e.response?.data?.message || e.message || "Test call failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Dataset section
  const [datasetSearch, setDatasetSearch] = useState("");
  const { data: datasetResults } = useQuery({
    queryKey: ["datasets", datasetSearch],
    queryFn: () => searchDatasets(datasetSearch, 6),
    enabled: datasetSearch.length > 1,
  });

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

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-8 page-transition space-y-12">
      {/* Token capability warning if present */}
      {health?.huggingface?.token_message && (
        <div className="w-full bg-ochre/15 border border-ochre rounded-lg p-4 text-ink text-xs md:text-sm flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-ochre shrink-0 animate-pulse" />
            <span className="font-sans font-medium">{health.huggingface.token_message}</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs font-semibold">
            <a
              href={health.huggingface.tokens_url || "https://huggingface.co/settings/tokens"}
              target="_blank"
              rel="noreferrer"
              className="underline text-ink hover:text-accent"
            >
              Hugging Face Tokens ↗
            </a>
            <a
              href={health.huggingface.providers_url || "https://huggingface.co/settings/inference-providers"}
              target="_blank"
              rel="noreferrer"
              className="underline text-ink hover:text-accent"
            >
              Inference Providers ↗
            </a>
          </div>
        </div>
      )}

      <div>
        <h1 className="font-serif text-[44px] font-bold text-ink leading-tight mb-2">
          Models
        </h1>
        <p className="text-ink-soft text-base max-w-[70ch]">
          Configure the active model setup, compare candidate Hugging Face architectures, and manage evaluation documents.
        </p>
      </div>

      {/* Active Setup Pickers */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div>
            <h2 className="font-serif text-xl font-bold text-ink">Active Setup</h2>
            <p className="text-xs text-ink-soft">
              This choice dictates the default pipeline across Benchmarks, Results, and Try It.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveSetup}
              disabled={updateMutation.isPending}
              className="btn-primary text-xs"
            >
              <Save className="w-4 h-4" />
              <span>{updateMutation.isPending ? "Saving..." : "Save as active setup"}</span>
            </button>
            <button
              type="button"
              onClick={handleTestModel}
              disabled={isTesting}
              className="btn-secondary text-xs"
            >
              <Play className="w-4 h-4" />
              <span>{isTesting ? "Testing..." : "Test model"}</span>
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-sage/20 border border-sage-deep/30 rounded-lg text-xs font-mono text-sage-deep flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Active setup saved successfully! All views updated.</span>
          </div>
        )}

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

        {/* Live Test Results */}
        {testResponse && (
          <div className="card-paper p-4 bg-paper border border-line space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-ink">Real Inference Test Result</span>
              <span className="text-xs font-mono text-ink-soft">
                Latency: {testResponse.latency_ms} ms (API latency)
              </span>
            </div>
            {testResponse.error ? (
              <p className="text-xs font-mono text-accent">{testResponse.error}</p>
            ) : (
              <div className="p-3 bg-paper-raised rounded border border-line text-xs font-mono text-ink">
                {testResponse.response}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapsed Compare Models Section */}
      <details className="card-paper p-6 md:p-8 bg-paper-raised space-y-4 group">
        <summary className="flex items-center justify-between cursor-pointer list-none pb-2">
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">Compare models</h2>
            <p className="text-xs font-sans text-ink-soft mt-1">
              Add candidate models from Hugging Face to inspect parameter counts, licenses, and memory side-by-side.
            </p>
          </div>
          <ChevronDown className="w-5 h-5 text-ink-soft group-open:rotate-180 transition-transform" />
        </summary>

        <div className="pt-4 border-t border-line space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <span className="text-xs font-sans text-ink-soft">
              Comparing {candidateEmbeddings.length} embedding and {candidateLanguage.length} language models.
            </span>
            <form onSubmit={addCandidate} className="flex items-center gap-2">
              <select
                aria-label="Select candidate model task"
                value={candidateTask}
                onChange={(e) => setCandidateTask(e.target.value as "embedding" | "language")}
                className="text-xs font-mono bg-paper border border-line rounded px-2 py-1.5 text-ink"
              >
                <option value="embedding">Embedding ({candidateEmbeddings.length}/3)</option>
                <option value="language">Language ({candidateLanguage.length}/3)</option>
              </select>
              <input
                type="text"
                aria-label="Candidate model repository ID"
                placeholder="owner/model-name..."
                value={candidateInput}
                onChange={(e) => setCandidateInput(e.target.value)}
                className="text-xs font-mono bg-paper border border-line rounded px-2.5 py-1.5 text-ink w-48 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!candidateInput.trim()}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  <th className="py-2.5 px-3 font-sans font-semibold">Type</th>
                  <th className="py-2.5 px-3">Model ID</th>
                  <th className="py-2.5 px-3 font-sans font-semibold">Route</th>
                  <th className="py-2.5 px-3 font-sans font-semibold">Parameters</th>
                  <th className="py-2.5 px-3 font-sans font-semibold">Memory (Estimated)</th>
                  <th className="py-2.5 px-3 font-sans font-semibold">Downloads</th>
                  <th className="py-2.5 px-3 font-sans font-semibold">License</th>
                  <th className="py-2.5 px-3 text-right font-sans font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {candidateEmbeddings.map((mid) => (
                  <ModelTableRow
                    key={`emb-${mid}`}
                    modelId={mid}
                    type="Embedding"
                    onRemove={() => removeCandidate(mid, "embedding")}
                  />
                ))}
                {candidateLanguage.map((mid) => (
                  <ModelTableRow
                    key={`lang-${mid}`}
                    modelId={mid}
                    type="Language"
                    onRemove={() => removeCandidate(mid, "language")}
                  />
                ))}
                {candidateEmbeddings.length === 0 && candidateLanguage.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-ink-soft font-sans">
                      No candidate models added yet. Select a model or add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {/* Documents Section */}
      <div className="card-paper p-6 md:p-8 bg-paper-raised space-y-6">
        <h2 className="font-serif text-2xl font-bold text-ink">Documents</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Hugging Face Datasets Search */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
              <Database className="w-4 h-4 text-accent" />
              <span>Import Hugging Face QA Dataset</span>
            </h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              Search datasets like SQuAD, HotpotQA, or MS MARCO to preview and import real question-answer pairs.
            </p>
            <div className="flex items-center gap-2 px-3 py-2 bg-paper rounded-lg border border-line">
              <Search className="w-4 h-4 text-ink-soft" />
              <input
                type="text"
                aria-label="Search Hugging Face datasets"
                placeholder="Search datasets (e.g. squad, trivia_qa)..."
                value={datasetSearch}
                onChange={(e) => setDatasetSearch(e.target.value)}
                className="w-full bg-transparent text-xs font-mono text-ink focus:outline-none"
              />
            </div>

            {datasetResults && datasetResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-2 pt-2">
                {datasetResults.map((ds: any) => (
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
  onRemove: () => void;
}> = ({ modelId, type, onRemove }) => {
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

  return (
    <tr className="hover:bg-paper/50">
      <td className="py-2.5 px-3">
        <span
          className={`px-1.5 py-0.5 rounded text-[11px] font-sans ${
            type === "Embedding"
              ? "bg-sage/20 text-sage-deep"
              : "bg-accent/10 text-accent font-medium"
          }`}
        >
          {type}
        </span>
      </td>
      <td className="py-2.5 px-3 font-semibold text-ink">{modelId}</td>
      <td className="py-2.5 px-3">
        {details?.inference_route === "api" ? (
          <span className="text-sage-deep bg-sage/20 px-2 py-0.5 rounded font-sans font-medium">API route</span>
        ) : details?.inference_route === "needs_token_fix" ? (
          <span className="text-ochre bg-ochre/20 px-2 py-0.5 rounded font-sans font-medium">Needs token fix</span>
        ) : details?.inference_route === "not_runnable" ? (
          <span className="text-accent bg-accent/15 px-2 py-0.5 rounded font-sans font-medium">Not runnable</span>
        ) : (
          <span className="text-ink-soft bg-paper border border-line px-2 py-0.5 rounded font-sans font-medium">Local only</span>
        )}
      </td>
      <td className="py-2.5 px-3">{formatParams(details?.parameters)}</td>
      <td className="py-2.5 px-3">
        {details?.estimated_memory_gb ? (
          <span>~{details.estimated_memory_gb} GB</span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-2.5 px-3">{details?.downloads?.toLocaleString() || "—"}</td>
      <td className="py-2.5 px-3">{details?.license || "unknown"}</td>
      <td className="py-2.5 px-3 text-right">
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-soft hover:text-accent p-1 transition-colors"
          title="Remove candidate"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
};
