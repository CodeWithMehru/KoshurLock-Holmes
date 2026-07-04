import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Same-origin: dev vite proxies /api -> :8000; prod nginx proxies /api -> backend.
const BASE = "/api";

export type EntityType =
  | "Person" | "Account" | "Device" | "IP" | "File" | "Location" | "Event"
  | "Document" | "Other";

export interface StatusResp {
  llm: { provider: string; model: string; ok: boolean };
  embeddings: { provider: string; model: string; dim: number | string; ok: boolean };
  db: {
    relational: string; vector: string; graph: string; unified: string;
    connected: boolean;
  };
  ingested: boolean;
  nodes: number | null;
  edges: number | null;
  openai_present: boolean;
}

export interface SourceItem {
  filename: string;
  source_type: string;
  reliability: string;
  held_back: boolean;
  purged: boolean;
  in_graph: boolean;
}

export interface AskResp {
  question: string;
  answer: string;
  entities: string[];
  timeline: string[];
  sources: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  raw_type: string;
  meta: Record<string, unknown>;
}
export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}
export interface GraphResp {
  nodes: GraphNode[];
  edges: GraphEdge[];
  counts: { nodes: number; edges: number; by_type: Record<string, number> };
}

export interface TimelineEvent {
  timestamp: string;
  actor: string | null;
  description: string;
  source: string;
  ip: string | null;
}
export interface TimelineResp {
  events: TimelineEvent[];
  count: number;
  actor: string | null;
}

export interface EvidenceResp {
  filename: string;
  source_type: string;
  reliability: string;
  header: string;
  lines: string[];
  line: string | null;
}

export type FileStatus = "queued" | "processing" | "in_graph" | "failed";

export interface CaseFile {
  filename: string;
  status: FileStatus;
  error?: string;
}

export interface CaseItem {
  id: string;
  name: string;
  case_id_label: string;
  descriptor: string;
  kind: "demo" | "upload";
  evidence_dir: string;
  dataset: string;
  created_at: string;
  files: CaseFile[];
  materialized: boolean;
  active: boolean;
  file_count: number;
  in_graph_count: number;
}

export interface CasesResp {
  active_case_id: string;
  materialized_case_id: string;
  cases: CaseItem[];
  snapshot_available: boolean;
}

export interface UploadResp {
  case_id: string;
  accepted: string[];
  rejected: { filename: string; reason: string }[];
  files: CaseFile[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = (j.detail as string) || (j.error as string) || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  status: () => req<StatusResp>("/status"),
  sources: () => req<{ sources: SourceItem[] }>("/sources"),
  graph: (opts?: { include_structural?: boolean; node_set?: string }) => {
    const q = new URLSearchParams();
    if (opts?.include_structural) q.set("include_structural", "true");
    if (opts?.node_set) q.set("node_set", opts.node_set);
    const qs = q.toString();
    return req<GraphResp>("/graph" + (qs ? "?" + qs : ""));
  },
  timeline: (actor?: string) =>
    req<TimelineResp>("/timeline" + (actor ? "?actor=" + encodeURIComponent(actor) : "")),
  evidence: (filename: string) =>
    req<EvidenceResp>("/evidence/" + encodeURIComponent(filename)),
  ask: (question: string, want_timeline = true) =>
    req<AskResp>("/ask", {
      method: "POST",
      body: JSON.stringify({ question, want_timeline }),
    }),
  teach: (correction?: string) =>
    req<Record<string, unknown>>("/teach", {
      method: "POST",
      body: JSON.stringify({ correction: correction ?? null }),
    }),
  forget: (target = "anonymous_tip.txt") =>
    req<Record<string, unknown>>("/forget", {
      method: "POST",
      body: JSON.stringify({ target }),
    }),
  ingest: (rebuild = false) =>
    req<Record<string, unknown>>("/ingest", {
      method: "POST",
      body: JSON.stringify({ rebuild }),
    }),

  // ---- Cases / evidence upload (two-mode entry) ------------------------- //
  cases: () => req<CasesResp>("/cases"),
  createCase: (name: string) =>
    req<{ case: CaseItem }>("/cases", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  caseFiles: (id: string) =>
    req<{ case_id: string; files: CaseFile[]; materialized: boolean }>(
      "/cases/" + encodeURIComponent(id) + "/files"
    ),
  ingestCase: (id: string) =>
    req<Record<string, unknown>>("/cases/" + encodeURIComponent(id) + "/ingest", {
      method: "POST",
    }),
  openCase: (id: string) =>
    req<Record<string, unknown>>("/cases/" + encodeURIComponent(id) + "/open", {
      method: "POST",
    }),
  deleteCase: (id: string) =>
    req<Record<string, unknown>>("/cases/" + encodeURIComponent(id), {
      method: "DELETE",
    }),
  uploadFiles: async (id: string, files: File[]): Promise<UploadResp> => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    // NB: no JSON Content-Type - the browser sets the multipart boundary.
    const res = await fetch(BASE + "/cases/" + encodeURIComponent(id) + "/files", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = await res.json();
        detail = (j.detail as string) || (j.error as string) || detail;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return (await res.json()) as UploadResp;
  },
};

// ---- React Query hooks ---------------------------------------------------- //
export function useStatus() {
  return useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 15_000 });
}
export function useSources() {
  return useQuery({ queryKey: ["sources"], queryFn: api.sources });
}
export function useGraph(opts?: { include_structural?: boolean; node_set?: string }) {
  return useQuery({
    queryKey: ["graph", opts?.include_structural ?? false, opts?.node_set ?? null],
    queryFn: () => api.graph(opts),
  });
}
export function useTimeline(actor?: string) {
  return useQuery({ queryKey: ["timeline", actor ?? null], queryFn: () => api.timeline(actor) });
}
export function useCases() {
  return useQuery({ queryKey: ["cases"], queryFn: api.cases });
}

/** Invalidate everything the graph/state affects after a mutation or case swap. */
export function useInvalidateCase() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["graph"] });
    qc.invalidateQueries({ queryKey: ["status"] });
    qc.invalidateQueries({ queryKey: ["sources"] });
    qc.invalidateQueries({ queryKey: ["timeline"] });
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: ["evidence"] });
  };
}

export function useTeach() {
  const invalidate = useInvalidateCase();
  return useMutation({ mutationFn: (c?: string) => api.teach(c), onSuccess: invalidate });
}
export function useForget() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (t?: string) => api.forget(t),
    onSuccess: invalidate,
  });
}
export function useIngest() {
  const invalidate = useInvalidateCase();
  return useMutation({
    mutationFn: (rebuild?: boolean) => api.ingest(rebuild),
    onSuccess: invalidate,
  });
}
