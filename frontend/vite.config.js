import { defineConfig } from "vite";

const scoringProxy = {
  "/api": { target: "http://127.0.0.1:8000" },
  "/ml-api": {
    target: "http://127.0.0.1:8001",
    rewrite: (path) => path.replace(/^\/ml-api/, ""),
  },
};
export default defineConfig({
  server: { proxy: scoringProxy },
  preview: { proxy: scoringProxy },
});
