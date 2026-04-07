import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { styles } from '../styles';

type Props = {
  authLoading: boolean;
  tenantInput: string;
  email: string;
  password: string;
  setTenantInput: (value: string) => void;
  setTenantSubdomain: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onLogin: () => void;
};

export default function AuthScreen({
  authLoading,
  tenantInput,
  email,
  password,
  setTenantInput,
  setTenantSubdomain,
  setEmail,
  setPassword,
  onLogin,
}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.authScrollContent}>
        <View style={styles.authCard}>
          <Text style={styles.brandEyebrow}>Mobile</Text>
          <Text style={styles.authTitle}>Hudson Business Solutions</Text>
          <Text style={styles.authSubtitle}>
            Sign in with your company subdomain, email, and password.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Company Subdomain</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!authLoading}
              onChangeText={(value) => {
                setTenantInput(value);
                setTenantSubdomain('');
              }}
              placeholder="taylorsreno"
              placeholderTextColor="#9AA5B1"
              style={styles.input}
              value={tenantInput}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!authLoading}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#9AA5B1"
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!authLoading}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#9AA5B1"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          <Pressable disabled={authLoading} onPress={onLogin} style={styles.primaryButton}>
            {authLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}