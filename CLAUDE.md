# Everglow — Codebase Guide

Paired wearable bracelet app. One partner's heartbeat is read by a PPG sensor in the bracelet and sent as a breathing amber glow to the other partner's bracelet in real time. Beat timestamps are encrypted in transit (TLS); beat events are relayed, never stored.

True end-to-end encryption (payload unreadable by the backend itself) is **not implemented** — `apps/api/app/api/relay/route.ts` publishes the beat event as plain JSON to Ably and reads the cleartext fields. This would be future work if wanted.

---

## Build status

| Phase | Status | Covers |
|-------|--------|--------|
| Phase 1 — Skeleton | ✅ Done | Supabase auth, login/signup on mobile, API scaffold |
| Phase 2 — Hardware | ✅ Done* | BLE scan, GATT pairing, beat reception, light commands, auto-reconnect |
| Phase 3 — Partner sync | ✅ Done | Invite codes, Ably relay, bidirectional beat flow |
| Phase 4 — Home screen | ✅ Done | Animated heartbeat ring, BPM display, wearing states |
| Phase 5 — Onboarding and polish | ✅ Done* | Onboarding, background relay (silent push), quiet hours, error/reconnect states |

**\*Three items remain — two hardware/credential-gated, one a code refactor:**
- **Phase 2 — real-hardware verification.** The full bracelet ↔ phone loop hasn't been run on a physical device. The app still uses `apps/mobile/hooks/useMockBLE.ts`. There are **two swap sites**, not one: `apps/mobile/app/onboarding/pair-bracelet.tsx` (marked, imports `useMockBLE as useBLE`) and `apps/mobile/app/(tabs)/index.tsx` (also calls `useMockBLE` directly, with its own scan/connect-on-mount, carrying an unactioned `// Phase 5: replace useMockBLE with global BLE context from onboarding flow` TODO). No global BLE context exists yet — the home screen needs that refactor before it can run on real hardware, independent of the pair-bracelet swap.
- **Phase 5 — silent-push background relay** is code-complete but inert until real APNs credentials replace the `APNS_*` placeholders + it's verified on-device. See `APNS_SETUP.md`.
- **Phase 5 — global BLE context refactor.** The home screen's TODO above was never done; it's the reason the home screen swap isn't a one-line change like `pair-bracelet.tsx`'s.

The GATT profile is **locked** (2026-06-06) — real UUIDs + byte layouts live in `apps/mobile/lib/ble.ts` and `PLAN.md`.

---

## Monorepo layout

```
everglow-app/
├── apps/
│   ├── mobile/          # React Native + Expo — the user-facing iOS app
│   └── api/             # Next.js on Vercel — partner linking and beat relay
├── packages/
│   └── shared/          # Shared TS types: BeatEvent, WearingState, PartnerLink
├── supabase/
│   └── migrations/      # SQL run against the remote Supabase project
├── .env.example         # Reference for all env vars across both apps
├── PLAN.md              # Full product plan and feature detail
└── CLAUDE.md            # This file
```

---

## apps/mobile

**Entry:** `expo-router/entry` → `app/_layout.tsx`

**Auth flow (Phase 1):**
- `lib/auth.tsx` — `SessionProvider` wraps the whole app (root `_layout.tsx`). Subscribes to `supabase.auth.onAuthStateChange`. Exposes `session` and `isLoading` via `useSession()`.
- `app/(tabs)/_layout.tsx` — redirects to `/(auth)/login` when `!session`
- `app/(auth)/_layout.tsx` — redirects to `/(tabs)` when `session` exists
- Navigation after sign-in/sign-out is automatic — driven by session state, not explicit `router.push`.

**Screen map:**

| Route (Expo Router) | File | Status |
|---------------------|------|--------|
| `/` | `app/(tabs)/index.tsx` | Home — heartbeat ring, BPM, connection/error states — done (also calls `useMockBLE` directly on mount; second swap site, see Build status) |
| `/settings` | `app/(tabs)/settings.tsx` | Sign-out + quiet hours — done |
| `/login` | `app/(auth)/login.tsx` | Email/password sign-in — done |
| `/signup` | `app/(auth)/signup.tsx` | Account creation — done |
| `/onboarding` | `app/onboarding/index.tsx` | Welcome — done |
| `/onboarding/pair-bracelet` | `app/onboarding/pair-bracelet.tsx` | BLE pairing — done (uses `useMockBLE` until hardware; one of two swap sites, see Build status) |
| `/onboarding/link-partner` | `app/onboarding/link-partner.tsx` | Invite code entry — done |

**Key lib files:**

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client with AsyncStorage session persistence |
| `lib/auth.tsx` | SessionProvider + `useSession()` hook |
| `lib/ble.ts` | BleManager singleton, **locked** GATT UUIDs, module-level light-command sender (`sendLightCommandToBracelet` — used by the background wake handler) |
| `lib/onboarding.tsx` | OnboardingProvider — first-launch / completion flags (AsyncStorage) |
| `lib/quietHours.tsx` | QuietHoursProvider + pure `isWithinQuietHours()` / `loadQuietHours()` (local-storage window) |
| `lib/backgroundBeatRelay.ts` | `BACKGROUND_BEAT_RELAY` task — silent-push background wake handler |

**Hooks** (`hooks/`):
- `useBLE` — real BLE: scan, connect, beat monitor, light commands, auto-reconnect w/ backoff
- `useMockBLE` — drop-in stand-in for `useBLE` until hardware (contains removable dev-only reconnection sim)
- `useRelay` — bridges BLE ↔ Ably ↔ partner; forwards outbound beats, pulses bracelet on inbound (gated by quiet hours)
- `usePushToken` — registers push permission + token, POSTs to `/api/device-token`
- `useAppState` — foreground/background flag

**Components** (`components/`): `HeartbeatRing` — animated amber ring + BPM readout.

**Run:** This app uses a native module (`react-native-ble-plx`, instantiated at startup) and config plugins, so it **cannot run in Expo Go** — it needs a native dev build. Not web either (browsers block Web Bluetooth). Emulators have no Bluetooth radio, so the app runs on `useMockBLE` there; real BLE needs a physical device.
- **First run, or after any `app.json` / native-dep change:** `cd apps/mobile && npm install && npx expo run:android` (prebuilds `android/`, Gradle-builds, installs the dev build on the running emulator). Use `run:ios` on macOS.
- **After that, for JS changes:** `npx expo start`, then press `a` (launches the installed dev build via Metro — fast reload).
- Requires Android Studio + SDK and an AVD, plus two env vars: `ANDROID_HOME` (→ the SDK) and `JAVA_HOME` (→ a JDK; Android Studio's bundled `...\Android Studio\jbr` works). Adding `%ANDROID_HOME%\platform-tools` to PATH (for `adb`) is optional but handy.

**Env:** `apps/mobile/.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` (required by `usePushToken.ts` and `useRelay.ts`, non-null asserted)

---

## apps/api

Pure API — no frontend. One health-check page; relay, partner-linking, Ably-auth, and device-token routes.

| Route | File | Status |
|-------|------|--------|
| `GET /` | `app/page.tsx` | "Everglow API — running" |
| `POST /api/partner` | `app/api/partner/route.ts` | Invite code generate/redeem → `partner_links` — done |
| `POST /api/relay` | `app/api/relay/route.ts` | Publish beat to partner's Ably channel, then fire silent push (`after()`) — done |
| `POST /api/ably-auth` | `app/api/ably-auth/route.ts` | Scoped Ably token request for the mobile client — done |
| `POST /api/device-token` | `app/api/device-token/route.ts` | Upsert caller's push token (one per user) — done |

`lib/` files:
- `lib/supabase-server.ts` — `createSupabaseServerClient()` (cookie-scoped, respects RLS) and `createSupabaseServiceClient()` (service role, bypasses RLS)
- `lib/ably.ts` — lazy Ably REST singleton (`getAblyRest()`)
- `lib/apns.ts` — `sendSilentPush()`; no-op + logs `[APNs] Not configured` until `APNS_*` creds are set (see `APNS_SETUP.md`)

**Run:** `cd apps/api && npm install && npm run dev`

**Env:** `apps/api/.env` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ABLY_API_KEY`, and `APNS_*` (placeholders OK — see `APNS_SETUP.md`)

---

## packages/shared

TypeScript types shared by both apps. **Currently unused** — not added as a dependency to either app. Phases 3–5 are complete and it still hasn't been imported; the `BeatEvent` shape is duplicated by hand in four places instead: `apps/mobile/hooks/useBLE.ts` (`BeatEvent`, explicitly commented "Mirrors packages/shared BeatEvent"), `apps/mobile/hooks/useMockBLE.ts` (same shape), `apps/mobile/lib/backgroundBeatRelay.ts` (`BeatPayload`), and `apps/api/app/api/relay/route.ts`'s `isValidBeatEvent`. Consolidating onto `@everglow/shared` is known deferred debt, not yet scheduled.

| Type | Description |
|------|-------------|
| `BeatEvent` | `{ timestampMs, intervalMs, sequence, checksum }` — ~8 bytes, layout must match firmware |
| `WearingState` | `'both' \| 'you_only' \| 'partner_only' \| 'neither'` |
| `PartnerLink` | `{ id, userId, partnerId, linkedAt }` — database row shape |

---

## Database (Supabase)

Migrations:
- `supabase/migrations/20260605000001_initial_schema.sql`
- `supabase/migrations/20260608000001_device_tokens.sql`

| Table | Purpose |
|-------|---------|
| `profiles` | One row per auth user. Auto-created by trigger on signup. |
| `invite_codes` | Short-lived codes used once to link two partners. |
| `partner_links` | Permanent bond between two user IDs. |
| `device_tokens` | One push token per user (FK → `profiles`), for silent-push wake. Service-role only — no client RLS policies. |

RLS enabled on all tables. Beat events are **never stored** — they flow through Ably in memory only.

---

## Resuming when hardware arrives

Terse checklist for the session that picks this back up once a bracelet shows up.

- **Mock BLE swap sites (two, not one) + missing BLE context.** `apps/mobile/app/onboarding/pair-bracelet.tsx` has the marked swap (`useMockBLE as useBLE`). `apps/mobile/app/(tabs)/index.tsx` also calls `useMockBLE` directly with its own scan/connect-on-mount and carries an unactioned `// Phase 5: replace useMockBLE with global BLE context from onboarding flow` TODO. No BLE context exists yet — build it before the home screen can run on real hardware; the pair-bracelet screen alone is not enough.
- **iOS reality check.** All hardware-gated features (BLE, silent push) are iOS-only in practice — `app.json` does have `android` and `web` blocks, but the background-mode config that makes BLE and silent push actually work (`ios.infoPlist.UIBackgroundModes: [remote-notification, bluetooth-central]`, Bluetooth usage description) exists only under `ios`, with no Android equivalent. Development so far has been on the Android emulator via `useMockBLE`, which never exercises this. Building the real iOS app needs either a Mac (Xcode) or an EAS cloud build — no `eas.json` exists in this repo yet, so that has to be set up first.
- **`APNS_SETUP.md` step 6 correction.** `UIBackgroundModes: ["remote-notification", "bluetooth-central"]` is **already** in `app.json` — that part of step 6 is done, not pending. The actually-missing piece is the push capability/entitlement in the provisioning profile, which is set via Xcode (Signing & Capabilities → Push Notifications) or EAS credentials, not by an app.json edit.
- **Two-party testing.** Needs two Supabase accounts and a manual invite-code exchange (no seed script exists): sign up account A, complete onboarding to generate an invite code on `/onboarding/link-partner`, then sign up account B on a second device/simulator and redeem that code on the same screen.
- **Deployment.** The API is deployed on Vercel. `apps/api/vercel.json` sets `"installCommand": "npm install --legacy-peer-deps"` (a peer-dependency conflict workaround) — don't remove it without re-checking the conflict. Env vars must be set in the Vercel project dashboard to match `apps/api/.env`.
- **No test suite, no CI.** All verification to date has been manual (real devices/emulators, real emails, watching logs). Don't assume a green check anywhere means tested.

---

## Root workspace scripts

```bash
npm run mobile   # expo start in apps/mobile
npm run api      # next dev in apps/api
```

`npm run mobile` only works once a native dev build already exists on the device/emulator (see the **Run** section under `apps/mobile` above — first run needs `npx expo run:android` / `run:ios`). It will not work standalone on a fresh checkout.
