import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useSession } from '../lib/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

type PushTokenState = {
  token: string | null;
  permissionStatus: Notifications.PermissionStatus | null;
};

// Registers this device for push notifications and stores the token on the backend
// (POST /api/device-token) so the relay can wake the app with a silent push.
// Best-effort: any failure is swallowed so push registration never crashes the app.
export function usePushToken(): PushTokenState {
  const { session } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      try {
        // Push notifications only work on physical devices; registering on a
        // simulator throws. Skip silently there.
        if (!Device.isDevice) return;

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }
        if (cancelled) return;
        setPermissionStatus(status);
        if (status !== 'granted') return;

        // SWAP POINT — APNs migration:
        // We use Expo's push token for now because there are no Apple Developer /
        // APNs credentials yet. Once they're configured, replace this with
        // `Notifications.getDevicePushTokenAsync()` to get the raw native APNs
        // device token. The backend sendSilentPush() already targets raw APNs
        // tokens, so no other code changes are required — only this one call.
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        const pushToken = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        if (cancelled) return;
        setToken(pushToken.data);

        await fetch(`${API_URL}/api/device-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token: pushToken.data, platform: Platform.OS }),
        });
      } catch {
        // Push registration is best-effort — never crash the app if it fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  return { token, permissionStatus };
}
