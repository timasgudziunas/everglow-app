import * as apn from '@parse/node-apn';

// Silent (background) push to wake a partner's app over APNs when their phone has
// backgrounded the app and iOS has suspended the Ably socket. This is the fallback
// transport for the beat relay — the Ably path stays primary while foregrounded.
//
// Credentials come from env (see APNS_SETUP.md). Until a real Apple Developer
// account is configured, the APNS_* secrets are "PLACEHOLDER" and every call is a
// no-op, so the app behaves exactly as it does today on the Ably-only path.

// The credential vars that must be present (and not placeholders) to actually send.
// APNS_BUNDLE_ID has a real default and APNS_ENVIRONMENT only toggles the host, so
// the three secrets below are what gate live sending.
const REQUIRED_SECRETS = ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_PRIVATE_KEY'] as const;

function isConfigured(): boolean {
  return REQUIRED_SECRETS.every((name) => {
    const value = process.env[name];
    return typeof value === 'string' && value.length > 0 && value !== 'PLACEHOLDER';
  });
}

// Lazy singleton — building the provider parses the signing key, so we defer it
// until the first real send and reuse the HTTP/2 connection pool thereafter.
let _provider: apn.Provider | null = null;

function getProvider(): apn.Provider | null {
  if (!isConfigured()) return null;
  if (_provider) return _provider;

  // APNS_PRIVATE_KEY holds the base64-encoded contents of the .p8 auth key file
  // (see APNS_SETUP.md). Decode back to the PEM string the apn library expects.
  const key = Buffer.from(process.env.APNS_PRIVATE_KEY!, 'base64').toString('utf8');

  _provider = new apn.Provider({
    token: {
      key,
      keyId: process.env.APNS_KEY_ID!,
      teamId: process.env.APNS_TEAM_ID!,
    },
    production: process.env.APNS_ENVIRONMENT === 'production',
  });

  return _provider;
}

// Send a silent push carrying a custom data payload (the beat event). Never throws —
// a failed push must not disrupt the relay pipeline, so all errors are logged only.
export async function sendSilentPush(
  deviceToken: string,
  payload: Record<string, unknown>
): Promise<void> {
  const provider = getProvider();
  if (!provider) {
    console.log('[APNs] Not configured — skipping silent push');
    return;
  }

  try {
    const note = new apn.Notification();
    note.topic = process.env.APNS_BUNDLE_ID!;

    // Silent push: content-available wakes the app in the background with no
    // user-visible alert, sound, or badge. `background` push type sets the
    // apns-push-type header Apple requires for content-available-only pushes, and
    // priority 5 is mandatory for them (priority 10 is rejected for silent pushes).
    note.contentAvailable = true;
    note.pushType = 'background';
    note.priority = 5;
    note.payload = payload;

    const result = await provider.send(note, deviceToken);

    for (const failure of result.failed) {
      console.error(
        '[APNs] delivery failed',
        failure.device,
        failure.status ?? '',
        failure.response ?? failure.error ?? ''
      );
    }
  } catch (err) {
    console.error('[APNs] send error', err);
  }
}
