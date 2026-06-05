import { View, Text, StyleSheet } from 'react-native';

export default function LinkPartnerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Link your partner</Text>
      <Text style={styles.subtitle}>Invite code entry goes here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 8 },
  subtitle: { color: '#666', fontSize: 14 },
});
