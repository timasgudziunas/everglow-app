# Everglow — Codebase Guide

Paired wearable bracelet app. One partner's heartbeat is read by a PPG sensor in the bracelet and sent as a breathing amber glow to the other partner's bracelet in real time. Beat timestamps pass through end-to-end encrypted and are never stored.

---

## Build status

| Phase | Status | Covers |
|-------|--------|--------|
| Phase 1 — Skeleton | ✅ Done | Supabase auth, login/signup on mobile, API scaffold |
| Phase 2 — Hardware | ⬜ Next | BLE scan, GATT pairing, beat event reception from bracelet |
| Phase 3 — Partner sync | ⬜ | Invite codes, Ably/Pusher relay, bidirectional beat flow |
| Phase 4 — Home screen | ✅ Done | Animated heartbeat ring, BPM display, wearing states |
| Phase 5 — Polish | ⬜ | Full onboarding flow, iOS background execution, quiet hours |

**Hard blocker before Phase 2:** The GATT profile (service UUID, beat-event characteristic byte layout, light-command characteristic) must be agreed with the firmware engineer. UUIDs in `apps/mobile/lib/ble.ts` are `TODO` placeholders.

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
| `/` | `app/(tabs)/index.tsx` | Placeholder — Phase 4 |
| `/settings` | `app/(tabs)/settings.tsx` | Sign-out button — done |
| `/login` | `app/(auth)/login.tsx` | Email/password sign-in — done |
| `/signup` | `app/(auth)/signup.tsx` | Account creation — done |
| `/onboarding` | `app/onboarding/index.tsx` | Welcome placeholder — Phase 5 |
| `/onboarding/pair-bracelet` | `app/onboarding/pair-bracelet.tsx` | BLE pairing placeholder — Phase 2 |
| `/onboarding/link-partner` | `app/onboarding/link-partner.tsx` | Invite code placeholder — Phase 3 |

**Key lib files:**

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client with AsyncStorage session persistence |
| `lib/auth.tsx` | SessionProvider + `useSession()` hook |
| `lib/ble.ts` | BleManager singleton + GATT UUID constants (all `TODO`) |

**Empty placeholder dirs** (`.gitkeep` only — filled in later phases):
- `components/` — reusable UI components (Phase 4: heartbeat ring, etc.)
- `hooks/` — custom React hooks (Phase 2+: `useBLE`, etc.)

**Run:** `cd apps/mobile && npm install && npx expo start` (iOS only — Safari blocks Web Bluetooth)

**Env:** `apps/mobile/.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## apps/api

Pure API — no frontend. One health-check page, two stub routes.

| Route | File | Status |
|-------|------|--------|
| `GET /` | `app/page.tsx` | "Everglow API — running" |
| `POST /api/partner` | `app/api/partner/route.ts` | Stub 501 — Phase 3 |
| `POST /api/relay` | `app/api/relay/route.ts` | Stub 501 — Phase 3 |

`lib/supabase-server.ts` exports two functions:
- `createSupabaseServerClient()` — cookie-scoped, respects RLS (use in user-facing routes)
- `createSupabaseServiceClient()` — service role, bypasses RLS (use for admin operations)

**Run:** `cd apps/api && npm install && npm run dev`

**Env:** `apps/api/.env` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

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

Migration: `supabase/migrations/20260605000001_initial_schema.sql`

| Table | Purpose |
|-------|---------|
| `profiles` | One row per auth user. Auto-created by trigger on signup. |
| `invite_codes` | Short-lived codes used once to link two partners (Phase 3). |
| `partner_links` | Permanent bond between two user IDs (Phase 3). |

RLS enabled on all tables. Beat events are **never stored** — they flow through Ably/Pusher in memory only.

---

## Root workspace scripts

```bash
npm run mobile   # expo start in apps/mobile
npm run api      # next dev in apps/api
```
