import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENTITY_ICON } from "@/lib/entities";
import { vividEntityColor } from "@/components/theme/palette";
import { EntityBadge } from "@/components/ui/entity-badge";

export interface SelectedNode {
  id: string;
  label: string;
  type: string;
  raw: string;
  degree: number;
  ioc: boolean;
  meta: Record<string, unknown>;
  neighbors: { id: string; label: string; type: string }[];
}

export function NodeInspector({
  node,
  onClose,
  onLocate,
  onOpenEvidence,
}: {
  node: SelectedNode;
  onClose: () => void;
  onLocate: (id: string) => void;
  onOpenEvidence: (f: string) => void;
}) {
  const color = vividEntityColor(node.type);
  const Icon = ENTITY_ICON[node.type] ?? ENTITY_ICON.Other;

  // Group neighbors by type for readability.
  const groups: Record<string, { id: string; label: string; type: string }[]> = {};
  for (const n of node.neighbors) (groups[n.type] ||= []).push(n);

  const bset = Array.isArray(node.meta.belongs_to_set)
    ? (node.meta.belongs_to_set as string[])
    : [];
  const EVIDENCE = /\.(csv|txt)$/i;
  const sourceFile =
    bset.find((f) => EVIDENCE.test(f)) || (EVIDENCE.test(node.label) ? node.label : null);

  // Curate the noisy Cognee meta down to the useful, human-readable fields.
  const metaRows: [string, string][] = [];
  if (node.meta.description) metaRows.push(["description", String(node.meta.description)]);
  if (bset.length) metaRows.push(["source", bset.join(", ")]);

  return (
    // glass-flat (no backdrop-blur): this floats over the cytoscape canvas
    <div className="glass-flat pointer-events-auto absolute right-3.5 top-16 bottom-4 flex w-[308px] animate-scale-in flex-col overflow-hidden rounded-[13px] !border-border-2 shadow-card">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          <span className="text-2xs font-medium uppercase tracking-wider" style={{ color }}>
            {node.type}
          </span>
          {node.ioc && (
            <span className="rounded-[5px] border border-bad/50 bg-bad/[0.12] px-1 py-px font-mono text-3xs font-bold text-bad">
              IOC
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-3xs text-faint">{node.raw}</span>
          <button onClick={onClose} className="rounded-md p-1 text-muted transition-colors hover:bg-[rgba(30,36,68,0.6)] hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        <div>
          <div className="break-words font-mono text-sm text-ink-hi">{node.label}</div>
          <div className="mt-1 font-mono text-2xs text-faint">
            connections: <span className="text-muted">{node.degree}</span>
          </div>
        </div>

        {metaRows.length > 0 && (
          <div>
            <div className="label-caps mb-1">Attributes</div>
            <dl className="space-y-1 rounded-[9px] border border-border bg-[rgba(9,12,26,0.7)] p-2">
              {metaRows.map(([k, v]) => (
                <div key={k} className="flex gap-2 text-2xs">
                  <dt className="w-20 shrink-0 truncate font-mono text-faint" title={k}>
                    {k}
                  </dt>
                  <dd className="min-w-0 flex-1 break-words font-mono text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {node.neighbors.length > 0 && (
          <div>
            <div className="label-caps mb-1">
              Neighbors <span className="text-faint">({node.neighbors.length})</span>
            </div>
            <div className="space-y-1.5">
              {Object.entries(groups).map(([type, items]) => (
                <div key={type}>
                  <div className="mb-0.5 flex items-center gap-1.5 text-3xs text-faint">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-[2px]"
                      style={{ backgroundColor: vividEntityColor(type) }}
                    />
                    {type}
                  </div>
                  <ul className="space-y-px">
                    {items.map((it) => (
                      <li key={it.id}>
                        <button
                          onClick={() => onLocate(it.id)}
                          className="group flex w-full items-center gap-1.5 rounded-[7px] px-2 py-1 text-left transition-colors hover:bg-[rgba(30,36,68,0.55)]"
                          title={`locate ${it.label}`}
                        >
                          <span className="font-mono text-faint transition-colors group-hover:text-accent-hi">&rsaquo;</span>
                          <EntityBadge type={it.type} label={it.label} swatch={false} glyph />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {sourceFile && (
        <div className="border-t border-border p-2.5">
          <button
            onClick={() => onOpenEvidence(sourceFile)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-2 bg-[rgba(30,36,68,0.6)] py-1.5 text-2xs font-semibold text-ink transition-all hover:border-accent hover:text-ink-hi"
          >
            <ExternalLink className="h-3 w-3" />
            open evidence: <span className="font-mono">{sourceFile}</span>
          </button>
        </div>
      )}
    </div>
  );
}
