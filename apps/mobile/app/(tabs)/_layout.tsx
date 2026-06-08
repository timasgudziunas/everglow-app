import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../lib/auth';
import { useOnboarding } from '../../lib/onboarding';

export default function TabsLayout() {
  const { session, isLoading: sessionLoading } = useSession();
  const { isLoading: onboardingLoading, firstLaunchSeen, onboardingComplete } = useOnboarding();

  if (sessionLoading || onboardingLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' }}>
        <ActivityIndicator color="#F59E0B" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href={firstLaunchSeen ? '/(auth)/login' : '/onboarding'} />;
  }

  if (!onboardingComplete) {
    return <Redirect href="/onboarding/pair-bracelet" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: '#1A1A1A', borderTopColor: '#333' }, tabBarActiveTintColor: '#F59E0B' }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
