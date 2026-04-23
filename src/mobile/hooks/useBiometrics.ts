import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

export type BiometricState = {
  available: boolean;
  enabled: boolean;
  biometricType: string | null;
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
  authenticate: () => Promise<boolean>;
};

function describeBiometricType(types: LocalAuthentication.AuthenticationType[]): string | null {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
  return 'Biometrics';
}

export function useBiometrics(): BiometricState {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setAvailable(true);
        setBiometricType(describeBiometricType(types));
      }
      const stored = await SecureStore.getItemAsync(STORAGE_KEYS.biometricsEnabled).catch(() => null);
      setEnabled(stored === 'true');
    })();
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify to enable biometric login',
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      await SecureStore.setItemAsync(STORAGE_KEYS.biometricsEnabled, 'true');
      setEnabled(true);
    }
    return result.success;
  }, []);

  const disable = useCallback(async (): Promise<void> => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.biometricsEnabled);
    setEnabled(false);
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!available || !enabled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Hudson Business Solutions',
      cancelLabel: 'Use Password',
      fallbackLabel: 'Use Password',
    });
    return result.success;
  }, [available, enabled]);

  return { available, enabled, biometricType, enable, disable, authenticate };
}
