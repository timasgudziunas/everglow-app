# APNs Setup — Silent Push for Background Beat Relay

Everglow's beat relay normally flows over an Ably WebSocket. When a phone
backgrounds the app, iOS suspends that socket and the relay dies. The fix is a
**silent push notification** (APNs `content-available`): the backend sends a silent
push to the receiving phone, iOS wakes the app in the background, and the app
relays the beat to the bracelet over BLE.

The entire implementation is already written and production-ready. It is **inert
until real APNs credentials are configured** — with the `PLACEHOLDER` values, the
backend logs `[APNs] Not configured — skipping silent push` and the app runs on the
Ably-only path exactly as before.

**When you get an Apple Developer account, you only change environment variables and
one one-line swap in the app. No other code changes are required.**

---

## 1. Generate an APNs Auth Key (.p8)

1. Sign in to the [Apple Developer portal](https://developer.apple.com/account).
2. Go to **Certificates, Identifiers & Profiles → Keys**.
3. Click **+** to create a new key. Give it a name (e.g. "Everglow APNs").
4. Check **Apple Push Notifications service (APNs)** and continue.
5. **Download the `.p8` file** — you can only download it once. Keep it safe.
6. Note the **Key ID** (10 characters) shown on the key's page.
7. Note your **Team ID** (10 characters) — top-right of the portal, or under
   **Membership**.

A token-based `.p8` auth key (not a certificate) is what this implementation uses.
One key works for both the sandbox and production APNs environments.

---

## 2. Map the values to environment variables

Set these in `apps/api/.env` (and in the Vercel project's environment variables for
deployed environments):

| Env var            | Where it comes from                                             |
| ------------------ | -------------------------------------------------------------- |
| `APNS_KEY_ID`      | The 10-char **Key ID** from step 1.6                           |
| `APNS_TEAM_ID`     | Your 10-char **Team ID** from step 1.7                         |
| `APNS_PRIVATE_KEY` | The `.p8` file contents, **base64-encoded** (see step 3)       |
| `APNS_BUNDLE_ID`   | The app bundle id — `com.everglow.app` (already set)           |
| `APNS_ENVIRONMENT` | `sandbox` for dev/TestFlight, `production` for the App Store   |

The code treats any of `APNS_KEY_ID`, `APNS_TEAM_ID`, or `APNS_PRIVATE_KEY` being
missing or equal to `PLACEHOLDER` as "not configured" and skips sending. So the
moment all three hold real values, silent push turns on automatically.

---

## 3. Encode the `.p8` for `APNS_PRIVATE_KEY`

The code expects **base64-encoded** contents of the `.p8` file (the whole PEM text,
including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines). It
base64-**decodes** the env var back to the PEM string at runtime. Base64 avoids the
multi-line / newline problems of putting raw PEM into an env var.

macOS / Linux:

```bash
base64 -i AuthKey_ABCDE12345.p8 | tr -d '\n'
```

Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_ABCDE12345.p8"))
```

Paste the resulting single-line string as the value of `APNS_PRIVATE_KEY`.

---

## 4. `APNS_ENVIRONMENT`: sandbox vs production

- `sandbox` — local development and **TestFlight** builds.
- `production` — **App Store** builds.

This only selects which APNs host the backend connects to. The `.p8` auth key is
valid for both; you do not need separate keys.

---

## 5. One app-side swap: Expo token → native APNs token

Until the Apple Developer account exists, the app registers for an **Expo push
token** (`Notifications.getExpoPushTokenAsync`). Once APNs is live, switch to the
**raw native APNs device token** so the backend's `sendSilentPush()` can target it
directly:

- File: `apps/mobile/hooks/usePushToken.ts`
- Find the comment `// SWAP POINT — APNs migration:`
- Replace `Notifications.getExpoPushTokenAsync(...)` with
  `Notifications.getDevicePushTokenAsync()`.

That returns the raw APNs token string, which is exactly what `sendSilentPush()`
expects. No backend changes are needed.

> Alternatively, keep Expo push tokens and route through Expo's push service — but
> the backend `lib/apns.ts` is written to talk to APNs directly, so the native-token
> swap above is the intended path.

---

## 6. Checklist to go live

1. Create the `.p8` key, note Key ID + Team ID (step 1).
2. Base64-encode the `.p8` (step 3).
3. Set `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_ENVIRONMENT` in
   `apps/api/.env` and in Vercel (step 2).
4. Apply the `device_tokens` migration to Supabase
   (`supabase/migrations/20260608000001_device_tokens.sql`).
5. Swap to `getDevicePushTokenAsync()` in `usePushToken.ts` (step 5).
6. Rebuild the iOS app (a native rebuild is required for the new
   `remote-notification` background mode and the push entitlement).

No other code changes are required.
