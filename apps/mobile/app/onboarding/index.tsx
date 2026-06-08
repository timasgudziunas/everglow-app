import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useOnboarding } from '../../lib/onboarding';

export default function OnboardingWelcomeScreen() {
  const { markFirstLaunchSeen } = useOnboarding();

  async function handleCreateAccount() {
    await markFirstLaunchSeen();
    router.push('/(auth)/signup');
  }

  async function handleSignIn() {
    await markFirstLaunchSeen();
    router.push('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.glowDot} />
        <Text style={styles.title}>Everglow</Text>
        <Text style={styles.subtitle}>
          Feel your partner's heartbeat — wherever they are.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleCreateAccount}>
          <Text style={styles.primaryButtonText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleSignIn}>
          <Text style={styles.secondaryButtonText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 60,
  },
  hero: {
    alignItems: 'center',
  },
  glowDot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F59E0B',
    marginBottom: 32,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    color: '#F59E0B',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  subtitle: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#1A1A1A',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
  },
});
