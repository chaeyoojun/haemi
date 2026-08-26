import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { AppUpdateGate } from '@/components/AppUpdateGate';
import { BrandSplash } from '@/components/BrandSplash';
import { LoginScreen } from '@/components/LoginScreen';
import { AuthProvider, useAuth } from '@/lib/auth';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const HaemiTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#F07D22',
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1A1A1A',
    border: '#EDEDED',
    notification: '#F07D22',
  },
};

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    const timer = setTimeout(() => setIntroDone(true), 4500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider value={HaemiTheme}>
      <AuthProvider>
        <View style={styles.root}>
          <StatusBar style="dark" />
          {introDone ? <SignedInApp /> : <BrandSplash onFinish={() => setIntroDone(true)} />}
        </View>
      </AuthProvider>
    </ThemeProvider>
  );
}

function SignedInApp() {
  const { role } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      import('@/lib/notifications')
        .then((mod) => mod.promptAndRegisterNotifications())
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!role) {
      return;
    }
    import('@/lib/notifications')
      .then((mod) => mod.registerPushToken())
      .catch(() => undefined);
  }, [role]);

  if (!role) {
    return <LoginScreen />;
  }
  return (
    <AppUpdateGate>
      <RootLayoutNav />
    </AppUpdateGate>
  );
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#F07D22',
        headerTitleStyle: { color: '#1A1A1A' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spot/new" options={{ title: '스팟 등록', presentation: 'modal' }} />
      <Stack.Screen name="spot/map" options={{ title: '카카오맵' }} />
      <Stack.Screen name="spot/[id]" options={{ title: '스팟' }} />
      <Stack.Screen name="repair/new" options={{ title: '수리 요청', presentation: 'modal' }} />
      <Stack.Screen name="repair/[id]" options={{ title: '수리' }} />
      <Stack.Screen name="notice/new" options={{ title: '공지 작성', presentation: 'modal' }} />
      <Stack.Screen name="notice/[id]" options={{ title: '공지' }} />
      <Stack.Screen name="vote/new" options={{ title: '투표 만들기', presentation: 'modal' }} />
      <Stack.Screen name="vote/[id]" options={{ title: '투표' }} />
      <Stack.Screen name="model/new" options={{ title: '3D 파일 등록', presentation: 'modal' }} />
      <Stack.Screen name="model/[id]" options={{ title: '3D 파일' }} />
      <Stack.Screen name="model/edit/[id]" options={{ title: '3D 파일 수정', presentation: 'modal' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
