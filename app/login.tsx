import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoginBackdrop } from '@/components/ui/LoginBackdrop';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useAuth } from '../src/mobile/context/AuthContext';
import { useBiometrics } from '../src/mobile/hooks/useBiometrics';
import { useTheme } from '../src/mobile/theme';

const LOGO_SIZE = 66;
const CTA_HEIGHT = 64; // login-local CTA height (sketch) — does NOT touch the shared Button token
const YBAR_WIDTH = 48;
const YBAR_HEIGHT = 5;

export default function LoginScreen() {
  const { login } = useAuth();
  const biometrics = useBiometrics();
  const { colors, spacing, radius, elevation } = useTheme();

  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Inline field-level errors (D-04) — replace the old Alert.alert popups.
  const [subdomainError, setSubdomainError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  // Auto-prompt biometrics on mount if enabled. PRESERVED from the original screen:
  // handleBiometricLogin stays INERT (Phase 7 owns the real fix); useBiometrics
  // wiring is unchanged.
  useEffect(() => {
    if (!biometrics.available || !biometrics.enabled) return;
    void handleBiometricLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometrics.available, biometrics.enabled]);

  const handleLogin = async () => {
    const cleanSubdomain = subdomain.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Inline validation (no Alert): set the offending field's error, keep values.
    let hasError = false;
    if (!cleanSubdomain) {
      setSubdomainError('Enter your company code');
      hasError = true;
    }
    if (!cleanEmail) {
      setEmailError('Enter your email');
      hasError = true;
    }
    if (!password) {
      setPasswordError('Enter your password');
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    try {
      await login(cleanSubdomain, cleanEmail, password);
    } catch {
      // Calm, inline, value-preserving error on the password field (D-04).
      setPasswordError("That password didn't match. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // INERT biometric handler — preserved no-op-on-result behavior (Phase 7 fix).
  const handleBiometricLogin = async () => {
    try {
      await biometrics.authenticate();
    } catch {
      // Biometric failed silently — password remains available.
    }
  };

  // Clear a field's error as the user edits it (calm recovery).
  const onChangeSubdomain = (v: string) => {
    setSubdomain(v);
    if (subdomainError) setSubdomainError(undefined);
  };
  const onChangeEmail = (v: string) => {
    setEmail(v);
    if (emailError) setEmailError(undefined);
  };
  const onChangePassword = (v: string) => {
    setPassword(v);
    if (passwordError) setPasswordError(undefined);
  };

  return (
    <Screen scroll keyboardAvoiding padded={false} background="bg">
      <View style={s.root}>
        <LoginBackdrop />

        <View style={[s.column, { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }]}>
          {/* TOP GROUP — logo, marker bar, headline */}
          <View style={s.top}>
            <Image
              source={require('../assets/images/icon.png')}
              style={[s.logo, { borderRadius: radius.lg, borderColor: colors.border }]}
            />
            <View
              style={[
                s.ybar,
                { backgroundColor: colors.yellow, borderRadius: radius.pill, marginTop: spacing.md, marginBottom: spacing.md },
              ]}
            />
            <Text variant="largeTitle" weight="800">
              Sign in to{'\n'}get to work.
            </Text>
          </View>

          {/* FORM GROUP — three glove-sized fields with leading icons */}
          <View style={[s.form, { gap: spacing.md }]}>
            <Input
              label="Company code"
              helper="Not sure? Ask your manager."
              leftIcon="building.2"
              value={subdomain}
              onChangeText={onChangeSubdomain}
              error={subdomainError}
              placeholder="hudson"
              editable={!loading}
              testID="login-subdomain-input"
            />
            <Input
              label="Email"
              leftIcon="envelope"
              value={email}
              onChangeText={onChangeEmail}
              error={emailError}
              keyboardType="email-address"
              placeholder="you@company.com"
              editable={!loading}
              testID="login-email-input"
            />
            <Input
              label="Password"
              leftIcon="lock"
              value={password}
              onChangeText={onChangePassword}
              error={passwordError}
              secureTextEntry
              placeholder="Password"
              editable={!loading}
              testID="login-password-input"
            />
          </View>

          {/* ACTIONS GROUP — pinned low (thumb zone) */}
          <View style={[s.actions, { gap: spacing.sm }]}>
            <View style={[{ minHeight: CTA_HEIGHT, justifyContent: 'center' }, elevation.glowYellow]}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                label="Sign In"
                rightIcon="arrow.right"
                loading={loading}
                onPress={() => void handleLogin()}
                testID="login-submit-button"
              />
            </View>

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              label="Use Face ID"
              leftIcon="faceid"
              onPress={() => void handleBiometricLogin()}
              testID="login-biometric-button"
            />

            <Button
              variant="ghost"
              size="md"
              fullWidth
              label="Trouble signing in?"
              haptic="selection"
              onPress={() => setHelpOpen(true)}
            />
          </View>
        </View>
      </View>

      {helpOpen ? (
        <Sheet
          onClose={() => setHelpOpen(false)}
          snapPoints={['40%']}
          header={
            <Text variant="title2" weight="700">
              Trouble signing in?
            </Text>
          }
        >
          <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
            <Text variant="body" tone="muted">
              Your company code, email, and password come from your office. If
              you&apos;re locked out or unsure, your manager can confirm them.
            </Text>
            <Text variant="body" tone="muted">
              Call your office and ask for your Hudson Business Solutions login
              details. There is no self-service password reset in the app.
            </Text>
          </View>
        </Sheet>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  root: {
    flexGrow: 1,
    minHeight: '100%',
  },
  column: {
    flex: 1,
    justifyContent: 'space-between',
  },
  top: {
    alignItems: 'flex-start',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ybar: {
    width: YBAR_WIDTH,
    height: YBAR_HEIGHT,
  },
  form: {},
  actions: {},
});
