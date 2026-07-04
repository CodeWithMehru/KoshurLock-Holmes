import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTimeline, type TimelineEvent } from "@/lib/api";
import { cn, shortTs } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

const DEMO_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Rahul Sharma", value: "sharma" },
  { label: "D. Kapoor", value: "kapoor" },
  { label: "Attacker IP", value: "41.220.13.7" },
];

const ATTACKER_IP = "41.220.13.7";

// Badge/CCTV rows placing a subject onsite are the physical alibi (counter-evidence).
function isAlibi(e: TimelineEvent): boolean {
  const s = (e.source || "").toLowerCase();
  return s.includes("badge") || s.includes("cctv");
}

export function TimelinePanel({
  onOpenEvidence,
  isDemo = true,
}: {
  onOpenEvidence: (f: string) => void;
  isDemo?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useTimeline(filter || undefined);
  const events = data?.events ?? [];
  const filters = isDemo ? DEMO_FILTERS : [{ label: "All", value: "" }];

  return (
    <Card className="min-h-0 flex-1">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>Timeline</CardTitle>
          <span className="font-mono text-2xs text-muted tabular-nums">
            {events.length} events
          </span>
        </div>
        <div className="flex items-center gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-[7px] px-2.5 py-1 text-2xs transition-colors duration-150",
                filter === f.value
                  ? "bg-gradient-to-r from-accent/[0.22] to-[#A855F7]/[0.10] text-accent-hi"
                  : "text-muted hover:bg-[rgba(30,36,68,0.5)] hover:text-ink"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardBody className="min-h-0 flex-1 overflow-auto p-0">
        {isLoading && (
          <div className="flex items-center gap-2 p-3 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> loading timeline...
            <span className="shimmer h-1.5 w-32 rounded-full" aria-hidden />
          </div>
        )}
        <table className="w-full text-left">
          {/* thead stays SOLID - rows must not ghost through while scrolling */}
          <thead className="sticky top-0 z-10 bg-[#0D1022]">
            <tr className="border-b border-border text-3xs font-semibold uppercase tracking-[0.1em] text-faint">
              <th className="px-3 py-1.5 font-medium">Time</th>
              <th className="px-2 py-1.5 font-medium">Source</th>
              <th className="hidden px-2 py-1.5 font-medium md:table-cell">Actor</th>
              <th className="px-2 py-1.5 font-medium">Event</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {events.map((e, i) => {
              const attacker = e.ip === ATTACKER_IP;
              const alibi = !attacker && isAlibi(e);
              return (
                <tr
                  key={i}
                  className={cn(
                    "align-top transition-colors",
                    attacker && "bg-bad/[0.06]",
                    alibi && "bg-info/[0.05]",
                    !attacker && !alibi && "hover:bg-[rgba(30,36,68,0.4)]"
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span
                      className={cn(
                        "border-l-2 pl-2 font-mono text-2xs tabular-nums",
                        attacker
                          ? "border-bad text-bad"
                          : alibi
                          ? "border-info text-muted"
                          : "border-transparent text-muted"
                      )}
                    >
                      {shortTs(e.timestamp)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => onOpenEvidence(e.source)}
                      className="rounded-sm border border-border bg-[rgba(30,36,68,0.5)] px-2 py-0.5 font-mono text-3xs text-faint transition-colors hover:border-accent hover:text-accent-hi"
                      title={`open ${e.source}`}
                    >
                      {e.source}
                    </button>
                  </td>
                  <td className="hidden px-2 py-1.5 font-mono text-2xs text-muted md:table-cell">
                    {e.actor || "—"}
                  </td>
                  <td className={cn("px-2 py-1.5 text-xs leading-relaxed", attacker ? "text-bad/90" : "text-ink")}>
                    {e.description}
                    {attacker && (
                      <span className="ml-2 rounded-[5px] border border-bad/50 bg-bad/[0.12] px-1 align-middle font-mono text-3xs font-bold text-bad">
                        IOC
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && events.length === 0 && (
          <div className="p-3 text-sm text-muted">no events for this filter</div>
        )}
      </CardBody>
    </Card>
  );
}
