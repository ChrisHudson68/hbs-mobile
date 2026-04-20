import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../src/mobile/context/AuthContext';
import { Colors, Radius, Spacing } from '../src/mobile/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanSubdomain = subdomain.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanSubdomain) { Alert.alert('Required', 'Enter your company subdomain.'); return; }
    if (!cleanEmail || !password) { Alert.alert('Required', 'Enter your email and password.'); return; }

    setLoading(true);
    try {
      await login(cleanSubdomain, cleanEmail, password);
    } catch (err) {
      Alert.alert('Sign In Failed', err instanceof Error ? err.message : 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.hero}>
            <Text style={s.eyebrow}>Mobile</Text>
            <Text style={s.title}>Hudson Business{'\n'}Solutions</Text>
            <Text style={s.subtitle}>Sign in to your company workspace</Text>
          </View>

          <View style={s.card}>
            <View style={s.field}>
              <Text style={s.label}>Company Subdomain</Text>
              <TextInput
                style={s.input}
                value={subdomain}
                onChangeText={setSubdomain}
                placeholder="yourcompany"
                placeholderTextColor={Colors.mutedLight}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={Colors.mutedLight}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Password</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={Colors.mutedLight}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={() => void handleLogin()} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Sign In</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.navyDark },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.md, gap: Spacing.md },
  hero: { alignItems: 'center', paddingVertical: Spacing.xl, gap: 8 },
  eyebrow: { color: Colors.yellow, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg,
  },
  btn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    padding: 14, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
