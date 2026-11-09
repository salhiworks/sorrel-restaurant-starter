import { defineConfig } from "vitest/config"

// Security tests against a real Supabase project: `npm run test:supabase`.
export default defineConfig({
  test: { include: ["tests/supabase/**/*.supabase.ts"], environment: "node", testTimeout: 30_000, hookTimeout: 30_000 },
  resolve: { alias: { "@": import.meta.dirname } },
})
