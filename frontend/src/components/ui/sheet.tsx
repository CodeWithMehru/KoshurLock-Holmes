import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** A right-side drawer built on Radix Dialog, used for raw evidence display. */
export function Sheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,5,12,0.66)] backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-[560px] flex-col animate-slide-in-right",
            "border-l border-border-2 bg-[rgba(12,15,32,0.98)] shadow-panel focus:outline-none"
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate font-mono text-sm text-ink">{title}</Dialog.Title>
              {subtitle && (
                <Dialog.Description className="mt-0.5 text-2xs text-muted">
                  {subtitle}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded p-1 text-muted transition-colors hover:bg-white/[0.06] hover:text-ink">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
