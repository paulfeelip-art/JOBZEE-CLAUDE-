# Jobzee: notes for coding agents

- Monorepo with npm workspaces: `packages/shared`, `supabase`, `apps/mobile`, `apps/web`.
- Business rules live in `packages/shared/src`. After changing them, run `node scripts/sync-shared.mjs` (copies them into `supabase/functions/_shared/rules` for Deno). CI fails if the copy is stale.
- SQL mirrors some rules (`fee_service`, `fee_commission`, `hourly_charge`, `tier_index`, `task_transitions`). `supabase/tests/db.test.ts` checks that both sides agree. Change both together.
- Money is always integer bani. Never use floats for amounts.
- Apps never write tables directly. Add a `security definer` function, grant it in `20261013000003_security.sql`, and test it in `supabase/tests`.
- New migrations: add a new file; do not edit applied migrations once a real project uses them. Remember `revoke`/`grant` for new tables (Supabase grants broad defaults).
- Mobile: Expo SDK 57. Read `apps/mobile/AGENTS.md`. Native-only modules (maps, Stripe) have `.web.tsx`/`.web.ts` stand-ins so the web build works.
- The app runs in demo mode without `EXPO_PUBLIC_SUPABASE_URL`; keep `src/lib/api/demo.ts` in step with `live.ts` (same `JobzeeApi` interface).
- Live payments are blocked unless `JOBZEE_ALLOW_LIVE_PAYMENTS=yes`. Do not remove this guard.
- UI copy is Romanian; code and comments are English.
- Before declaring work done: `npm test`, `npm run typecheck`, `npm run build -w @jobzee/web`.
