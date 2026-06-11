import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useQuietHours, formatMinutes, stepMinutes } from '../../lib/quietHours';

const AMBER = '#F59E0B';
const STEP_MINUTES = 15;

export default function SettingsScreen() {
  const { quietHours, setQuietHours } = useQuietHours();

  async function signOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionLabel}>QUIET HOURS</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Quiet hours</Text>
        <Switch
          value={quietHours.enabled}
          onValueChange={(enabled) => setQuietHours({ ...quietHours, enabled })}
          trackColor={{ false: '#333', true: AMBER }}
          thumbColor="#FFFFFF"
        />
      </View>

      {quietHours.enabled && (
        <>
          <TimeRow
            label="From"
            value={quietHours.startMinutes}
            onChange={(startMinutes) => setQuietHours({ ...quietHours, startMinutes })}
          />
          <TimeRow
            label="To"
            value={quietHours.endMinutes}
            onChange={(endMinutes) => setQuietHours({ ...quietHours, endMinutes })}
          />
        </>
      )}

      <Text style={styles.hint}>
        Your bracelet glows faintly during these hours instead of pulsing brightly, even when a
        beat arrives while the app is in the background.
      </Text>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepButton}
          onPress={() => onChange(stepMinutes(value, -STEP_MINUTES))}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.time}>{formatMinutes(value)}</Text>
        <TouchableOpacity
          style={styles.stepButton}
          onPress={() => onChange(stepMinutes(value, STEP_MINUTES))}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A', paddingHorizontal: 24, paddingTop: 64 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 40 },
  sectionLabel: {
    color: AMBER,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.7,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#333',
  },
  rowLabel: { color: '#FFFFFF', fontSize: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: { color: AMBER, fontSize: 20, fontWeight: '600' },
  time: {
    color: '#FFFFFF',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    width: 72,
    textAlign: 'center',
  },
  hint: { color: '#888', fontSize: 13, lineHeight: 18, marginTop: 16, marginBottom: 40 },
  signOutButton: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333',
  },
  signOutText: { color: '#EF4444', fontSize: 16 },
});
