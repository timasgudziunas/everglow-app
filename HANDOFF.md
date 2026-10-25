# HANDOFF.md — Session Handoff (updated 2026-10-25 ~20:30 UTC, supersedes all 2026-10-21 and earlier versions)

> For a fresh Claude session with no memory of prior conversations: read this file first, then `CLAUDE.md` (rules, architecture, the "Resuming when hardware arrives" checklist), then `PLAN.md` (phase status). `APNS_SETUP.md` only when touching push.

## Current state (as of 2026-10-25 ~20:30 UTC)

**Status: ACTIVE again, revived from `projects/archives/` on 2026-10-25.** Archived 2026-10-19, closed out 2026-10-21, revived four days later. Still code-complete and hardware-gated: no bracelet hardware, no ETA.

| Item | State |
|---|---|
| Folder | `projects/everglow-app` (moved back with `robocopy /E /MOVE /XJ`) |
| Git | `main` at `3b5ea0e`, clean tree, remote `github.com/timasgudziunas/everglow-app` |
| GitHub repo | Unarchived 2026-10-25 (`archived: false`), pushes work again |
| Vercel | Project `everglow-app` (team `timas-gudziunas-projects`, id `prj_Ywi4lUV5AlQLGBkeAhkrvKwDXoVc`) resumed 2026-10-25. `paused: false`. The three Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, all type sensitive, preview+production) were rewritten from `apps/api/.env` at 20:10Z and production redeployed. `https://everglow-app.vercel.app` returns 200. Git-connected to `main`, root dir `apps/api`. `ABLY_API_KEY` untouched since 2026-06-06. No APNs vars on Vercel (placeholders locally) |
| npm workspaces | `npm install --legacy-peer-deps` run 2026-10-25; links `node_modules/api`, `node_modules/mobile`, `node_modules/@everglow/shared` restored |
| Supabase | Project `xrjrpwggwcguxrbrotwm` restored by the owner 2026-10-25 on the same hostname with the same keys. `profiles`, `invite_codes`, `partner_links` answer 200 (0 rows each). **`device_tokens` is missing, see Blockers** |
| Ably | Free tier, key in `apps/api/.env`, not verified this session |
| APNs / Apple Developer | Not purchased, placeholders in `apps/api/.env` |
| Scheduled tasks / Actions cron | None ever existed |

## What was just completed (2026-10-25)

Revival, no code changes: folder moved back, GitHub unarchived, Vercel unpaused and verified serving, workspace links restored, root `projects/CLAUDE.md` repo map and `archives/README.md` updated. Then the owner restored the Supabase project (it had been deleted after its auto-pause; hostname was NXDOMAIN). Local keys in both `.env` files were confirmed valid against the restored project without changes; Vercel's three Supabase vars were rewritten from the local values and production redeployed.

## Blockers and open decisions

1. **`device_tokens` table does not exist on the remote Supabase project.** The restored database has the three tables from `20260605000001_initial_schema.sql` but not `20260608000001_device_tokens.sql`; that migration was evidently never pushed in June. `apps/api/app/api/device-token/route.ts` and `apps/api/app/api/relay/route.ts` both read or write it, so the push-token flow and the relay's wake-partner branch fail against the live backend until it exists. **Owner action:** paste the contents of `supabase/migrations/20260608000001_device_tokens.sql` into the Supabase SQL editor and run it, or `npx supabase login`, `npx supabase link --project-ref xrjrpwggwcguxrbrotwm`, `npx supabase db push` (needs the database password). Verify with the health check below. Applying DDL needs dashboard or CLI credentials a Claude session does not have; do not try to work around that through PostgREST.
2. Hardware: unchanged, bracelet has no ETA. Everything in "Open technical work" below still stands.

## Open technical work (unchanged from archival)

**Must do before the project can run on real hardware:**

1. **Global BLE context** (code task, hardware-independent). `apps/mobile/app/(tabs)/index.tsx` calls `useMockBLE` directly with its own scan/connect-on-mount and carries a `// Phase 5: replace useMockBLE with global BLE context from onboarding flow` TODO. No global BLE context exists. Build it first.
2. **Two `useMockBLE` swap sites** (hardware-gated): `apps/mobile/app/onboarding/pair-bracelet.tsx` (straightforward) and `apps/mobile/app/(tabs)/index.tsx` (needs the context above first).
3. **APNs credentials** (credential-gated). `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` are `PLACEHOLDER`. Requires Apple Developer Program ($99/year). See `APNS_SETUP.md`.
4. **`usePushToken` token type swap** to `getDevicePushTokenAsync()` for the raw APNs token when going live.
5. **iOS build setup.** No `eas.json`. Needs Xcode on a Mac or EAS cloud build, plus the push capability in the provisioning profile.

**Known deferred debt:** `packages/shared` is unused and `BeatEvent` is duplicated in four places (`useBLE.ts`, `useMockBLE.ts`, `backgroundBeatRelay.ts`, `relay/route.ts`). `useRelay`'s background branch pauses outbound forwarding; revisit when APNs goes live.

## Next steps, in priority order

1. Owner applies the `device_tokens` migration (Blockers item 1).
2. Verify the API end to end against the restored backend: `cd apps/api && npm run dev`, hit the device-token and relay routes.
3. Build the global BLE context (item 1 above), the only hardware-independent code task.
4. Everything else waits on hardware and the Apple Developer account.

## Where everything lives

| Path | What it is |
|---|---|
| `apps/api/` | Next.js API, deployed to Vercel (root dir `apps/api`), `vercel.json` forces `npm install --legacy-peer-deps` |
| `apps/mobile/` | Expo app |
| `packages/shared/` | Unused shared types package (see debt) |
| `supabase/migrations/` | Two migrations to apply to any new Supabase project |
| `APNS_SETUP.md` | Push notification credential sequence |
| `apps/api/.env.example` | Template of required API env vars |

## Operational landmines

1. `apps/api/vercel.json` install command is a peer-dependency workaround; do not remove without re-checking the build.
2. Moving this folder: `node_modules` workspace symlinks lock their targets. Use `robocopy /E /MOVE /XJ`, then `npm install --legacy-peer-deps` to recreate the three links. (Hit on archive 2026-10-21 and again on revive 2026-10-25.)
3. The Vercel MCP server returns 404 for this project on get and unpause even though it appears in list. The Vercel CLI works: `vercel api "/v1/projects/<prj_id>/unpause?teamId=<team_id>" --method POST --scope timas-gudziunas-projects`. CLI 54.4.0 has no `project resume` subcommand.
4. Supabase free-tier projects auto-pause after inactivity and get deleted after a long pause. This happened here (idle from June, NXDOMAIN by 2026-10-25, restored by the owner the same day with keys intact). If the project goes idle again, expect to repeat the restore.
7. Vercel env vars here are type `sensitive`: the API never returns their values, so a session cannot diff them against local `.env`. The only way to guarantee consistency is to PATCH them from local values, then redeploy (env changes do not apply to the running deployment).
5. No local `.vercel` link; deploys go through the GitHub integration on push to `main`.
6. Both `apps/api/.env` and `apps/mobile/.env` are real and gitignored. Never print them.

## Quick health check

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://everglow-app.vercel.app/      # 200
gh repo view timasgudziunas/everglow-app --json isArchived                      # false
curl -s -o /dev/null -w "%{http_code}
" https://xrjrpwggwcguxrbrotwm.supabase.co/rest/v1/   # 401 = project up (no key sent)
# with the service key from apps/api/.env in $K: GET /rest/v1/device_tokens?select=id should be 200, not 404
ls node_modules/api node_modules/mobile node_modules/@everglow/shared -d         # three links present
```
Healthy = Vercel 200, repo not archived, Supabase gateway answers, `device_tokens` returns 200, three workspace links present. As of 2026-10-25 20:30Z only the `device_tokens` check fails.
