# Everglow — Handoff

**Status as of 2026-10-19: ARCHIVED.** Hardware-gated since June 2026; bracelet hardware ETA is unknown. Project moved to `projects/archives/everglow-app`. No active development. **Closed out 2026-10-21:** archive commit pushed, GitHub repo archived (read-only), Vercel project paused.

---

## What was committed in the archive commit

Four modified files and one new file were uncommitted as of archival. The changes were documentation corrections made in a prior session that were never committed:

- **`CLAUDE.md`** — Substantial accuracy pass: corrected the E2E encryption claim (TLS only, backend reads cleartext), documented two BLE mock swap sites instead of one, named the missing global BLE context as a third open item, corrected `packages/shared` to "currently unused with four duplicate `BeatEvent` definitions", added a full "Resuming when hardware arrives" checklist, and added `EXPO_PUBLIC_API_URL` to the mobile env list.
- **`PLAN.md`** — Matching corrections: encryption wording, relay mechanism (HTTP POST per beat, not WebSocket outbound), hardware ETA note ("slipped, new ETA unknown"), and the global BLE context refactor added as an open Phase 5 checkbox.
- **`APNS_SETUP.md`** — Corrected step 6: `UIBackgroundModes: remote-notification` is already in `app.json`, so that part is done; what is actually missing is the push capability/entitlement in the provisioning profile (Xcode or EAS credentials), not an `app.json` edit.
- **`apps/api/.gitignore`** — Added `!.env.example` so the template file can be committed while `.env*` remains blocked.
- **`apps/api/.env.example`** (new) — Blank template listing all required API env vars with placeholder values only.

---

## Open technical work

**Must do before the project can run on real hardware:**

1. **Global BLE context** (code task, hardware-independent). `apps/mobile/app/(tabs)/index.tsx` calls `useMockBLE` directly with its own scan/connect-on-mount. It carries an unactioned `// Phase 5: replace useMockBLE with global BLE context from onboarding flow` TODO. No global BLE context exists. Build it first; without it, the home screen cannot share the BLE connection established in onboarding.

2. **Two `useMockBLE` swap sites** (hardware-gated). Once a real bracelet exists: swap `apps/mobile/app/onboarding/pair-bracelet.tsx` (marked, straightforward) and `apps/mobile/app/(tabs)/index.tsx` (requires the context above first).

3. **APNs credentials** (credential-gated). `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` are `PLACEHOLDER` in `apps/api/.env`. Requires an Apple Developer account. See `APNS_SETUP.md` for the full sequence. Code is complete; it is inert until credentials exist and on-device verification runs.

4. **`usePushToken` token type swap**. Currently registers an Expo push token; must switch to `getDevicePushTokenAsync()` for the raw APNs token when going live. Marked in-code and documented in `APNS_SETUP.md`.

5. **iOS build setup**. No `eas.json` exists. Building for a real iOS device requires either Xcode on a Mac or EAS cloud build. The `apps/mobile/app.json` iOS background modes are already correct (`remote-notification`, `bluetooth-central`). The missing piece is the push capability/entitlement in the provisioning profile, set via Xcode (Signing and Capabilities, Push Notifications) or EAS credentials.

**Known deferred debt (not blocking, but unresolved):**

- `packages/shared` is unused. `BeatEvent` is duplicated in four places (`useBLE.ts`, `useMockBLE.ts`, `backgroundBeatRelay.ts`, `relay/route.ts`). Consolidating onto `@everglow/shared` is known debt, not yet scheduled.
- `useRelay`'s background branch pauses outbound forwarding and sends a resting glow on background. When APNs goes live, this must be revisited to keep the real relay alive instead.

---

## Reviving this project

A future session needs:

1. Real bracelet hardware (PPG sensor, BLE, GATT profile as locked in `PLAN.md`). The GATT profile is frozen; firmware must match exactly.
2. Apple Developer account for APNs auth key (`.p8`).
3. Read `CLAUDE.md` "Resuming when hardware arrives" section — it is a terse checklist written for exactly this moment.
4. The Supabase project should still be live (free tier). Verify the two migrations in `supabase/migrations/` are applied.
5. Check the Vercel deployment (see below).

---

## External side effects

**No Windows scheduled task ever existed** for this project.

**No GitHub Actions cron ever existed** for this project (no `.github/workflows/` directory).

**Vercel: PAUSED (2026-10-21).** The Vercel project `everglow-app` (team `timas-gudziunas-projects`) exists, is git-connected to GitHub `main`, and had a live production deployment from commit `7850d4b` (2026-06-11) serving `everglow-app.vercel.app`. The owner paused it from Project Settings on 2026-10-21; the domain now returns 503 DEPLOYMENT_PAUSED. Env vars, domains and deployment history are kept. To revive: unarchive the GitHub repo, then Resume Project in Vercel settings. `apps/api/vercel.json` sets `"installCommand": "npm install --legacy-peer-deps"` (a peer-dependency conflict workaround, do not remove without re-checking). There is no `.vercel` directory locally; the project was deployed through the GitHub integration, never linked from this machine.

---

## Paid and credit-consuming services

- **Supabase** (free tier as of last active development). If the project has been idle since June 2026 and the free org has no other active projects, Supabase may pause the database. Check the dashboard.
- **Ably** (free tier, 6M messages/month). No active traffic since June 2026 so no charges expected, but the account and API key in `apps/api/.env` are live.
- **Apple Developer Program** ($99/year). Not yet purchased as of archival. Required before APNs can be configured.
- **Expo EAS** (no `eas.json` exists, so no EAS build has been run). No charges.
- **Resend**: not used by this project.
- **Vercel**: Hobby plan, project paused 2026-10-21. No charges.
