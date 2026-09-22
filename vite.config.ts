import { defineConfig } from "vite";

export default defineConfig({
  // relative base — важно для будущей сборки под Яндекс Игры
  base: "./",
  server: { port: 5173, open: true },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 6000,
  },
});