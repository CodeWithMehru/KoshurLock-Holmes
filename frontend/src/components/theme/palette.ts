/**
 * Vivid presentation palette for entity types - visual layer only.
 * Shapes, icons and legend order still come from @/lib/entities; this module
 * exists so the color skin can evolve without touching the data layer.
 *
 * Keys MUST exactly match ENTITY_COLORS keys in src/lib/entities.ts - the
 * cytoscape stylesheet generator iterates them to build node[type="..."]
 * selectors. Kept in sync with the person/account/... tokens in
 * tailwind.config.js.
 *
 * Chosen to stay clear of the periwinkle selection accent (#818CF8/#C7D2FE)
 * and the IOC red (#F4565E).
 */
export const VIVID_ENTITY_COLORS: Record<string, string> = {
  Person: "#5B8DEF", // azure
  Account: "#A78BFA", // violet
  Device: "#E879F9", // fuchsia
  IP: "#F59E5B", // orange
  File: "#FBD34D", // gold
  Location: "#5EEAD4", // teal
  Event: "#F472B6", // pink
  Document: "#8B94B8", // slate-lavender
  Other: "#94A3B8", // grey-blue
};

export function vividEntityColor(t: string): string {
  return VIVID_ENTITY_COLORS[t] ?? VIVID_ENTITY_COLORS.Other;
}

/** Brand gradient stops for inline styles (Cytoscape etc. can't read Tailwind).
 * select is deliberately brighter than the design's #A99BFF ring so a selected
 * Account node (fill #A78BFA) still shows an unambiguous ring. */
export const BRAND = {
  blue: "#38BDF8",
  purple: "#A855F7",
  pink: "#EC4899",
  teal: "#22D3EE",
  accent: "#8B7BFF",
  accentHi: "#A99BFF",
  select: "#E3DEFF",
  bad: "#FB5A63",
} as const;
