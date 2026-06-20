import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API + SSE to the backend in dev so there's no CORS and the stream passes through.
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
