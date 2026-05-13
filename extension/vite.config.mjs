import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const extensionRoot = path.resolve(process.cwd(), "extension");

export default defineConfig({
  root: extensionRoot,
  envDir: process.cwd(),
  publicDir: path.join(extensionRoot, "public"),
  plugins: [react()],
  build: {
    outDir: path.resolve(process.cwd(), "dist-extension"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.join(extensionRoot, "sidepanel.html"),
      },
    },
  },
});
