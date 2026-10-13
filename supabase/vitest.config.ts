import { defineConfig } from 'vitest/config';
// Edge function tests run under Deno (npm run test:functions), not Vitest.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 } });
