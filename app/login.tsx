import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { login, unlockWithBiometrics, hasLockedSession } = useAuth();
  const biometrics = useBiometrics();
  const { colors, spacing, radius, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Inline field-level errors (D-04) — replace the old Alert.alert popups.
  const [subdomainError, setSubdomainError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  // A saved session locked behind biometrics → show the "Use Face ID" button.
  // NOTE: intentionally NOT auto-prompted on mount. Auto-firing Face ID the instant
  // the login screen appears was jarring and fired right after Sign Out (logout →
  // redirect to /login). Face ID is now strictly button-initiated.
  const canUseBiometricUnlock = biometrics.available && biometrics.enabled && hasLockedSession;

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

  // Real biometric unlock: reads the keychain-gated token (OS prompts Face ID/Touch ID)
  // and restores the session. On failure the password form stays available — never a dead end.
  const handleBiometricLogin = async () => {
    try {
      await unlockWithBiometrics();
    } catch {
      // Cancelled/failed — password remains available.
    }
  };

  // Clear a field's error as the user edits it (calm recovery).
  const onChangeSubdomain = (v: string) => {
    setSubdomain(v);
    if (subdomainError) setSubdomainError(undefined);
  };
  const onChangeEmail = (v: string) => {
    // Force lowercase as the user types (the submit-time trim().toLowerCase() stays).
    setEmail(v.toLowerCase());
    if (emailError) setEmailError(undefined);
  };
  const onChangePassword = (v: string) => {
    setPassword(v);
    if (passwordError) setPasswordError(undefined);
  };

  return (
    <View style={s.host}>
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
              autoCapitalize="none"
              autoCorrect={false}
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
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@company.com"
              editable={!loading}
              testID="login-email-input"
            />
            <Input
              label="Password"
              leftIcon="lock"
              rightIcon={showPassword ? 'eye.slash' : 'eye'}
              onRightIconPress={() => setShowPassword((prev) => !prev)}
              rightIconAccessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              rightIconTestID="login-password-toggle"
              value={password}
              onChangeText={onChangePassword}
              error={passwordError}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
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

            {canUseBiometricUnlock ? (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                label={`Use ${biometrics.biometricType ?? 'Face ID'}`}
                leftIcon="faceid"
                onPress={() => void handleBiometricLogin()}
                testID="login-biometric-button"
              />
            ) : null}

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
      </Screen>

      {helpOpen ? (
        <Sheet
          onClose={() => setHelpOpen(false)}
          fitContent
          header={
            <Text variant="title2" weight="700">
              Trouble signing in?
            </Text>
          }
        >
          <View style={[s.helpContent, { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={{ gap: spacing.md }}>
              <Text variant="body" tone="muted">
                Your company code, email, and password come from your office. If
                you&apos;re locked out or unsure, your manager can confirm them.
              </Text>
              <Text variant="body" tone="muted">
                Call your office and ask for your Hudson Business Solutions login
                details. There is no self-service password reset in the app.
              </Text>
            </View>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              label="Got it"
              haptic="selection"
              onPress={() => setHelpOpen(false)}
              testID="login-help-dismiss"
            />
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // Full-screen host so the help Sheet (sibling of Screen, not inside its
  // ScrollView) overlays the whole screen and rises from the device bottom.
  host: { flex: 1 },
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
  // Help sheet content: paragraphs then a full-width "Got it" button, stacked
  // with a gap. Scrollable (Sheet `scrollable`) so all content stays reachable
  // on smaller iPhones; bottom padding clears the home indicator.
  helpContent: {},
});
