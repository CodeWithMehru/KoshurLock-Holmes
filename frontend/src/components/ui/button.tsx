import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Design .gbtn: gradient fill, white text, violet glow, lift on hover.
        default:
          "rounded-[10px] bg-grad-brand text-white font-semibold shadow-btn-glow hover:-translate-y-px hover:shadow-btn-glow-hover",
        // Design .btn2: bordered translucent secondary.
        outline:
          "rounded-[9px] border border-border-2 bg-[rgba(30,36,68,0.6)] text-ink hover:border-accent hover:bg-[rgba(40,46,84,0.7)] hover:text-ink-hi",
        ghost: "text-muted hover:bg-[rgba(30,36,68,0.5)] hover:text-ink",
        subtle:
          "rounded-[9px] border border-border-2 bg-[rgba(30,36,68,0.6)] text-ink hover:border-accent hover:bg-[rgba(40,46,84,0.7)] hover:text-ink-hi",
        danger: "bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25 hover:shadow-glow-bad",
      },
      size: {
        sm: "h-7 px-2.5 text-2xs",
        md: "h-9 px-3.5 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";
