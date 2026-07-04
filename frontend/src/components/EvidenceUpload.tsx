import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  UploadCloud,
  FileText,
  Table2,
  FileType2,
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  Play,
  ArrowRight,
} from "lucide-react";
import {
  api,
  useSources,
  type CaseFile,
  type CaseItem,
  type FileStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ACCEPT = ".csv,.txt,.pdf,.docx,.md";

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return Table2;
  if (ext === "pdf" || ext === "docx" || ext === "doc") return FileType2;
  return FileText;
}

function StatusPill({ file }: { file: CaseFile }) {
  const map: Record<FileStatus, { cls: string; label: string; icon: ReactNode }> = {
    queued: {
      cls: "border-border text-faint",
      label: "queued",
      icon: <Circle className="h-3 w-3" />,
    },
    processing: {
      cls: "shimmer border-info/40 text-info",
      label: "processing",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    in_graph: {
      cls: "border-ok/40 bg-ok/[0.07] text-ok",
      label: "in graph",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    failed: {
      cls: "border-bad/40 bg-bad/[0.10] text-bad",
      label: "failed",
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const s = map[file.status];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-2xs", s.cls)}
      title={file.error || s.label}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

/** Read-only evidence list for the seeded demo case. */
function DemoEvidence({ onOpenEvidence }: { onOpenEvidence: (f: string) => void }) {
  const { data } = useSources();
  const sources = data?.sources ?? [];
  return (
    <Card className="min-h-0 flex-1">
      <CardHeader>
        <CardTitle>Evidence sources</CardTitle>
        <span className="font-mono text-2xs text-muted">{sources.length} sources · seeded (read-only)</span>
      </CardHeader>
      <CardBody className="min-h-0 flex-1 overflow-auto p-0">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-3xs font-semibold uppercase tracking-[0.1em] text-faint">
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Reliability</th>
              <th className="px-3 py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sources.map((s) => {
              const Icon = fileIcon(s.filename);
              const state = s.purged
                ? { t: "text-bad", l: "forgotten" }
                : s.held_back
                ? { t: "text-warn", l: "held back" }
                : s.in_graph
                ? { t: "text-ok", l: "in graph" }
                : { t: "text-faint", l: "not loaded" };
              return (
                <tr key={s.filename} className="transition-colors hover:bg-[rgba(30,36,68,0.4)]">
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onOpenEvidence(s.filename)}
                      className="flex items-center gap-2 font-mono text-2xs text-ink transition-colors hover:text-accent-hi"
                    >
                      <Icon className="h-3.5 w-3.5 text-faint" />
                      {s.filename}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-2xs text-muted">{s.source_type}</td>
                  <td className="px-3 py-2 text-2xs text-faint">{s.reliability}</td>
                  <td className={cn("px-3 py-2 text-2xs", state.t)}>{state.l}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

export function EvidenceUpload({
  activeCase,
  onCaseChanged,
  onOpenInvestigation,
  onOpenEvidence,
}: {
  activeCase: CaseItem;
  onCaseChanged: () => void;
  onOpenInvestigation: () => void;
  onOpenEvidence: (f: string) => void;
}) {
  const caseId = activeCase.id;
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filesQ = useQuery({
    queryKey: ["caseFiles", caseId],
    queryFn: () => api.caseFiles(caseId),
    refetchInterval: (q) => {
      const files = q.state.data?.files ?? [];
      return files.some((f) => f.status === "processing" || f.status === "queued")
        ? 1500
        : false;
    },
  });

  const files = filesQ.data?.files ?? [];
  const materialized = filesQ.data?.materialized ?? false;
  const anyProcessing = files.some((f) => f.status === "processing");
  const anyPending = files.some((f) => f.status === "queued" || f.status === "failed");
  const allInGraph = files.length > 0 && files.every((f) => f.status === "in_graph");

  // Once ingest finishes and this case is materialized, tell App to refetch the
  // top-level /cases query (via onCaseChanged) exactly once, so App's
  // materialized_case_id updates and the Investigation/Graph/Timeline tabs
  // un-gate and populate immediately - no need to re-open the case from home.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (allInGraph && materialized) {
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onCaseChanged();
      }
    } else if (!materialized) {
      notifiedRef.current = false;
    }
  }, [allInGraph, materialized, onCaseChanged]);

  const upload = useMutation({
    mutationFn: (list: File[]) => api.uploadFiles(caseId, list),
    onSuccess: (resp) => {
      filesQ.refetch();
      onCaseChanged();
      if (resp.rejected.length) {
        setNotice(
          "Skipped: " +
            resp.rejected.map((r) => `${r.filename} (${r.reason})`).join(", ")
        );
      } else {
        setNotice(null);
      }
    },
    onError: (e) => setNotice((e as Error).message),
  });

  const ingest = useMutation({
    mutationFn: () => api.ingestCase(caseId),
    onSuccess: () => {
      setTimeout(() => filesQ.refetch(), 400);
      onCaseChanged();
    },
    onError: (e) => setNotice((e as Error).message),
  });

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      upload.mutate(Array.from(list));
    },
    [upload]
  );

  if (activeCase.kind === "demo") {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <DemoEvidence onOpenEvidence={onOpenEvidence} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>Evidence — {activeCase.name}</CardTitle>
          <span className="font-mono text-2xs text-muted">
            {files.length} file{files.length === 1 ? "" : "s"} ·{" "}
            {materialized ? "materialized" : "not ingested"}
          </span>
        </CardHeader>
        <CardBody className="space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all duration-200",
              dragOver
                ? "scale-[1.01] border-accent bg-accent/[0.06] shadow-glow-accent"
                : "border-border-2 hover:border-accent/40 hover:bg-accent/[0.03]"
            )}
          >
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-[#EC4899]/20 transition-colors",
                dragOver ? "text-accent-hi" : "text-faint"
              )}
            >
              <UploadCloud className="h-6 w-6" />
            </span>
            <div className="text-xs text-ink">
              Drop evidence here, or <span className="text-accent-hi">browse</span>
            </div>
            <div className="font-mono text-3xs text-faint">
              CSV · TXT · PDF · DOCX — parsed and ingested through Cognee
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {notice && <div className="font-mono text-2xs text-warn">{notice}</div>}
          {upload.isPending && (
            <div className="flex items-center gap-1.5 text-2xs text-muted">
              <Loader2 className="h-3 w-3 animate-spin text-accent" /> uploading...
              <span className="shimmer h-1.5 w-24 rounded-full" aria-hidden />
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="label-caps">Files</span>
            <Button
              onClick={() => ingest.mutate()}
              disabled={!anyPending || anyProcessing || ingest.isPending}
              size="sm"
            >
              {anyProcessing || ingest.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Ingest evidence
            </Button>
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-left">
              <tbody className="divide-y divide-border/50">
                {files.map((f) => {
                  const Icon = fileIcon(f.filename);
                  return (
                    <tr key={f.filename} className="transition-colors hover:bg-[rgba(30,36,68,0.4)]">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2 font-mono text-2xs text-ink">
                          <Icon className="h-3.5 w-3.5 text-faint" />
                          {f.filename}
                        </span>
                        {f.error && (
                          <div className="mt-0.5 pl-5 font-mono text-3xs text-bad">{f.error}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <StatusPill file={f} />
                      </td>
                    </tr>
                  );
                })}
                {files.length === 0 && (
                  <tr>
                    <td className="px-3 py-5 text-center text-2xs text-faint">
                      no files uploaded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {allInGraph && materialized && (
        <div className="flex animate-slide-up-fade items-center justify-between rounded-xl border border-ok/40 bg-ok/[0.08] px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-2xs text-ok">
            <CheckCircle2 className="h-4 w-4" />
            Evidence ingested — the graph, timeline, and investigation are ready.
          </span>
          <Button size="sm" onClick={onOpenInvestigation}>
            Open investigation <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
