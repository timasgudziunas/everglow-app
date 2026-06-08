import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { State, Device } from 'react-native-ble-plx';
// Swap to useBLE when testing on real hardware
import { useMockBLE as useBLE } from '../../hooks/useMockBLE';
import { useRelay } from '../../hooks/useRelay';

export default function PairBraceletScreen() {
  const {
    btState,
    scanState,
    devices,
    connectedDevice,
    latestBeat,
    errorMessage,
    startScan,
    stopScan,
    connectToDevice,
    sendLightCommand,
  } = useBLE();

  const { relayState, lastRelayError, latestPartnerBeat } = useRelay({ latestBeat, sendLightCommand });
  const partnerBpm = latestPartnerBeat ? Math.round(60000 / latestPartnerBeat.intervalMs) : null;

  const bpm = latestBeat ? Math.round(60000 / latestBeat.intervalMs) : null;

  const btReady = btState === State.PoweredOn;

  function renderStatusMessage() {
    if (btState === State.PoweredOff) {
      return <Text style={styles.hint}>Bluetooth is off. Turn it on in Settings.</Text>;
    }
    if (btState === State.Unauthorized) {
      return <Text style={styles.hint}>Bluetooth permission denied. Allow it in Settings → Everglow.</Text>;
    }
    if (scanState === 'connected' && connectedDevice) {
      return (
        <View style={styles.connectedBox}>
          <Text style={styles.connectedText}>
            Connected to {connectedDevice.name ?? connectedDevice.id}
          </Text>
          {bpm !== null ? (
            <Text style={styles.bpmText}>{bpm} BPM</Text>
          ) : (
            <Text style={styles.bpmWaiting}>Waiting for heartbeat…</Text>
          )}
          {relayState === 'connected' && (
            partnerBpm !== null ? (
              <Text style={styles.partnerBpm}>Partner: {partnerBpm} BPM</Text>
            ) : (
              <Text style={styles.partnerBpmWaiting}>Waiting for partner…</Text>
            )
          )}
          <TouchableOpacity
            style={styles.pulseButton}
            onPress={() => sendLightCommand({ command: 0x01, durationMs: 500, brightness: 255 })}
          >
            <Text style={styles.pulseButtonText}>Send test pulse</Text>
          </TouchableOpacity>
          <Text style={[
            styles.relayStatus,
            relayState === 'connected' && styles.relayConnected,
            relayState === 'error' && styles.relayError,
          ]}>
            {relayState === 'idle' && 'Relay: off'}
            {relayState === 'connecting' && 'Relay: connecting…'}
            {relayState === 'connected' && 'Relay: live'}
            {relayState === 'error' && `Relay: ${lastRelayError ?? 'error'}`}
          </Text>
        </View>
      );
    }
    if (scanState === 'error') {
      return <Text style={styles.error}>{errorMessage ?? 'Something went wrong'}</Text>;
    }
    return null;
  }

  function renderDevice({ item }: { item: Device }) {
    return (
      <TouchableOpacity style={styles.deviceRow} onPress={() => connectToDevice(item)}>
        <Text style={styles.deviceName}>{item.name ?? 'Unknown'}</Text>
        <Text style={styles.deviceRssi}>{item.rssi} dBm</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pair your bracelet</Text>
      <Text style={styles.subtitle}>
        Make sure your bracelet is charged and nearby.
      </Text>

      {renderStatusMessage()}

      {scanState === 'connecting' && (
        <ActivityIndicator color="#F5A623" size="large" style={styles.spinner} />
      )}

      {(scanState === 'idle' || scanState === 'error') && btReady && (
        <TouchableOpacity style={styles.button} onPress={startScan}>
          <Text style={styles.buttonText}>Scan for bracelet</Text>
        </TouchableOpacity>
      )}

      {scanState === 'scanning' && (
        <>
          <ActivityIndicator color="#F5A623" size="large" style={styles.spinner} />
          <TouchableOpacity style={styles.stopButton} onPress={stopScan}>
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        </>
      )}

      {scanState === 'scanning' && devices.length === 0 && (
        <Text style={styles.hint}>Looking for bracelets…</Text>
      )}

      {devices.length > 0 && (
        <FlatList
          data={devices}
          keyExtractor={(d) => d.id}
          renderItem={renderDevice}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      {scanState === 'connected' && (
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/onboarding/link-partner')}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => router.push('/onboarding/link-partner')}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    backgroundColor: '#1A1A1A',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 16,
  },
  buttonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  stopButtonText: {
    color: '#888888',
    fontSize: 14,
  },
  spinner: {
    marginTop: 24,
  },
  hint: {
    color: '#666666',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  error: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  connectedBox: {
    backgroundColor: '#1E3A1E',
    borderRadius: 10,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  connectedText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  bpmText: {
    color: '#F5A623',
    fontSize: 48,
    fontWeight: '700',
    marginTop: 12,
  },
  bpmWaiting: {
    color: '#666666',
    fontSize: 13,
    marginTop: 8,
  },
  partnerBpm: {
    color: '#F5A623',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
    opacity: 0.7,
  },
  partnerBpmWaiting: {
    color: '#444444',
    fontSize: 13,
    marginTop: 6,
  },
  pulseButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F5A623',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  pulseButtonText: {
    color: '#F5A623',
    fontSize: 14,
  },
  relayStatus: {
    color: '#666666',
    fontSize: 12,
    marginTop: 10,
  },
  relayConnected: {
    color: '#4CAF50',
  },
  relayError: {
    color: '#FF6B6B',
  },
  continueButton: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#555555',
    fontSize: 14,
  },
  list: {
    width: '100%',
    marginTop: 24,
  },
  listContent: {
    gap: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 16,
  },
  deviceName: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  deviceRssi: {
    color: '#888888',
    fontSize: 12,
  },
});
