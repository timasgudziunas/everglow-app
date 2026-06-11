# Everglow — Codebase Guide

Paired wearable bracelet app. One partner's heartbeat is read by a PPG sensor in the bracelet and sent as a breathing amber glow to the other partner's bracelet in real time. Beat timestamps pass through end-to-end encrypted and are never stored.

---

## Build status

| Phase | Status | Covers |
|-------|--------|--------|
| Phase 1 — Skeleton | ✅ Done | Supabase auth, login/signup on mobile, API scaffold |
| Phase 2 — Hardware | ✅ Done* | BLE scan, GATT pairing, beat reception, light commands, auto-reconnect |
| Phase 3 — Partner sync | ✅ Done | Invite codes, Ably relay, bidirectional beat flow |
| Phase 4 — Home screen | ✅ Done | Animated heartbeat ring, BPM display, wearing states |
| Phase 5 — Polish | ✅ Done* | Onboarding, background relay (silent push), quiet hours, error/reconnect states |

**\*Two items remain — both hardware/credential-gated, not code:**
- **Phase 2 — real-hardware verification.** The full bracelet ↔ phone loop hasn't been run on a physical device. The app still uses `apps/mobile/hooks/useMockBLE.ts`; swap the import to `useBLE` when hardware arrives (the `pair-bracelet.tsx` import is the marked swap point).
- **Phase 5 — silent-push background relay** is code-complete but inert until real APNs credentials replace the `APNS_*` placeholders + it's verified on-device. See `APNS_SETUP.md`.

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
| `/` | `app/(tabs)/index.tsx` | Home — heartbeat ring, BPM, connection/error states — done |
| `/settings` | `app/(tabs)/settings.tsx` | Sign-out + quiet hours — done |
| `/login` | `app/(auth)/login.tsx` | Email/password sign-in — done |
| `/signup` | `app/(auth)/signup.tsx` | Account creation — done |
| `/onboarding` | `app/onboarding/index.tsx` | Welcome — done |
| `/onboarding/pair-bracelet` | `app/onboarding/pair-bracelet.tsx` | BLE pairing — done (uses `useMockBLE` until hardware) |
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

**Env:** `apps/mobile/.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

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

TypeScript types shared by both apps. Not yet added as a dependency to either app — import as `@everglow/shared` when first needed (Phase 3).

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

## Root workspace scripts

```bash
npm run mobile   # expo start in apps/mobile
npm run api      # next dev in apps/api
```
