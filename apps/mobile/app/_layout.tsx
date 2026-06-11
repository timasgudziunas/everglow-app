import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SessionProvider } from '../lib/auth';
import { OnboardingProvider } from '../lib/onboarding';
import { QuietHoursProvider } from '../lib/quietHours';
import { usePushToken } from '../hooks/usePushToken';
// Importing this module runs TaskManager.defineTask at startup, registering the
// background beat-relay handler with the native task system. Must be a top-level
// import so the task is defined before iOS ever tries to invoke it.
import { registerBackgroundBeatRelay } from '../lib/backgroundBeatRelay';

// Registers push + the background wake handler once a session exists. Renders
// nothing — it just runs the registration side effects inside SessionProvider.
function PushRegistrar() {
  usePushToken();
  useEffect(() => {
    registerBackgroundBeatRelay();
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <OnboardingProvider>
        <QuietHoursProvider>
          <PushRegistrar />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </QuietHoursProvider>
      </OnboardingProvider>
    </SessionProvider>
  );
}
