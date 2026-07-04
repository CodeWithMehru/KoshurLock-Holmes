import { useState } from "react";
import { Database, FolderPlus, ArrowRight, Loader2, Layers, Trash2 } from "lucide-react";
import type { CaseItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export function CasePicker({
  cases,
  snapshotAvailable,
  busy,
  error,
  onOpenDemo,
  onOpenCase,
  onNewInvestigation,
  onDeleteCase,
}: {
  cases: CaseItem[];
  snapshotAvailable: boolean;
  busy: string | null;
  error: string | null;
  onOpenDemo: () => void;
  onOpenCase: (id: string) => void;
  onNewInvestigation: (name: string) => void;
  onDeleteCase: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const demo = cases.find((c) => c.kind === "demo");
  const uploads = cases.filter((c) => c.kind === "upload");

  return (
    <div className="relative min-h-0 flex-1 overflow-auto">
      <div className="stagger-children relative mx-auto flex w-full max-w-[820px] flex-col items-center px-6 pb-20 pt-[14vh] text-center">
        {/* Brand row + pill (design .hero) */}
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center gap-3">
            <Logo size={42} animated />
            <span className="whitespace-nowrap text-xl font-extrabold tracking-tight text-ink-hi">
              KoshurLock Holmes
            </span>
          </div>
          <span className="pill mt-3.5">SOC · forensics</span>
        </div>

        {/* Hero headline */}
        <h1 className="mt-[26px] text-[clamp(44px,7vw,76px)] font-extrabold leading-[1.02] tracking-[-0.03em] [text-wrap:balance]">
          <span className="block text-ink-hi">Every log. One graph.</span>
          <span className="gradient-text block">The whole truth.</span>
        </h1>

        <p className="mx-auto mt-[22px] max-w-[640px] text-[17px] leading-relaxed text-muted">
          Correlate VPN, DLP, email, badge and CCTV evidence into one connected memory —
          then ask it plain-English questions.
        </p>

        <div className="mt-11 grid w-full gap-4 text-left md:grid-cols-2">
          {/* Mode A - demo */}
          <div className="glass flex flex-col rounded-[14px] p-[22px] transition-all duration-200 hover:-translate-y-[3px] hover:border-border-2">
            <div className="mb-2.5 flex items-center gap-2">
              <Database className="h-[17px] w-[17px] text-accent-hi" />
              <span className="label-caps">Load demo case</span>
            </div>
            <div className="mb-1 text-sm font-medium text-ink-hi">
              {demo?.name ?? "Northgate Financial"}
            </div>
            <div className="mb-3 font-mono text-2xs text-muted">
              {demo?.case_id_label ?? "NGF-2026-0701"} · data exfiltration
            </div>
            <p className="mb-4 flex-1 text-2xs leading-relaxed text-faint">
              The seeded Rahul Sharma incident. Loads warm from the committed
              snapshot with zero re-ingestion — for an instant walkthrough.
            </p>
            {!snapshotAvailable && (
              <div className="mb-2 font-mono text-3xs text-warn">
                snapshot not found — run <span className="text-muted">make demo</span> once
              </div>
            )}
            <Button onClick={onOpenDemo} disabled={busy !== null} className="w-full">
              {busy === "demo" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              Open demo case
            </Button>
          </div>

          {/* Mode B - new investigation */}
          <div className="glass flex flex-col rounded-[14px] p-[22px] transition-all duration-200 hover:-translate-y-[3px] hover:border-border-2">
            <div className="mb-2.5 flex items-center gap-2">
              <FolderPlus className="h-[17px] w-[17px] text-muted" />
              <span className="label-caps">New investigation</span>
            </div>
            <div className="mb-1 text-sm font-medium text-ink-hi">Upload your evidence</div>
            <div className="mb-3 font-mono text-2xs text-muted">CSV · TXT · PDF · DOCX</div>
            <p className="mb-4 flex-1 text-2xs leading-relaxed text-faint">
              Create a case and ingest your own files through Cognee. The graph,
              timeline, and investigation populate from what you upload.
            </p>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) onNewInvestigation(name.trim());
                }}
                placeholder="case name..."
                className="min-w-0 flex-1 rounded-[9px] border border-border bg-[rgba(9,12,26,0.7)] px-3 py-2 text-xs text-ink transition-all placeholder:text-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/[0.16]"
              />
              <Button
                variant="subtle"
                onClick={() => name.trim() && onNewInvestigation(name.trim())}
                disabled={busy !== null || !name.trim()}
              >
                {busy === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 w-full rounded-[10px] border border-bad/40 bg-bad/[0.06] px-3 py-2 text-left font-mono text-2xs text-bad">
            {error}
          </div>
        )}

        {/* Existing cases */}
        <div className="mt-4 w-full text-left">
          <div className="label-caps mb-2">
            Cases <span className="text-faint">({cases.length})</span>
          </div>
          <div className="glass overflow-hidden rounded-[14px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-3xs font-semibold uppercase tracking-[0.1em] text-faint">
                  <th className="px-3.5 py-2.5 font-semibold">Case</th>
                  <th className="px-3.5 py-2.5 font-semibold">Type</th>
                  <th className="px-3.5 py-2.5 font-semibold">Evidence</th>
                  <th className="px-3.5 py-2.5 font-semibold">State</th>
                  <th className="px-3.5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {cases.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-[rgba(30,36,68,0.4)]">
                    <td className="px-3 py-2">
                      <div className="text-xs text-ink">{c.name}</div>
                      <div className="font-mono text-3xs text-faint">{c.case_id_label}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="chip text-faint">
                        {c.kind === "demo" ? <Database className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
                        {c.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-2xs text-muted">
                      {c.kind === "demo" ? "seeded" : `${c.in_graph_count}/${c.file_count} files`}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 text-2xs",
                          c.materialized ? "text-ok" : "text-faint"
                        )}
                      >
                        {c.materialized ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-ok shadow-[0_0_0_3px_rgba(52,211,153,.22)]" />
                        ) : (
                          <span className="inline-block h-2 w-2 rounded-full border border-faint" />
                        )}
                        {c.materialized ? "in graph" : "not loaded"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {confirmId === c.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-2xs text-faint">Delete case?</span>
                          <button
                            onClick={() => {
                              onDeleteCase(c.id);
                              setConfirmId(null);
                            }}
                            disabled={busy !== null}
                            className="inline-flex items-center gap-1 rounded-lg border border-bad/50 bg-bad/10 px-2.5 py-1 text-2xs font-semibold text-bad transition-colors hover:bg-bad/20 disabled:opacity-50"
                          >
                            {busy === c.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Delete"
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            disabled={busy !== null}
                            className="rounded-lg border border-border-2 px-2.5 py-1 text-2xs text-muted transition-colors hover:text-ink disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => (c.kind === "demo" ? onOpenDemo() : onOpenCase(c.id))}
                            disabled={busy !== null}
                            className="inline-flex items-center gap-1 rounded-lg border border-border-2 bg-[rgba(30,36,68,0.6)] px-2.5 py-1 text-2xs font-semibold text-ink transition-all hover:border-accent hover:text-ink-hi disabled:opacity-50"
                          >
                            {busy === c.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                Open <ArrowRight className="h-3 w-3" />
                              </>
                            )}
                          </button>
                          {c.kind !== "demo" && (
                            <button
                              onClick={() => setConfirmId(c.id)}
                              disabled={busy !== null}
                              title="Delete case"
                              className="rounded-md border border-transparent p-1 text-faint transition-colors hover:border-bad/40 hover:text-bad disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-2xs text-faint">
                      no cases yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
