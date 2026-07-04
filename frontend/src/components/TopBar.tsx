import { useStatus, type CaseItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

/** A single, unobtrusive health dot - the only engine signal left on screen.
 * green: LLM + DB healthy · amber: degraded · red: backend unreachable. */
function HealthDot() {
  const { data, isError } = useStatus();
  let tone = "bg-faint";
  let title = "checking backend";
  if (isError || !data) {
    if (isError) {
      tone = "bg-bad";
      title = "backend unreachable";
    }
  } else {
    const healthy = data.db.connected && data.llm.ok && data.embeddings.ok;
    tone = healthy ? "bg-ok" : "bg-warn";
    title = healthy
      ? `online · ${data.llm.model} · ${data.db.unified}`
      : "degraded";
  }
  const glow =
    tone === "bg-ok"
      ? "shadow-[0_0_0_3px_rgba(52,211,153,.22)] animate-glow-pulse"
      : tone === "bg-warn"
        ? "shadow-[0_0_0_3px_rgba(251,191,36,.20)]"
        : tone === "bg-bad"
          ? "shadow-[0_0_0_3px_rgba(251,90,99,.22)]"
          : "";
  return (
    <span
      className="flex items-center"
      title={title + (data && !data.openai_present ? " · no OpenAI" : "")}
    >
      <span className={cn("inline-block h-2 w-2 rounded-full", tone, glow)} />
    </span>
  );
}

export function TopBar({ activeCase }: { activeCase?: CaseItem }) {
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-[#0A0D1C]/70 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Logo size={26} className="drop-shadow-[0_0_6px_rgba(139,123,255,.45)]" />
        <span className="whitespace-nowrap text-sm font-bold text-ink-hi">
          KoshurLock Holmes
        </span>
        <span className="h-4 w-px bg-border" />
        {activeCase ? (
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-ink">{activeCase.name}</span>
            <span className="font-mono text-2xs text-muted">{activeCase.case_id_label}</span>
            <span className="hidden font-mono text-2xs text-faint sm:inline">
              {activeCase.descriptor}
            </span>
          </div>
        ) : (
          <span className="text-2xs text-faint">no case loaded</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="label-caps">Status</span>
        <HealthDot />
      </div>
    </header>
  );
}
