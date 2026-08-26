import { useState } from 'react';
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

const hero = require('../assets/images/login-hero.png');

export function LoginScreen() {
  const palette = Colors[useColorScheme()];
  const { enterAsUser, loginAdmin } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const heroSize = windowWidth - 56;
  const [adminForm, setAdminForm] = useState(false);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onAdminLogin = () => {
    setError('');
    try {
      loginAdmin(id, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인하지 못했습니다.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image
          source={hero}
          style={{ width: heroSize, height: heroSize, alignSelf: 'center', marginBottom: 8 }}
          resizeMode="contain"
        />

        {adminForm ? (
          <View style={styles.form}>
            <Field label="아이디">
              <Input
                value={id}
                onChangeText={setId}
                placeholder="아이디"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
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
            <Pressable
              onPress={enterAsUser}
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
