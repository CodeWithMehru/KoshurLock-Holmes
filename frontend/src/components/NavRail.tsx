import {
  MessageSquare,
  Network,
  Clock,
  Shuffle,
  Upload,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavKey = "investigation" | "graph" | "timeline" | "turn" | "evidence";

const ITEMS: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: "investigation", label: "Investigation", icon: MessageSquare },
  { key: "graph", label: "Knowledge graph", icon: Network },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "turn", label: "The Turn", icon: Shuffle },
  { key: "evidence", label: "Evidence", icon: Upload },
];

export function NavRail({
  nav,
  onNav,
  onCases,
}: {
  nav: NavKey;
  onNav: (k: NavKey) => void;
  onCases: () => void;
}) {
  return (
    <nav className="flex w-[212px] shrink-0 flex-col gap-[3px] border-r border-border bg-[#0A0D1C]/55 px-2.5 py-3 backdrop-blur-lg">
      <button
        onClick={onCases}
        className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left font-semibold text-muted transition-colors duration-150 hover:bg-[rgba(30,36,68,0.5)] hover:text-ink"
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        <span className="text-xs font-medium">Cases</span>
      </button>

      <div className="mx-1.5 my-2 h-px bg-border" />

      <div className="space-y-[3px]">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const active = nav === key;
          return (
            <button
              key={key}
              onClick={() => onNav(key)}
              className={cn(
                "relative flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150",
                active
                  ? "bg-gradient-to-r from-accent/[0.22] to-[#A855F7]/[0.08] text-ink-hi"
                  : "text-muted hover:bg-[rgba(30,36,68,0.5)] hover:text-ink"
              )}
            >
              {active && (
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-[3px] bg-grad-bar-v" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
