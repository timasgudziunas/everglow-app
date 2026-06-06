import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedEmail, setConfirmedEmail] = useState(false);

  async function signUp() {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else if (data.session === null) {
      // Email confirmation required — Supabase default
      setConfirmedEmail(true);
    }
    // If data.session is non-null, auth state change fires and navigates automatically
  }

  if (confirmedEmail) {
    return (
      <View style={styles.container}>
        <Text style={styles.wordmark}>everglow</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>We sent a confirmation link to {email}. Open it to activate your account, then sign in.</Text>
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Go to sign in</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.wordmark}>everglow</Text>
      <Text style={styles.title}>Create account</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#555"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="next"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#555"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={signUp}
      />

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={signUp} disabled={loading}>
        {loading ? <ActivityIndicator color="#1A1A1A" /> : <Text style={styles.buttonText}>Create account</Text>}
      </TouchableOpacity>

      <Link href="/(auth)/login" asChild>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkTextBold}>Sign in</Text></Text>
        </TouchableOpacity>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 32 },
  wordmark: { color: '#F59E0B', fontSize: 20, fontWeight: '700', letterSpacing: 2, marginBottom: 40, textTransform: 'lowercase' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 28, alignSelf: 'flex-start' },
  body: { color: '#888', fontSize: 15, lineHeight: 22, marginBottom: 32, alignSelf: 'flex-start' },
  error: { color: '#EF4444', fontSize: 14, marginBottom: 16, alignSelf: 'flex-start' },
  input: {
    width: '100%',
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#1A1A1A', fontSize: 16, fontWeight: '700' },
  link: { padding: 8 },
  linkText: { color: '#888', fontSize: 14 },
  linkTextBold: { color: '#F59E0B', fontWeight: '600' },
});
