import { useId } from "react";
import { cn } from "@/lib/utils";

/** KoshurLock Holmes mark - a magnifying lens over a connected entity graph.
 * Geometry and gradient from the "KoshurLock Aurora" design. Purely
 * presentational. `animated` runs the design's slow node pulse (disabled by
 * the global prefers-reduced-motion block). */
export function Logo({
  size = 28,
  className,
  animated = false,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  // useId output contains ":" - strip to keep url(#...) references clean.
  const gid = `klh-aurora-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", animated && "logopulse", className)}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      {/* Lens */}
      <circle cx="20" cy="20" r="13" stroke={`url(#${gid})`} strokeWidth="2.6" />
      {/* Handle */}
      <line
        x1="29.4"
        y1="29.4"
        x2="41"
        y2="41"
        stroke={`url(#${gid})`}
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      {/* Entity graph inside the lens - 3 nodes, 3 edges */}
      <line x1="15" y1="16.5" x2="24" y2="14" stroke={`url(#${gid})`} strokeWidth="1.1" opacity=".6" />
      <line x1="24" y1="14" x2="22" y2="25" stroke={`url(#${gid})`} strokeWidth="1.1" opacity=".6" />
      <line x1="15" y1="16.5" x2="22" y2="25" stroke={`url(#${gid})`} strokeWidth="1.1" opacity=".6" />
      <circle cx="15" cy="16.5" r="2.4" fill={`url(#${gid})`} />
      <circle cx="24" cy="14" r="2.4" fill={`url(#${gid})`} />
      <circle cx="22" cy="25" r="2.4" fill={`url(#${gid})`} />
    </svg>
  );
}
