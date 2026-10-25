# HANDOFF.md — Session Handoff (updated 2026-10-25 ~20:15 UTC, supersedes all 2026-10-21 and earlier versions)

> For a fresh Claude session with no memory of prior conversations: read this file first, then `CLAUDE.md` (rules, architecture, the "Resuming when hardware arrives" checklist), then `PLAN.md` (phase status). `APNS_SETUP.md` only when touching push.

## Current state (as of 2026-10-25 ~20:15 UTC)

**Status: ACTIVE again, revived from `projects/archives/` on 2026-10-25.** Archived 2026-10-19, closed out 2026-10-21, revived four days later. Still code-complete and hardware-gated: no bracelet hardware, no ETA.

| Item | State |
|---|---|
| Folder | `projects/everglow-app` (moved back with `robocopy /E /MOVE /XJ`) |
| Git | `main` at `3b5ea0e`, clean tree, remote `github.com/timasgudziunas/everglow-app` |
| GitHub repo | Unarchived 2026-10-25 (`archived: false`), pushes work again |
| Vercel | Project `everglow-app` (team `timas-gudziunas-projects`, id `prj_Ywi4lUV5AlQLGBkeAhkrvKwDXoVc`) resumed 2026-10-25. `paused: false`. Production = deployment of `478a479`, `https://everglow-app.vercel.app` returns 200 (was 503 DEPLOYMENT_PAUSED). Git-connected to `main`, root dir `apps/api` |
| npm workspaces | `npm install --legacy-peer-deps` run 2026-10-25; links `node_modules/api`, `node_modules/mobile`, `node_modules/@everglow/shared` restored |
| Supabase | **BROKEN, see Blockers.** `xrjrpwggwcguxrbrotwm.supabase.co` returns NXDOMAIN |
| Ably | Free tier, key in `apps/api/.env`, not verified this session |
| APNs / Apple Developer | Not purchased, placeholders in `apps/api/.env` |
| Scheduled tasks / Actions cron | None ever existed |

## What was just completed (2026-10-25)

Revival only, no code changes: folder moved back, GitHub unarchived, Vercel unpaused and verified serving, workspace links restored, root `projects/CLAUDE.md` repo map and `archives/README.md` updated.

## Blockers and open decisions

1. **Supabase project is probably gone.** The project ref (found in `apps/mobile/.expo/dev/logs/start.log`, and the same one the env files point at) no longer resolves in DNS while `supabase.co` itself does. A paused free-tier project still answers; a non-existent hostname means the project was most likely deleted after sitting paused since June. **Owner action:** open the Supabase dashboard. If a restore option exists, restore it. If not, create a new project, apply both migrations in `supabase/migrations/` in order, and update the Supabase URL and keys in `apps/api/.env`, `apps/mobile/.env`, and the Vercel project env vars. Nothing in the app will work against the backend until this is done. Treat this as the standing finding, not something to re-probe each session; re-check only after the owner reports a dashboard action.
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

1. Owner resolves the Supabase blocker above (dashboard check, restore or recreate, env vars in three places).
2. Verify the API end to end against the restored backend: `cd apps/api && npm run dev`, hit the relay route.
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
4. Supabase free-tier projects auto-pause after inactivity and can be deleted after a long pause. This is what appears to have happened here. If the project goes idle again, expect to lose it.
5. No local `.vercel` link; deploys go through the GitHub integration on push to `main`.
6. Both `apps/api/.env` and `apps/mobile/.env` are real and gitignored. Never print them.

## Quick health check

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://everglow-app.vercel.app/      # 200
gh repo view timasgudziunas/everglow-app --json isArchived                      # false
nslookup xrjrpwggwcguxrbrotwm.supabase.co                                        # resolves once Supabase is fixed
ls node_modules/api node_modules/mobile node_modules/@everglow/shared -d         # three links present
```
Healthy = Vercel 200, repo not archived, Supabase host resolves, three workspace links present. As of 2026-10-25 only the Supabase line fails.
