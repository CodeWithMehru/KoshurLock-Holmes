import { cn } from "@/lib/utils";
import { ENTITY_ICON } from "@/lib/entities";
import { vividEntityColor } from "@/components/theme/palette";

/** A type-colored entity marker: shape swatch + optional glyph + label. Used in
 * the node inspector, legend, console reasoning chain, and timeline. */
export function EntityBadge({
  type,
  label,
  className,
  glyph = false,
  swatch = true,
}: {
  type: string;
  label?: string;
  className?: string;
  glyph?: boolean;
  swatch?: boolean;
}) {
  const color = vividEntityColor(type);
  const Icon = ENTITY_ICON[type] ?? ENTITY_ICON.Other;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {swatch && (
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}55` }}
        />
      )}
      {glyph && <Icon className="h-3 w-3 shrink-0" style={{ color }} />}
      {label != null && (
        <span className="truncate font-mono text-2xs" style={{ color }}>
          {label}
        </span>
      )}
    </span>
  );
}
