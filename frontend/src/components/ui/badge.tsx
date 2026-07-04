import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("chip", className)} {...p} />;
}

/** A small status dot. tone: ok | warn | bad | muted */
export function Dot({ tone = "muted" }: { tone?: "ok" | "warn" | "bad" | "muted" }) {
  const color =
    tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-bad" : "bg-faint";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", color)} />;
}
