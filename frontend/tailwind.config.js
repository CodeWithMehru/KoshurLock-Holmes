/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds - "KoshurLock Aurora" design :root ladder
        bg: "#070A16",
        bg2: "#0A0E1F",
        panel: "#0D1022",
        "panel-2": "#12162C",
        raised: "#1A1F3D",
        // Lines & dividers - blue-indigo, per design
        border: "#20264A",
        "border-2": "#2C3566",
        grid: "#12162C",
        // Text tiers - crisp near-white headings over slate body
        "ink-hi": "#F2F4FF",
        ink: "#C6CCE6",
        muted: "#8A93B4",
        faint: "#5A6489",
        disabled: "#3E4670",
        // Accent - violet (design --accent). Selection / primary / active nav.
        accent: "#8B7BFF",
        "accent-hi": "#A99BFF",
        "accent-dim": "#5B4FB0",
        "accent-deep": "#171532",
        // Semantic status - design values
        ok: "#34D399",
        warn: "#FBBF24",
        bad: "#FB5A63",
        info: "#38BDF8",
        // Categorical entity palette (kept in sync with
        // src/components/theme/palette.ts) - design EC map.
        person: "#5B8DEF",
        account: "#A78BFA",
        device: "#E879F9",
        ip: "#F59E5B",
        file: "#FBD34D",
        location: "#5EEAD4",
        event: "#F472B6",
        document: "#8B94B8",
        other: "#94A3B8",
      },
      backgroundImage: {
        // The one brand gradient from the design (--grad): cyan-indigo-purple-pink.
        "grad-brand": "linear-gradient(100deg, #38BDF8 0%, #6366F1 34%, #A855F7 64%, #EC4899 100%)",
        "grad-brand-bright": "linear-gradient(100deg, #38BDF8 0%, #6366F1 34%, #A855F7 64%, #EC4899 100%)",
        "grad-bar-v": "linear-gradient(180deg, #38BDF8 0%, #A855F7 55%, #EC4899 100%)",
        "grad-aurora": "linear-gradient(100deg, #38BDF8 0%, #6366F1 34%, #A855F7 64%, #EC4899 100%)",
      },
      borderRadius: {
        // Global radius uplift - softer corners everywhere
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        led: "0 0 0 2px rgba(0,0,0,.35)",
        panel: "0 10px 30px -18px rgba(0,0,0,.75)",
        card: "0 24px 60px -30px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.04)",
        "btn-glow": "0 8px 24px -8px rgba(124,107,255,.7)",
        "btn-glow-hover": "0 12px 30px -8px rgba(168,85,247,.75)",
        "glow-accent": "0 0 24px -6px rgba(139,123,255,.55)",
        "glow-accent-sm": "0 0 12px -2px rgba(139,123,255,.40)",
        "glow-pink": "0 0 24px -6px rgba(236,72,153,.45)",
        "glow-ok": "0 0 20px -6px rgba(52,211,153,.50)",
        "glow-bad": "0 0 12px -3px rgba(251,90,99,.45)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "3xs": ["0.625rem", { lineHeight: "0.875rem" }],
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      keyframes: {
        "led-pulse": {
          "0%,100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up-fade": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { opacity: ".4", transform: "translateX(40px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "mesh-drift": {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(4%,-3%,0) scale(1.06)" },
          "66%": { transform: "translate3d(-3%,2%,0) scale(.97)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "glow-pulse": {
          "0%,100%": { opacity: ".55" },
          "50%": { opacity: "1" },
        },
        "drift-1": {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(60px,50px) scale(1.12)" },
        },
        "drift-2": {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(-70px,40px) scale(1.08)" },
        },
        "drift-3": {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(40px,-60px) scale(1.14)" },
        },
      },
      animation: {
        "led-pulse": "led-pulse 2.4s ease-in-out infinite",
        "fade-in": "fade-in 240ms cubic-bezier(.22,1,.36,1) both",
        "slide-up-fade": "slide-up-fade 400ms cubic-bezier(.22,1,.36,1) both",
        "scale-in": "scale-in 280ms cubic-bezier(.22,1,.36,1) both",
        "slide-in-right": "slide-in-right 280ms cubic-bezier(.2,.7,.2,1) both",
        "mesh-drift": "mesh-drift 28s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "glow-pulse": "glow-pulse 2.8s ease-in-out infinite",
        "drift-1": "drift-1 26s ease-in-out infinite",
        "drift-2": "drift-2 32s ease-in-out infinite",
        "drift-3": "drift-3 30s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
