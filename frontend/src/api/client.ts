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
  huggingface: {
    reachable: boolean;
    error: string | null;
    token_present: boolean;
  };
  local_runner: boolean;
  database: string;
}

export interface SetupConfig {
  embedding_model: string;
  language_model: string;
  dataset_id: string | null;
  ui_preferences: Record<string, any>;
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
  inference_available: boolean;
  local_only: boolean;
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
  available?: boolean;
  error?: string;
  access_url?: string;
  library_name?: string;
}

export async function fetchHealth(): Promise<ApiHealth> {
  const res = await api.get<ApiHealth>("/api/health");
  return res.data;
}

export async function fetchSetup(): Promise<SetupConfig> {
  const res = await api.get<SetupConfig>("/api/setup");
  return res.data;
}

export async function updateSetup(data: Partial<SetupConfig>): Promise<SetupConfig> {
  const res = await api.put<SetupConfig>("/api/setup", data);
  return res.data;
}

export async function fetchStats(): Promise<WorkspaceStats> {
  const res = await api.get<WorkspaceStats>("/api/stats");
  return res.data;
}

export async function searchModels(q: string, task?: string): Promise<ModelSearchResult[]> {
  const res = await api.get<ModelSearchResult[]>("/api/hf/models", {
    params: { q, task, limit: 12 },
  });
  return res.data;
}

export async function searchDatasets(q: string, limit: number = 20) {
  const res = await api.get("/api/hf/datasets", {
    params: { q, limit },
  });
  return res.data;
}

export async function fetchModelDetails(id: string): Promise<ModelDetails> {
  const res = await api.get<ModelDetails>(`/api/hf/models/${id}`);
  return res.data;
}

export async function testModelInference(modelId: string, prompt?: string) {
  const res = await api.post("/api/hf/models/test", { model_id: modelId, prompt });
  return res.data;
}

export async function fetchRuns() {
  const res = await api.get("/api/runs");
  return res.data;
}

export async function fetchRunDetails(id: string) {
  const res = await api.get(`/api/runs/${id}`);
  return res.data;
}

export async function startBenchmarkRun(payload: any) {
  const res = await api.post("/api/runs", payload);
  return res.data;
}

export async function previewRunCost(payload: any) {
  const res = await api.post("/api/runs/preview", payload);
  return res.data;
}

export async function cancelBenchmarkRun(id: string) {
  const res = await api.post(`/api/runs/${id}/cancel`);
  return res.data;
}

export async function fetchResults(runId?: string) {
  const res = await api.get("/api/results", { params: { run_id: runId } });
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

export async function fetchDatasetRows(datasetId: string) {
  const res = await api.get(`/api/hf/datasets/${datasetId}/rows`);
  return res.data;
}
