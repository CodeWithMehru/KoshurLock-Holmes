import { useState } from "react";
import { cn } from "@/lib/utils";

/** Monospace, tabular-numeral value (IDs, IPs, timestamps, hashes). Optional
 * click-to-copy. */
export function MonoValue({
  value,
  className,
  copyable = false,
  title,
}: {
  value: string;
  className?: string;
  copyable?: boolean;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = copyable
    ? () => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 900);
      }
    : undefined;
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        copyable && "cursor-pointer hover:text-accent",
        className
      )}
      title={title ?? (copyable ? "click to copy" : undefined)}
      onClick={onClick}
    >
      {copied ? "copied" : value}
    </span>
  );
}
