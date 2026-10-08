import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the read-only single-file viewer into public/ so the web app can
// embed a family's data into it when someone uses "Export HTML".
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "public",
    emptyOutDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: "viewer.html" },
  },
});
