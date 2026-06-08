import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useOnboarding } from '../../lib/onboarding';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function partnerRequest(action: string, extra?: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const res = await fetch(`${API_URL}/api/partner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...extra }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json;
}

type Mode = 'choose' | 'generate' | 'enter';

export default function LinkPartnerScreen() {
  const { markOnboardingComplete } = useOnboarding();
  const [mode, setMode] = useState<Mode>('choose');

  // Generate state
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Enter state
  const [inputCode, setInputCode] = useState('');
  const [enterLoading, setEnterLoading] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [expiresAt]);

  const handleGenerate = useCallback(async () => {
    setGenLoading(true);
    setGenError(null);
    try {
      const data = await partnerRequest('generate');
      setCode(data.code);
      setExpiresAt(new Date(data.expiresAt));
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate code');
    } finally {
      setGenLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'generate' && !code) handleGenerate();
  }, [mode, code, handleGenerate]);

  const handleRedeem = useCallback(async () => {
    setEnterLoading(true);
    setEnterError(null);
    try {
      await partnerRequest('redeem', { code: inputCode });
      setLinked(true);
    } catch (err: unknown) {
      setEnterError(err instanceof Error ? err.message : 'Failed to redeem code');
    } finally {
      setEnterLoading(false);
    }
  }, [inputCode]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (mode === 'choose') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Link your partner</Text>
        <Text style={styles.subtitle}>
          One of you generates a code, the other enters it.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => setMode('generate')}>
          <Text style={styles.buttonText}>Show my code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonOutline} onPress={() => setMode('enter')}>
          <Text style={styles.buttonOutlineText}>Enter partner's code</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skip}
          onPress={async () => {
            await markOnboardingComplete();
            router.replace('/(tabs)');
          }}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'generate') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => { setCode(null); setMode('choose'); }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your invite code</Text>
        <Text style={styles.subtitle}>Share this with your partner. It expires in 15 minutes.</Text>

        {genLoading && <ActivityIndicator color="#F5A623" size="large" style={styles.spinner} />}
        {genError && <Text style={styles.error}>{genError}</Text>}

        {code && (
          <>
            <Text style={styles.code}>{code}</Text>
            <Text style={[styles.countdown, secondsLeft < 60 && styles.countdownUrgent]}>
              Expires in {mm}:{ss}
            </Text>
            <TouchableOpacity
              style={styles.buttonOutline}
              onPress={() => { setCode(null); setExpiresAt(null); handleGenerate(); }}
            >
              <Text style={styles.buttonOutlineText}>Generate new code</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  // Enter mode
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => setMode('choose')}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Enter code</Text>
      <Text style={styles.subtitle}>Ask your partner to share their 6-letter code.</Text>

      {linked ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>Partners linked!</Text>
          <TouchableOpacity
            style={styles.goButton}
            onPress={async () => {
              await markOnboardingComplete();
              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.goButtonText}>Go to app</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.codeInput}
            value={inputCode}
            onChangeText={(t) =>
              setInputCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
            }
            placeholder="XXXXXX"
            placeholderTextColor="#444444"
            autoCapitalize="characters"
            maxLength={6}
            editable={!enterLoading}
          />
          {enterError && <Text style={styles.error}>{enterError}</Text>}
          <TouchableOpacity
            style={[styles.button, inputCode.length < 6 && styles.buttonDisabled]}
            onPress={handleRedeem}
            disabled={inputCode.length < 6 || enterLoading}
          >
            {enterLoading
              ? <ActivityIndicator color="#1A1A1A" />
              : <Text style={styles.buttonText}>Link partner</Text>
            }
          </TouchableOpacity>
        </>
      )}
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
  back: { alignSelf: 'flex-start', marginBottom: 24 },
  backText: { color: '#888888', fontSize: 14 },
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
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#1A1A1A', fontSize: 16, fontWeight: '600' },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonOutlineText: { color: '#F5A623', fontSize: 16 },
  spinner: { marginTop: 40 },
  code: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 8,
    marginTop: 24,
  },
  countdown: { color: '#888888', fontSize: 13, marginTop: 12, marginBottom: 32 },
  countdownUrgent: { color: '#FF6B6B' },
  codeInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 6,
    paddingVertical: 16,
    paddingHorizontal: 24,
    textAlign: 'center',
    width: '100%',
    marginTop: 8,
  },
  error: { color: '#FF6B6B', fontSize: 14, marginTop: 12, textAlign: 'center' },
  successBox: {
    backgroundColor: '#1E3A1E',
    borderRadius: 10,
    padding: 24,
    marginTop: 32,
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  successText: { color: '#4CAF50', fontSize: 20, fontWeight: '600' },
  goButton: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  goButtonText: { color: '#1A1A1A', fontSize: 16, fontWeight: '700' },
  skip: { marginTop: 24, paddingVertical: 8 },
  skipText: { color: '#555555', fontSize: 14 },
});
