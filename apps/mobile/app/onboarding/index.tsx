import { View, Text, StyleSheet } from 'react-native';

export default function OnboardingWelcomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Everglow</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' },
  title: { color: '#F59E0B', fontSize: 28, fontWeight: '700' },
});
