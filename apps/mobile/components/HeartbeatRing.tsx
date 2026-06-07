import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import type { BeatEvent, WearingState } from '../hooks/useBLE';

const CONTAINER = 280;
const RING = 200;
const GLOW = 144;
const AMBER = '#F59E0B';

const center = (inner: number) => (CONTAINER - inner) / 2;

const RING_OPACITY: Record<WearingState, number> = {
  both:         1.0,
  partner_only: 1.0,
  you_only:     0.3,
  neither:      0.15,
};

interface Props {
  beat: BeatEvent | null;
  bpm: number | null;
  wearingState: WearingState;
}

export function HeartbeatRing({ beat, bpm, wearingState }: Props) {
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    if (!beat) return;

    const duration = Math.max(beat.intervalMs * 0.75, 400);

    rippleScale.setValue(1);
    rippleOpacity.setValue(0.65);

    Animated.parallel([
      // Ripple expands and fades
      Animated.timing(rippleScale, { toValue: 1.55, duration, useNativeDriver: true }),
      Animated.timing(rippleOpacity, { toValue: 0, duration, useNativeDriver: true }),
      // Ring pulses briefly
      Animated.sequence([
        Animated.timing(ringScale, { toValue: 1.06, duration: 110, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 1, duration: duration - 110, useNativeDriver: true }),
      ]),
      // Inner glow brightens and fades
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.28, duration: 110, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.12, duration: duration - 110, useNativeDriver: true }),
      ]),
    ]).start();
  }, [beat?.sequence]);

  return (
    <View style={[styles.container, { opacity: RING_OPACITY[wearingState] }]}>
      {/* Expanding ripple ring */}
      <Animated.View
        style={[
          styles.ring,
          styles.ripple,
          { transform: [{ scale: rippleScale }], opacity: rippleOpacity },
        ]}
      />
      {/* Static amber ring — pulses slightly on each beat */}
      <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }] }]} />
      {/* Soft inner glow */}
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      {/* BPM readout */}
      <View style={styles.bpmContainer}>
        {bpm !== null ? (
          <>
            <Text style={styles.bpmNumber}>{bpm}</Text>
            <Text style={styles.bpmLabel}>BPM</Text>
          </>
        ) : (
          <Text style={styles.bpmDash}>—</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CONTAINER,
    height: CONTAINER,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    top: center(RING),
    left: center(RING),
    borderRadius: RING / 2,
    borderWidth: 3,
    borderColor: AMBER,
  },
  ripple: {
    borderColor: AMBER,
    borderWidth: 2,
  },
  glow: {
    position: 'absolute',
    width: GLOW,
    height: GLOW,
    top: center(GLOW),
    left: center(GLOW),
    borderRadius: GLOW / 2,
    backgroundColor: AMBER,
  },
  bpmContainer: {
    position: 'absolute',
    width: CONTAINER,
    height: CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpmNumber: {
    color: AMBER,
    fontSize: 42,
    fontWeight: '200',
    letterSpacing: -1,
    lineHeight: 46,
  },
  bpmLabel: {
    color: AMBER,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 3,
    opacity: 0.7,
  },
  bpmDash: {
    color: AMBER,
    fontSize: 32,
    fontWeight: '200',
    opacity: 0.4,
  },
});
