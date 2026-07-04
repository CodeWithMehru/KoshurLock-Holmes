import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Play, ArrowRight, Check, ArrowRightLeft } from "lucide-react";
import { api, useInvalidateCase, type AskResp, type CaseItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusLED } from "@/components/ui/status-led";

const DEMO_Q =
  "Who is responsible for the after-hours download and exfiltration of the customer database on the night of 30 June - 1 July, and what actually happened?";

type Phase = "idle" | "before" | "teach" | "forget" | "after" | "done";

const DEMO_STEPS: { key: Phase; label: string; desc: string }[] = [
  { key: "before", label: "Recall", desc: "ask with the raw evidence + planted tip" },
  { key: "teach", label: "Improve", desc: "teach the confirmed phishing / attacker finding" },
  { key: "forget", label: "Forget", desc: "delete the planted anonymous tip" },
  { key: "after", label: "Recall", desc: "ask again - the conclusion re-derives" },
];

const MD = {
  p: (p: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-accent-hi" {...p} />,
  ul: (p: any) => <ul className="mb-2 ml-4 list-disc space-y-1" {...p} />,
  ol: (p: any) => <ol className="mb-2 ml-4 list-decimal space-y-1" {...p} />,
};

function AnswerColumn({
  title,
  tone,
  res,
  onOpenEvidence,
  strike = [],
  emphasize = false,
}: {
  title: string;
  tone: "bad" | "ok";
  res: AskResp | null;
  onOpenEvidence: (f: string) => void;
  strike?: string[];
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-[rgba(13,16,34,0.6)] transition-all duration-300",
        tone === "bad" && "border-bad/35",
        tone === "ok" && (emphasize ? "border-ok/45 shadow-glow-ok" : "border-ok/45")
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-3.5 py-2.5",
          tone === "bad" ? "bg-bad/[0.08]" : "bg-ok/[0.08]"
        )}
      >
        <span
          className={cn(
            "text-2xs font-bold uppercase tracking-[0.08em]",
            tone === "bad" ? "text-bad" : "text-ok"
          )}
        >
          {title}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!res && (
          <div className="space-y-2">
            <div className="font-mono text-2xs text-faint">not run yet</div>
            <div className="shimmer h-1.5 w-32 rounded-full" aria-hidden />
          </div>
        )}
        {res && (
          <>
            <div className="text-sm text-ink">
              <ReactMarkdown components={MD}>{res.answer}</ReactMarkdown>
            </div>
            {res.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {res.sources.map((f) => {
                  const struck = strike.includes(f);
                  return (
                    <button
                      key={f}
                      onClick={() => onOpenEvidence(f)}
                      className={cn(
                        "chip font-mono hover:border-accent/60 hover:text-ink",
                        struck && "text-faint line-through decoration-bad/70"
                      )}
                      title={struck ? `${f} (forgotten)` : f}
                    >
                      {f}
                      {struck && <span className="text-3xs text-bad no-underline">forgotten</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TheTurnPanel({
  caseItem,
  onOpenEvidence,
}: {
  caseItem: CaseItem;
  onOpenEvidence: (f: string) => void;
}) {
  const isDemo = caseItem.kind === "demo";
  const inGraphFiles = caseItem.files.filter((f) => f.status === "in_graph").map((f) => f.filename);

  const [phase, setPhase] = useState<Phase>("idle");
  const [before, setBefore] = useState<AskResp | null>(null);
  const [after, setAfter] = useState<AskResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateCase();

  // Generic (upload) controls
  const [q, setQ] = useState(
    "Summarize what happened and who or what is most implicated, and why."
  );
  const [forgetTarget, setForgetTarget] = useState(inGraphFiles[0] ?? "");
  const [correction, setCorrection] = useState("");

  const running = phase !== "idle" && phase !== "done";

  async function runDemo() {
    setError(null);
    setBefore(null);
    setAfter(null);
    try {
      setPhase("before");
      setBefore(await api.ask(DEMO_Q, false));
      setPhase("teach");
      await api.teach();
      setPhase("forget");
      await api.forget("anonymous_tip.txt");
      setPhase("after");
      setAfter(await api.ask(DEMO_Q, false));
      invalidate();
      setPhase("done");
    } catch (e) {
      setError((e as Error)?.message ?? "the turn failed");
      setPhase("idle");
    }
  }

  async function runGeneric() {
    if (!forgetTarget) {
      setError("select a source to forget");
      return;
    }
    setError(null);
    setBefore(null);
    setAfter(null);
    try {
      setPhase("before");
      setBefore(await api.ask(q, false));
      if (correction.trim()) {
        setPhase("teach");
        await api.teach(correction.trim());
      }
      setPhase("forget");
      await api.forget(forgetTarget);
      setPhase("after");
      setAfter(await api.ask(q, false));
      invalidate();
      setPhase("done");
    } catch (e) {
      setError((e as Error)?.message ?? "retraction failed");
      setPhase("idle");
    }
  }

  const activeIdx = DEMO_STEPS.findIndex((s) => s.key === phase);
  const flipped = phase === "done" && !!before && !!after;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>
            {isDemo
              ? "The Turn - forget a planted clue, watch the truth re-derive"
              : "Retraction - forget a source and re-derive"}
          </CardTitle>
          <Button onClick={isDemo ? runDemo : runGeneric} disabled={running} size="sm">
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {phase === "done" ? "Run again" : running ? "Running..." : isDemo ? "Run the turn" : "Run"}
          </Button>
        </CardHeader>
        <CardBody>
          {isDemo ? (
            <div className="flex flex-wrap items-center gap-2">
              {DEMO_STEPS.map((s, i) => {
                const done = phase === "done" || (activeIdx >= 0 && i < activeIdx);
                const active = i === activeIdx;
                return (
                  <div key={s.label + i} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-[9px] border px-[11px] py-1.5 text-2xs transition-all duration-300",
                        active
                          ? "border-accent/60 bg-accent/10 text-accent-hi"
                          : done
                          ? "border-ok/40 bg-ok/[0.07] text-ok"
                          : "border-border text-muted"
                      )}
                    >
                      {done ? (
                        <Check className="h-3 w-3" />
                      ) : active ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <StatusLED tone="idle" />
                      )}
                      <span className="font-mono">{i + 1}</span>
                      <span className="font-medium">{s.label}</span>
                      <span className="hidden text-faint lg:inline">{s.desc}</span>
                    </div>
                    {i < DEMO_STEPS.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-faint" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="question to re-derive..."
                className="rounded-[9px] border border-border bg-[rgba(9,12,26,0.7)] px-3 py-2 font-mono text-2xs text-ink transition-all placeholder:text-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/[0.16]"
              />
              <select
                value={forgetTarget}
                onChange={(e) => setForgetTarget(e.target.value)}
                className="rounded-[9px] border border-border bg-[rgba(9,12,26,0.7)] px-2.5 py-2 font-mono text-2xs text-ink transition-all focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/[0.16]"
              >
                {inGraphFiles.length === 0 && <option value="">no in-graph sources</option>}
                {inGraphFiles.map((f) => (
                  <option key={f} value={f}>
                    forget: {f}
                  </option>
                ))}
              </select>
              <textarea
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
                rows={2}
                placeholder="optional analyst correction to teach before forgetting..."
                className="resize-none rounded-[9px] border border-border bg-[rgba(9,12,26,0.7)] px-3 py-2 font-mono text-2xs text-ink transition-all placeholder:text-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/[0.16] md:col-span-2"
              />
            </div>
          )}
          {error && <div className="mt-2 font-mono text-2xs text-bad">{error}</div>}
        </CardBody>
      </Card>

      <div className="flex min-h-0 flex-1 gap-3">
        <AnswerColumn
          title={isDemo ? "Before - implicates Rahul Sharma" : "Before - with all evidence"}
          tone="bad"
          res={before}
          onOpenEvidence={onOpenEvidence}
          strike={isDemo ? ["anonymous_tip.txt"] : forgetTarget ? [forgetTarget] : []}
        />
        <AnswerColumn
          title={
            isDemo
              ? "After - exonerates Rahul, names the external attacker"
              : `After - ${forgetTarget || "source"} forgotten`
          }
          tone="ok"
          res={after}
          onOpenEvidence={onOpenEvidence}
          emphasize={flipped}
        />
      </div>

      {flipped && isDemo && (
        <div className="flex animate-slide-up-fade items-center justify-center gap-3 rounded-xl border border-accent/40 bg-gradient-to-r from-accent/[0.14] to-[#A855F7]/[0.10] px-3 py-3">
          <ArrowRightLeft className="h-4 w-4 text-accent-hi" />
          <span className="text-2xs font-bold uppercase tracking-[0.08em] text-accent-hi">
            Verdict flipped
          </span>
          <span className="font-mono text-2xs text-muted">
            subject: <span className="text-bad line-through">Rahul Sharma</span>{" "}
            <ArrowRight className="inline h-3 w-3 text-faint" />{" "}
            <span className="text-ok">external attacker 41.220.13.7</span>
          </span>
        </div>
      )}
      {flipped && !isDemo && (
        <div className="flex animate-slide-up-fade items-center justify-center gap-2 rounded-xl border border-ok/40 bg-ok/[0.08] px-3 py-3 text-2xs">
          <ArrowRightLeft className="h-4 w-4 text-ok" />
          <span className="font-medium text-ok">Recall re-derived</span>
          <span className="font-mono text-muted">
            after forgetting <span className="text-bad line-through">{forgetTarget}</span>
          </span>
        </div>
      )}
    </div>
  );
}
