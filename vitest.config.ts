import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts", "apps/**/*.test.ts"],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@covenant/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@covenant/shared/": path.resolve(__dirname, "packages/shared/src/"),
      "@covenant/document-ir": path.resolve(__dirname, "packages/document-ir/src/index.ts"),
      "@covenant/document-ir/": path.resolve(__dirname, "packages/document-ir/src/"),
      "@covenant/ingestion": path.resolve(__dirname, "packages/ingestion/src/index.ts"),
      "@covenant/ingestion/": path.resolve(__dirname, "packages/ingestion/src/"),
      "@covenant/persistence": path.resolve(__dirname, "packages/persistence/src/index.ts"),
      "@covenant/persistence/": path.resolve(__dirname, "packages/persistence/src/"),
      "@covenant/retrieval": path.resolve(__dirname, "packages/retrieval/src/index.ts"),
      "@covenant/retrieval/": path.resolve(__dirname, "packages/retrieval/src/"),
      "@covenant/policies": path.resolve(__dirname, "packages/policies/src/index.ts"),
      "@covenant/policies/": path.resolve(__dirname, "packages/policies/src/"),
      "@covenant/contract-pipeline": path.resolve(__dirname, "packages/contract-pipeline/src/index.ts"),
      "@covenant/contract-pipeline/": path.resolve(__dirname, "packages/contract-pipeline/src/"),
      "@covenant/resume-pipeline": path.resolve(__dirname, "packages/resume-pipeline/src/index.ts"),
      "@covenant/resume-pipeline/": path.resolve(__dirname, "packages/resume-pipeline/src/"),
      "@covenant/providers": path.resolve(__dirname, "packages/providers/src/index.ts"),
      "@covenant/providers/": path.resolve(__dirname, "packages/providers/src/"),
      "@covenant/evaluation": path.resolve(__dirname, "packages/evaluation/src/index.ts"),
      "@covenant/evaluation/": path.resolve(__dirname, "packages/evaluation/src/"),
    },
  },
});
