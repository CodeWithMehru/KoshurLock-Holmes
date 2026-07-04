import { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { Loader2, Maximize2, Minus, Plus, RefreshCw, Search } from "lucide-react";
import { useGraph } from "@/lib/api";
import { ENTITY_SHAPES, ENTITY_ORDER } from "@/lib/entities";
import { VIVID_ENTITY_COLORS, BRAND } from "@/components/theme/palette";
import { NodeInspector, type SelectedNode } from "./graph/NodeInspector";

try {
  cytoscape.use(fcose);
} catch {
  /* already registered (hot reload) */
}

const ATTACKER_IP = "41.220.13.7";

// Cytoscape can't read Tailwind classes - these hexes come from the shared
// presentation palette. SELECT is a near-white periwinkle so the selected ring
// stays unambiguous against every vivid entity fill.
const ACCENT = BRAND.accent;
const SELECT = BRAND.select;
const BAD = BRAND.bad;

const baseNodeStyle = {
  label: "data(label)",
  "font-family": "JetBrains Mono, monospace",
  "font-size": 8,
  "font-weight": 500,
  color: "#8A93B4",
  "text-valign": "bottom",
  "text-halign": "center",
  "text-margin-y": 4,
  "text-max-width": "120px",
  "text-wrap": "ellipsis",
  "text-outline-color": "#070A16",
  "text-outline-width": 2,
  "border-width": 1.5,
  "border-color": "#070A16",
  "overlay-opacity": 0,
  width: "mapData(degree, 1, 24, 16, 46)",
  height: "mapData(degree, 1, 24, 16, 46)",
};

const STYLES: any[] = [
  { selector: "node", style: baseNodeStyle },
  ...Object.keys(VIVID_ENTITY_COLORS).map((t) => ({
    selector: `node[type="${t}"]`,
    style: { "background-color": VIVID_ENTITY_COLORS[t], shape: ENTITY_SHAPES[t] },
  })),
  {
    selector: 'node[ioc="1"]',
    style: {
      "underlay-color": BAD,
      "underlay-opacity": 0.3,
      "underlay-padding": 9,
      "border-color": BAD,
      "border-width": 2,
    },
  },
  {
    selector: "edge",
    style: {
      width: 1,
      "line-color": "#2C3566",
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#2C3566",
      "arrow-scale": 0.6,
      label: "data(label)",
      "font-family": "JetBrains Mono, monospace",
      "font-size": 6,
      color: "#8A93B4",
      "text-rotation": "autorotate",
      "text-background-color": "#070A16",
      "text-background-opacity": 0.85,
      "text-background-padding": 1,
      "text-opacity": 0,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-color": SELECT,
      "border-width": 3,
      "overlay-color": ACCENT,
      "overlay-opacity": 0.15,
      color: "#F2F4FF",
    },
  },
  { selector: "node.trace", style: { "border-color": ACCENT, "border-width": 2 } },
  {
    selector: "edge.trace",
    style: {
      "line-color": ACCENT,
      "target-arrow-color": ACCENT,
      width: 1.8,
      "text-opacity": 1,
    },
  },
  { selector: ".faded", style: { opacity: 0.1, "text-opacity": 0 } },
];

const LAYOUT: any = {
  name: "fcose",
  quality: "proof",
  randomize: true,
  animate: true,
  animationDuration: 650,
  animationEasing: "ease-out",
  nodeSeparation: 90,
  idealEdgeLength: 95,
  edgeElasticity: 0.45,
  nodeRepulsion: 12000,
  gravity: 0.25,
  gravityRange: 3.8,
  numIter: 2500,
  tile: true,
  packComponents: true,
  padding: 44,
};

export function KnowledgeGraphPanel({
  onOpenEvidence,
}: {
  onOpenEvidence: (f: string) => void;
}) {
  const [structural, setStructural] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } = useGraph({
    include_structural: structural,
  });
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const elements = useMemo(() => {
    if (!data) return [];
    const degree: Record<string, number> = {};
    data.edges.forEach((e) => {
      degree[e.source] = (degree[e.source] || 0) + 1;
      degree[e.target] = (degree[e.target] || 0) + 1;
    });
    const nodes = data.nodes.map((n) => ({
      data: {
        id: n.id,
        label: n.label,
        type: n.type,
        raw: n.raw_type,
        meta: n.meta,
        degree: degree[n.id] || 1,
        ioc: n.label.includes(ATTACKER_IP) ? "1" : "0",
      },
    }));
    const edges = data.edges.map((e, i) => ({
      data: { id: `e${i}`, source: e.source, target: e.target, label: e.label },
    }));
    return [...nodes, ...edges];
  }, [data]);

  // Type filter (only when nothing is selected): fade non-matching nodes + edges.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || selected) return;
    cy.batch(() => {
      cy.elements().removeClass("faded").removeClass("trace");
      if (activeType) {
        cy.nodes().forEach((n) => {
          if (n.data("type") !== activeType) n.addClass("faded");
        });
        cy.edges().forEach((e) => {
          if (
            e.source().data("type") !== activeType &&
            e.target().data("type") !== activeType
          )
            e.addClass("faded");
        });
      }
    });
  }, [activeType, elements, selected]);

  function selectNodeById(id: string) {
    const cy = cyRef.current;
    if (!cy) return;
    const node = cy.getElementById(id);
    if (!node || node.empty()) return;
    cy.nodes().unselect();
    node.select();
    cy.batch(() => {
      cy.elements().addClass("faded");
      node.closedNeighborhood().removeClass("faded").addClass("trace");
    });
    const neighbors = node
      .neighborhood("node")
      .map((n: cytoscape.NodeSingular) => ({
        id: n.id(),
        label: n.data("label"),
        type: n.data("type"),
      }));
    setSelected({
      id: node.id(),
      label: node.data("label"),
      type: node.data("type"),
      raw: node.data("raw"),
      degree: node.degree(false),
      ioc: node.data("ioc") === "1",
      meta: node.data("meta") ?? {},
      neighbors,
    });
    cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1.1) }, { duration: 350 });
  }

  function clearSelection() {
    const cy = cyRef.current;
    setSelected(null);
    if (cy) {
      cy.nodes().unselect();
      cy.batch(() => cy.elements().removeClass("faded").removeClass("trace"));
    }
  }

  function locate() {
    const cy = cyRef.current;
    if (!cy || !query.trim()) return;
    const q = query.trim().toLowerCase();
    const match = cy
      .nodes()
      .toArray()
      .find((n: cytoscape.NodeSingular) =>
        String(n.data("label")).toLowerCase().includes(q)
      );
    if (match) selectNodeById(match.id());
  }

  const byType = data?.counts.by_type ?? {};

  return (
    // NOTE: no backdrop-blur anywhere inside this container - blur over the
    // cytoscape canvas forces a re-filter every frame and tanks fps. All
    // floating chrome uses .glass-flat (solid translucent, no blur).
    <div className="relative flex-1 overflow-hidden rounded-[14px] border border-border bg-[radial-gradient(circle_at_50%_40%,#0C1024,#070A16)]">
      {/* Header strip */}
      <div className="glass-flat pointer-events-auto absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-3 rounded-[10px] px-3.5 py-2">
        <div className="flex items-center gap-3">
          <span className="label-caps">Knowledge graph</span>
          <span className="font-mono text-2xs text-muted">
            {data ? `${data.counts.nodes} entities / ${data.counts.edges} links` : "..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-[rgba(9,12,26,0.7)] px-2.5 py-1 transition-colors focus-within:border-accent">
            <Search className="h-3 w-3 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && locate()}
              placeholder="locate node..."
              className="w-36 bg-transparent font-mono text-2xs text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
          <button
            onClick={() => setStructural((s) => !s)}
            className={
              "rounded-lg border px-2.5 py-1 text-2xs font-semibold transition-colors " +
              (structural
                ? "border-accent bg-accent/10 text-accent-hi"
                : "border-border-2 bg-[rgba(30,36,68,0.6)] text-muted hover:border-accent hover:text-ink-hi")
            }
            title="toggle document/provenance scaffolding"
          >
            structural
          </button>
        </div>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> building graph...
          </div>
          <div className="shimmer h-1.5 w-40 rounded-full" aria-hidden />
        </div>
      )}
      {isError && (
        <div className="flex h-full items-center justify-center text-sm text-bad">
          failed to load graph
        </div>
      )}
      {data && data.nodes.length === 0 && (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          graph is empty - seed the case first
        </div>
      )}

      {data && data.nodes.length > 0 && (
        <CytoscapeComponent
          key={`${data.counts.nodes}-${data.counts.edges}-${structural}`}
          elements={elements as any}
          stylesheet={STYLES}
          layout={LAYOUT}
          minZoom={0.25}
          maxZoom={2.5}
          wheelSensitivity={0.2}
          style={{ width: "100%", height: "100%" }}
          cy={(cy: cytoscape.Core) => {
            cyRef.current = cy;
            cy.removeAllListeners();
            cy.on("tap", "node", (evt: any) => selectNodeById(evt.target.id()));
            cy.on("tap", (evt: any) => {
              if (evt.target === cy) clearSelection();
            });
            cy.one("layoutstop", () => cy.fit(undefined, 44));
          }}
        />
      )}

      {/* Legend */}
      <div className="glass-flat pointer-events-auto absolute left-3.5 top-16 z-10 animate-fade-in rounded-[11px] p-3">
        <div className="label-caps mb-1.5">Entity types</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {ENTITY_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => {
                clearSelection();
                setActiveType(activeType === t ? null : t);
              }}
              className={
                "flex items-center gap-1.5 text-2xs transition-opacity " +
                (activeType && activeType !== t ? "opacity-40" : "opacity-100")
              }
            >
              <span
                className="inline-block h-[9px] w-[9px] rounded-[2px]"
                style={{ backgroundColor: VIVID_ENTITY_COLORS[t] }}
              />
              <span className="text-muted">{t}</span>
              <span className="ml-auto font-mono tabular-nums text-faint">{byType[t] ?? 0}</span>
            </button>
          ))}
        </div>
        {activeType && (
          <button
            onClick={() => setActiveType(null)}
            className="mt-1.5 text-2xs text-accent-hi hover:underline"
          >
            clear filter
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="glass-flat pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-[3px] rounded-[11px] p-[5px]">
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
          title="zoom out"
          className="rounded-[7px] p-1.5 text-muted transition-colors hover:bg-accent/[0.16] hover:text-accent-hi"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => cyRef.current?.fit(undefined, 44)}
          title="fit"
          className="rounded-[7px] p-1.5 text-muted transition-colors hover:bg-accent/[0.16] hover:text-accent-hi"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
          title="zoom in"
          className="rounded-[7px] p-1.5 text-muted transition-colors hover:bg-accent/[0.16] hover:text-accent-hi"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            refetch();
            cyRef.current?.layout(LAYOUT).run();
          }}
          title="re-layout"
          className="rounded-[7px] p-1.5 text-muted transition-colors hover:bg-accent/[0.16] hover:text-accent-hi"
        >
          <RefreshCw className={"h-3.5 w-3.5 " + (isFetching ? "animate-spin" : "")} />
        </button>
      </div>

      {/* Node inspector */}
      {selected && (
        <NodeInspector
          node={selected}
          onClose={clearSelection}
          onLocate={selectNodeById}
          onOpenEvidence={onOpenEvidence}
        />
      )}
    </div>
  );
}
