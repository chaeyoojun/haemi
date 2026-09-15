import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { brandFillSize, brandHero } from '@/components/BrandSplash';
import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { useWideLayout } from '@/lib/layout';

const LOGIN_WIDTH = 560;

export function LoginScreen() {
  const palette = Colors[useColorScheme()];
  const { enterAsUser, loginAdmin, displayName } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const wide = useWideLayout();
  const fillSize = brandFillSize(windowWidth, windowHeight);
  const heroSize = wide
    ? Math.min(windowWidth - 80, windowHeight * 0.7, 760)
    : Math.min(windowWidth - 48, 400);
  const formWidth = Math.min(windowWidth - 48, wide ? LOGIN_WIDTH : 400);
  const columnWidth = Math.max(heroSize, formWidth);
  const progress = useRef(new Animated.Value(0)).current;
  const [introDone, setIntroDone] = useState(false);
  const [name, setName] = useState(displayName);
  const [adminForm, setAdminForm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (displayName) {
      setName(displayName);
    }
  }, [displayName]);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    const hold = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: 820,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setIntroDone(true);
        }
      });
    }, 1100);
    return () => clearTimeout(hold);
  }, [progress]);

  const logoSize = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [fillSize, heroSize],
  });
  const formOpacity = progress.interpolate({
    inputRange: [0.42, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const formShift = progress.interpolate({
    inputRange: [0.42, 1],
    outputRange: [28, 0],
    extrapolate: 'clamp',
  });
  const formMaxHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 420],
  });

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
        keyboardShouldPersistTaps="handled"
        scrollEnabled={introDone}>
        <View style={[styles.column, { width: columnWidth, maxWidth: '100%' }]}>
          <Animated.Image
            source={brandHero}
            resizeMode="contain"
            style={{
              width: logoSize,
              height: logoSize,
              alignSelf: 'center',
            }}
          />

          <Animated.View
            pointerEvents={introDone ? 'auto' : 'none'}
            style={{
              opacity: formOpacity,
              maxHeight: formMaxHeight,
              overflow: 'hidden',
              width: formWidth,
              alignSelf: 'center',
              transform: [{ translateY: formShift }],
            }}>
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
          </Animated.View>
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
  column: { gap: 8, alignItems: 'stretch' },
  form: { gap: 12, marginTop: 8, width: '100%' },
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
