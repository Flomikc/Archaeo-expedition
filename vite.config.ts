import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  server: { port: 5173, open: true },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        sandbox: resolve(__dirname, "sandbox.html"),
        editor: resolve(__dirname, "editor.html"),
      },
    },
  },
});