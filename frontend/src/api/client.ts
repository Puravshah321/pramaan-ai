/** Client for Pramaan AI backend API. */
import axios from "axios";

const API_BASE = ""; // Vite proxy redirects /api to http://localhost:8000

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface ApiHealth {
  status: string;
  local_runner: boolean;
  engine?: string;
  mode?: string;
  offline_mode?: boolean;
  device?: string;
  gpu?: any;
  cpu?: any;
  ram?: any;
  models_ready?: number;
  total_local_models?: number;
  huggingface?: {
    reachable?: boolean;
    token_present: boolean;
    hub_reachable?: boolean;
    token_message?: string | null;
    mode?: string;
    billing_url?: string;
    tokens_url?: string;
  };
}

export interface SetupConfig {
  embedding_model: string | null;
  language_model: string | null;
  dataset_id: string | null;
  ui_preferences: Record<string, any>;
  configured?: boolean;
}

export interface WorkspaceStats {
  runs_count: number;
  configs_measured: number;
  last_run: {
    id: string;
    name: string;
    status: string;
    created_at: string;
  } | null;
  empty: boolean;
}

export interface ModelSearchResult {
  id: string;
  pipeline_tag: string | null;
  downloads: number;
  likes: number;
  gated: boolean;
  tags: string[];
  parameters: number | null;
  estimated_memory_gb?: number;
  inference_available: boolean;
  local_only: boolean;
  status_label?: string;
}

export interface ModelDetails {
  id: string;
  pipeline_tag?: string;
  gated?: boolean;
  downloads?: number;
  likes?: number;
  parameters?: number;
  estimated_memory_gb?: number;
  license?: string;
  inference_route?: string;
  inference_available?: boolean;
  status_label?: string;
  route_reason?: string;
  available?: boolean;
  error?: string;
  access_url?: string;
  library_name?: string;
}

export interface LocalModelInfo {
  model_id: string;
  quantization: string;
  filename: string;
  repo_id: string;
  is_embedding: boolean;
  status: "ready" | "not_downloaded" | "downloading" | "failed";
  size_mb: number;
  free_disk_gb: number;
  estimated_memory_gb: number;
}

export interface HardwareProfile {
  id: string;
  name: string;
  category: string;
  memory_gb: number;
  memory_type: string;
  budget_gb: number;
  bandwidth_gbps?: number | null;
  source: string;
  description: string;
}

export interface HardwareDetection {
  detected?: any;
  benchmark_hardware?: any;
  machine: {
    device: string;
    profile_match: string;
    chip: string;
    chip_category: string;
    vram_gb: number;
    ram_gb: number;
    is_unified: boolean;
    auto_budget_gb: number;
  };
  profiles: HardwareProfile[];
  latency_disclaimer: string;
}

export async function fetchHealth(): Promise<ApiHealth> {
  const res = await api.get("/api/health");
  return res.data;
}

export async function recheckHealth(): Promise<ApiHealth> {
  const res = await api.post("/api/health/recheck");
  return res.data;
}

export async function fetchHardware(): Promise<HardwareDetection> {
  const res = await api.get("/api/hardware");
  return res.data;
}

export async function fetchSetup(): Promise<SetupConfig> {
  const res = await api.get("/api/setup");
  return res.data;
}

export async function updateSetup(config: Partial<SetupConfig>) {
  const res = await api.put("/api/setup", config);
  return res.data;
}

export async function fetchSetupSuggestions() {
  const res = await api.get("/api/setup/suggestions");
  return res.data;
}

export async function fetchStats(): Promise<WorkspaceStats> {
  const res = await api.get("/api/stats");
  return res.data;
}

export async function searchModels(q: string, task?: string, limit: number = 20): Promise<ModelSearchResult[]> {
  const res = await api.get("/api/hf/models", { params: { q, task, limit } });
  return res.data;
}

export async function fetchModelDetails(modelId: string): Promise<ModelDetails> {
  const parts = modelId.split("/");
  if (parts.length === 2) {
    const res = await api.get(`/api/hf/models/${parts[0]}/${parts[1]}`);
    return res.data;
  }
  const res = await api.get("/api/hf/models", { params: { q: modelId, limit: 1 } });
  if (res.data && res.data.length > 0) return res.data[0];
  return { id: modelId, available: true, estimated_memory_gb: 1.0 };
}

export async function fetchModelMemory(modelId: string, quantization: string = "q4_k_m") {
  const res = await api.get("/api/hf/models/memory", { params: { model_id: modelId, quantization } });
  return res.data;
}

export async function fetchLocalModels(): Promise<LocalModelInfo[]> {
  const res = await api.get("/api/hf/models/local");
  return res.data;
}

export async function downloadLocalModel(modelId: string, quantization: string = "q4_k_m", isEmbedding: boolean = false) {
  const res = await api.post("/api/hf/models/download", {
    model_id: modelId,
    quantization,
    is_embedding: isEmbedding,
  });
  return res.data;
}

export async function searchDatasets(q: string, limit: number = 20) {
  const res = await api.get("/api/hf/datasets", { params: { q, limit } });
  return res.data;
}

export async function fetchDatasetRows(datasetId: string, offset: number = 0, length: number = 10, split?: string) {
  const res = await api.get(`/api/hf/datasets/${datasetId}/rows`, { params: { offset, length, split } });
  return res.data;
}

export async function loadDatasetIntoCorpus(datasetId: string, split: string = "validation", count: number = 200) {
  const res = await api.post("/api/corpora/load-dataset", {
    dataset_id: datasetId,
    split,
    count,
  });
  return res.data;
}

export async function fetchActiveDataset() {
  const res = await api.get("/api/datasets/active");
  return res.data;
}

export async function testModelInference(modelId: string, prompt?: string) {
  const res = await api.post("/api/hf/models/test", { model_id: modelId, prompt });
  return res.data;
}

export async function fetchRuns(includeInvalid: boolean = false) {
  const res = await api.get("/api/runs", { params: { include_invalid: includeInvalid } });
  return res.data;
}

export async function fetchRun(id: string) {
  const res = await api.get(`/api/runs/${id}`);
  return res.data;
}

export async function previewRunCost(payload: any) {
  const res = await api.post("/api/runs/preview", payload);
  return res.data;
}

export async function startBenchmarkRun(payload: any) {
  const res = await api.post("/api/runs", payload);
  return res.data;
}

export async function cancelBenchmarkRun(id: string) {
  const res = await api.post(`/api/runs/${id}/cancel`);
  return res.data;
}

export async function fetchResults(runId?: string, includeInvalid: boolean = false, groupRepeats: boolean = true) {
  const res = await api.get("/api/results", { params: { run_id: runId, include_invalid: includeInvalid, group_repeats: groupRepeats } });
  return res.data;
}

export async function fetchFactorEffects() {
  const res = await api.get("/api/results/effects");
  return res.data;
}

export async function fetchReliabilitySummary() {
  const res = await api.get("/api/reliability/summary");
  return res.data;
}

export async function trainReliabilityChecker() {
  const res = await api.post("/api/reliability/train");
  return res.data;
}

export async function fetchRecommendation(params: {
  memory_gb?: number;
  latency_s?: number;
  goal?: string;
}) {
  const res = await api.get("/api/recommend", { params });
  return res.data;
}

export async function askTryIt(payload: any) {
  const res = await api.post("/api/ask", payload);
  return res.data;
}

export interface ShowcaseData {
  has_data: boolean;
  document_title?: string;
  excerpt?: string;
  highlight_span?: string;
  question?: string;
  answer?: string;
  badge?: "Reliable" | "Uncertain" | "Unreliable";
  confidence?: number;
  reasons?: string[];
  setup_used?: string;
  timestamp?: string | null;
}

export async function fetchLatestShowcase(): Promise<ShowcaseData> {
  const res = await api.get("/api/showcase/latest");
  return res.data;
}

export async function suggestQuestions(payload: {
  dataset_id?: string;
  document_text?: string;
  language_model?: string;
}) {
  const res = await api.post("/api/questions/suggest", payload);
  return res.data;
}
