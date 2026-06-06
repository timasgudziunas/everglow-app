import 'react-native-url-polyfill/auto';
import { Stack } from 'expo-router';
import { SessionProvider } from '../lib/auth';

export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SessionProvider>
  );
}
