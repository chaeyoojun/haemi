import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { FORM_MAX_WIDTH, useWideLayout } from '@/lib/layout';

const hero = require('../assets/images/login-hero.png');

export function LoginScreen() {
  const palette = Colors[useColorScheme()];
  const { enterAsUser, loginAdmin, displayName } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const wide = useWideLayout();
  const heroSize = Math.min(wide ? 280 : windowWidth - 56, 360);
  const [name, setName] = useState(displayName);
  const [adminForm, setAdminForm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (displayName) {
      setName(displayName);
    }
  }, [displayName]);

  const onUserLogin = () => {
    setError('');
    try {
      enterAsUser(name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인하지 못했습니다.');
    }
  };

  const onAdminLogin = () => {
    setError('');
    try {
      loginAdmin(password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인하지 못했습니다.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webScroll]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.column, Platform.OS === 'web' && styles.webColumn]}>
        <Image
          source={hero}
          style={{ width: heroSize, height: heroSize, alignSelf: 'center', marginBottom: 8 }}
          resizeMode="contain"
        />

        {adminForm ? (
          <View style={styles.form}>
            <Field label="비밀번호">
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
            <Pressable
              onPress={onAdminLogin}
              style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <Text style={styles.primaryText}>관리자 로그인</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAdminForm(false);
                setError('');
              }}
              style={[styles.secondaryButton, { borderColor: palette.border }]}>
              <Text style={[styles.secondaryText, { color: palette.text }]}>뒤로</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Field label="이름">
              <Input
                value={name}
                onChangeText={setName}
                placeholder="이 기기에서 쓸 이름"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={onUserLogin}
              />
            </Field>
            {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
            <Pressable
              onPress={onUserLogin}
              style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <Text style={styles.primaryText}>사용자</Text>
            </Pressable>
            <Pressable
              onPress={() => setAdminForm(true)}
              style={[styles.secondaryButton, { borderColor: palette.tint }]}>
              <Text style={[styles.secondaryText, { color: palette.tint }]}>관리자</Text>
            </Pressable>
          </View>
        )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 8,
  },
  webScroll: { alignItems: 'center' },
  column: { width: '100%', gap: 8 },
  webColumn: { maxWidth: FORM_MAX_WIDTH },
  form: { gap: 12, marginTop: 8 },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryText: { fontSize: 17, fontWeight: '700' },
});
