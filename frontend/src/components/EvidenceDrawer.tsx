import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sheet } from "@/components/ui/sheet";

/** Right-side drawer showing the raw provenance-wrapped log lines for a source.
 * Opened by citation chips and by clicking an evidence source in the sidebar. */
export function EvidenceDrawer({
  filename,
  onClose,
  highlight,
}: {
  filename: string | null;
  onClose: () => void;
  highlight?: string | null;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["evidence", filename],
    queryFn: () => api.evidence(filename as string),
    enabled: !!filename,
  });

  return (
    <Sheet
      open={!!filename}
      onOpenChange={(o) => !o && onClose()}
      title={filename ?? ""}
      subtitle={data ? `${data.source_type} - ${data.reliability}` : undefined}
    >
      {isLoading && (
        <div className="flex items-center gap-2 text-2xs text-muted">
          loading raw log...
          <span className="shimmer h-1.5 w-24 rounded-full" aria-hidden />
        </div>
      )}
      {isError && (
        <div className="text-2xs text-bad">
          {(error as Error)?.message ?? "failed to load evidence"}
        </div>
      )}
      {data && (
        <div className="space-y-3">
          <pre className="whitespace-pre-wrap rounded-[9px] border border-border bg-[rgba(9,12,26,0.7)] p-3 font-mono text-2xs text-faint">
            {data.header}
          </pre>
          <ol className="space-y-1">
            {data.lines.map((ln, i) => {
              const hit =
                highlight &&
                ln.toLowerCase().includes(highlight.toLowerCase());
              return (
                <li
                  key={i}
                  className={
                    "flex gap-2 rounded px-2 py-1 font-mono text-xs leading-relaxed " +
                    (hit ? "bg-accent/[0.12] text-ink-hi ring-1 ring-inset ring-accent/40" : "text-muted")
                  }
                >
                  <span className="select-none text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">{ln}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Sheet>
  );
}
