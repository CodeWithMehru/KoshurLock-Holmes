import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Loader2, Search, CornerDownLeft, FileText, ExternalLink } from "lucide-react";
import { api, type AskResp } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_Q =
  "Who is responsible for the after-hours download and exfiltration of the customer database on the night of 30 June - 1 July, and what actually happened?";

const SAMPLES = [
  "Was the person logged in from the foreign IP physically in the office at 2 AM? Cite the logs.",
  "Trace the path from IP 41.220.13.7 to the exfiltrated customer files.",
  "Who accessed Q4_Customer_Database.xlsx, from where, and when?",
];

const MD = {
  p: (p: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-accent-hi" {...p} />,
  code: (p: any) => (
    <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs text-ink" {...p} />
  ),
  ul: (p: any) => <ul className="mb-2 ml-4 list-disc space-y-1" {...p} />,
  ol: (p: any) => <ol className="mb-2 ml-4 list-decimal space-y-1" {...p} />,
};

/** Pull highlightable tokens (IPs, session ids, filenames) out of the answer so
 * the inline raw-log expansion can cyan-ring the lines that matter. */
function highlightTerms(answer: string): string[] {
  const terms = new Set<string>();
  (answer.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) || []).forEach((t) => terms.add(t));
  (answer.match(/VPN-\d+/g) || []).forEach((t) => terms.add(t));
  (answer.match(/[\w.-]+@[\w.-]+/g) || []).forEach((t) => terms.add(t));
  (answer.match(/[\w-]+\.(?:xlsx|csv|docx|txt)/g) || []).forEach((t) => terms.add(t));
  return [...terms];
}

function CitationChip({
  file,
  terms,
  onOpenFull,
}: {
  file: string;
  terms: string[];
  onOpenFull: (f: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["evidence", file],
    queryFn: () => api.evidence(file),
    enabled: open,
  });

  const hitLine = (ln: string) => terms.some((t) => ln.includes(t));

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "chip font-mono transition-colors hover:border-accent hover:text-ink",
            open && "border-accent text-accent-hi"
          )}
          title="expand raw log lines"
        >
          <FileText className="h-3 w-3 text-accent-hi" />
          {file}
        </button>
      </div>
      {open && (
        <div className="mt-1.5 animate-scale-in rounded-[9px] border border-border bg-[rgba(9,12,26,0.8)] p-2">
          {!data && (
            <div className="flex items-center gap-1.5 text-2xs text-faint">
              <Loader2 className="h-3 w-3 animate-spin text-accent" /> loading {file}...
              <span className="shimmer h-1.5 w-24 rounded-full" aria-hidden />
            </div>
          )}
          {data && (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-3xs uppercase tracking-wider text-faint">
                  {data.source_type} - {data.reliability}
                </span>
                <button
                  onClick={() => onOpenFull(file)}
                  className="flex items-center gap-1 text-2xs text-faint transition-colors hover:text-accent-hi"
                >
                  <ExternalLink className="h-3 w-3" /> full source
                </button>
              </div>
              <ol className="max-h-52 space-y-px overflow-auto">
                {data.lines.map((ln, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex gap-2 rounded px-1.5 py-0.5 font-mono text-2xs leading-relaxed",
                      hitLine(ln)
                        ? "bg-accent/[0.12] text-ink-hi ring-1 ring-inset ring-accent/40"
                        : "text-muted"
                    )}
                  >
                    <span className="select-none text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">{ln}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function InvestigationConsole({
  onOpenEvidence,
  isDemo = true,
}: {
  onOpenEvidence: (f: string) => void;
  isDemo?: boolean;
}) {
  const [q, setQ] = useState(isDemo ? DEFAULT_Q : "");
  const ask = useMutation({ mutationFn: (question: string) => api.ask(question) });
  const res: AskResp | undefined = ask.data;
  const terms = useMemo(() => (res ? highlightTerms(res.answer) : []), [res]);

  const submit = () => {
    if (q.trim().length >= 3) ask.mutate(q.trim());
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>Investigation console</CardTitle>
          <span className="font-mono text-2xs text-faint">
            recall / graph-completion (multi-hop)
          </span>
        </CardHeader>
        <CardBody className="space-y-2">
          <div className="relative flex items-start rounded-[11px] border border-border bg-[rgba(9,12,26,0.7)] transition-all duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(124,107,255,0.14)]">
            <span className="select-none py-2 pl-3.5 font-mono text-base font-semibold text-accent-hi">&rsaquo;</span>
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
              rows={3}
              className="w-full resize-none bg-transparent px-2 py-2 pr-24 font-mono text-sm text-ink placeholder:text-faint focus:outline-none"
              placeholder="query the case in plain English..."
            />
            <Button
              onClick={submit}
              disabled={ask.isPending}
              size="sm"
              className="absolute bottom-2 right-2"
            >
              {ask.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              ASK
              <CornerDownLeft className="h-3 w-3 opacity-60" />
            </Button>
          </div>
          {isDemo && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="label-caps mr-1">Try</span>
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQ(s);
                    ask.mutate(s);
                  }}
                  className="chip max-w-[280px] truncate text-left transition-colors hover:border-accent hover:text-ink"
                >
                  {s.length > 56 ? s.slice(0, 54) + "..." : s}
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {ask.isPending && (
        <div className="panel shimmer h-24 rounded-md" aria-hidden />
      )}

      {ask.isError && (
        <Card>
          <CardBody className="text-sm text-bad">
            {(ask.error as Error)?.message ?? "the investigation failed"}
          </CardBody>
        </Card>
      )}

      {res && (
        <Card className="min-h-0 flex-1 animate-slide-up-fade overflow-hidden">
          <CardHeader>
            <CardTitle>Conclusion</CardTitle>
            {res.sources.length > 0 && (
              <span className="font-mono text-2xs text-faint">
                {res.sources.length} sources cited
              </span>
            )}
          </CardHeader>
          <CardBody className="min-h-0 flex-1 space-y-4 overflow-auto">
            <div className="relative pl-3.5 text-[15px] leading-[1.65] text-ink before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-grad-bar-v">
              <ReactMarkdown components={MD}>{res.answer}</ReactMarkdown>
            </div>

            {res.sources.length > 0 && (
              <div>
                <div className="label-caps mb-1.5">Citations - click to expand the raw log</div>
                <div className="space-y-1.5">
                  {res.sources.map((f) => (
                    <CitationChip key={f} file={f} terms={terms} onOpenFull={onOpenEvidence} />
                  ))}
                </div>
              </div>
            )}

            {res.entities.length > 0 && (
              <div>
                <div className="label-caps mb-1.5">
                  Connected entities in the graph{" "}
                  <span className="text-faint">({res.entities.length})</span>
                </div>
                <div className="panel overflow-hidden">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-border/50">
                      {res.entities.slice(0, 12).map((e, i) => (
                        <tr key={i} className="align-top transition-colors hover:bg-[rgba(30,36,68,0.4)]">
                          <td className="w-8 select-none px-2 py-1.5 text-right font-mono text-3xs text-faint">
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-2xs leading-relaxed text-muted">
                            {e.length > 260 ? e.slice(0, 258) + "..." : e}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
