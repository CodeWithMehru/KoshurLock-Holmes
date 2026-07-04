import { cn } from "@/lib/utils";

export type LEDTone = "ok" | "warn" | "bad" | "live" | "idle";

const CORE: Record<LEDTone, string> = {
  ok: "#34D399",
  warn: "#FBBF24",
  bad: "#FB5A63",
  live: "#38BDF8",
  idle: "#5A6489",
};
const RING: Record<LEDTone, string> = {
  ok: "rgba(52,211,153,.22)",
  warn: "rgba(251,191,36,.20)",
  bad: "rgba(251,90,99,.22)",
  live: "rgba(56,189,248,.22)",
  idle: "transparent",
};

/** SOC status light: core + soft ring. Live/ok pulse slowly; alarms stay steady. */
export function StatusLED({
  tone = "idle",
  pulse = false,
  className,
}: {
  tone?: LEDTone;
  pulse?: boolean;
  className?: string;
}) {
  const canPulse = pulse && tone !== "bad" && tone !== "idle";
  return (
    <span
      className={cn("led", canPulse && "led--pulse", className)}
      style={
        {
          "--led-core": CORE[tone],
          "--led-ring": RING[tone],
        } as React.CSSProperties
      }
    />
  );
}
