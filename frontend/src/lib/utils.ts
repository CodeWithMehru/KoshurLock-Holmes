import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "2026-07-01T02:19:04" -> "07-01 02:19:04" (compact SOC timestamp). */
export function shortTs(ts: string): string {
  return ts.replace(/^\d{4}-/, "").replace("T", " ");
}
