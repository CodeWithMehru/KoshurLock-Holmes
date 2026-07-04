import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// In dev, the vite server proxies /api -> the FastAPI backend so the browser
// stays same-origin (matching the nginx setup used in production).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
