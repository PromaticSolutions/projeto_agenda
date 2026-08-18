import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Os módulos de dados são marcados com `server-only`, que lança fora do
      // runtime de Server Component. Nos testes eles rodam em Node puro (modo
      // mock, sem Supabase configurado), então o marcador vira um no-op.
      "server-only": path.resolve(__dirname, "./src/lib/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
