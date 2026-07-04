import {
  User,
  KeyRound,
  HardDrive,
  Globe,
  FileText,
  MapPin,
  Zap,
  ScrollText,
  Circle,
  type LucideIcon,
} from "lucide-react";
import type { EntityType } from "./api";

// Categorical palette for the knowledge graph, legend, and badges. Vivid
// aurora tones (kept in sync with components/theme/palette.ts) - deliberately
// clear of the violet selection accent and the status hues so a highlight
// always reads as "selected", never as a type.
export const ENTITY_COLORS: Record<string, string> = {
  Person: "#5B8DEF",
  Account: "#A78BFA",
  Device: "#E879F9",
  IP: "#F59E5B",
  File: "#FBD34D",
  Location: "#5EEAD4",
  Event: "#F472B6",
  Document: "#8B94B8",
  Other: "#94A3B8",
};

// Cytoscape node shape per type - a second channel (besides color) so the graph
// stays legible at low zoom and for color-blind users.
export const ENTITY_SHAPES: Record<string, string> = {
  Person: "ellipse",
  Account: "round-rectangle",
  Device: "hexagon",
  IP: "diamond",
  File: "tag",
  Location: "pentagon",
  Event: "triangle",
  Document: "rectangle",
  Other: "ellipse",
};

// lucide glyph per type, for badges/inspector/legend (UI chrome, not the graph).
export const ENTITY_ICON: Record<string, LucideIcon> = {
  Person: User,
  Account: KeyRound,
  Device: HardDrive,
  IP: Globe,
  File: FileText,
  Location: MapPin,
  Event: Zap,
  Document: ScrollText,
  Other: Circle,
};

export const ENTITY_ORDER: EntityType[] = [
  "Person", "Account", "Device", "IP", "File", "Location", "Event", "Other",
];

export function entityColor(t: string): string {
  return ENTITY_COLORS[t] ?? ENTITY_COLORS.Other;
}

export function entityShape(t: string): string {
  return ENTITY_SHAPES[t] ?? ENTITY_SHAPES.Other;
}
