import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Everglow</Text>
      <Text style={styles.subtitle}>Home — heartbeat ring goes here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' },
  title: { color: '#F59E0B', fontSize: 32, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#666', fontSize: 14 },
});
