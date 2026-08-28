import { DefaultTheme, Stack, ThemeProvider, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { AppTabBar } from '@/components/AppTabBar';
import { AppUpdateGate } from '@/components/AppUpdateGate';
import { BrandSplash } from '@/components/BrandSplash';
import { LoginScreen } from '@/components/LoginScreen';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useWideLayout } from '@/lib/layout';

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
  const [introDone, setIntroDone] = useState(Platform.OS === 'web');

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    if (Platform.OS === 'web') {
      return;
    }
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
  const { ready, role } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const timer = setTimeout(() => {
      import('@/lib/notifications')
        .then((mod) => mod.promptAndRegisterNotifications())
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!role || Platform.OS === 'web') {
      return;
    }
    import('@/lib/notifications')
      .then((mod) => {
        void mod.registerPushToken();
        void mod.syncVoteEndAlerts();
      })
      .catch(() => undefined);
  }, [role]);

  if (!ready) {
    return null;
  }
  if (!role) {
    return <LoginScreen />;
  }
  if (Platform.OS === 'web') {
    return <RootLayoutNav />;
  }
  return (
    <AppUpdateGate>
      <RootLayoutNav />
    </AppUpdateGate>
  );
}

function RootLayoutNav() {
  const router = useRouter();
  const wide = useWideLayout();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let unsub = () => {};
    import('@/lib/notifications')
      .then((mod) => {
        unsub = mod.listenForNotificationOpen((url) => {
          router.push(url as Href);
        });
      })
      .catch(() => undefined);
    return () => unsub();
  }, [router]);

  return (
    <View style={styles.shell}>
      {wide ? <AppTabBar /> : null}
      <View style={styles.stack}>
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
          <Stack.Screen name="spot/edit/[id]" options={{ title: '스팟 수정', presentation: 'modal' }} />
          <Stack.Screen name="spot/map" options={{ title: '지도' }} />
          <Stack.Screen name="spot/[id]" options={{ title: '스팟' }} />
          <Stack.Screen name="repair/new" options={{ title: '수리 요청', presentation: 'modal' }} />
          <Stack.Screen name="repair/[id]" options={{ title: '수리' }} />
          <Stack.Screen name="notice/new" options={{ title: '공지 작성', presentation: 'modal' }} />
          <Stack.Screen name="notice/edit/[id]" options={{ title: '공지 수정', presentation: 'modal' }} />
          <Stack.Screen name="notice/[id]" options={{ title: '공지' }} />
          <Stack.Screen name="vote/new" options={{ title: '투표 만들기', presentation: 'modal' }} />
          <Stack.Screen name="vote/edit/[id]" options={{ title: '투표 수정', presentation: 'modal' }} />
          <Stack.Screen name="vote/[id]" options={{ title: '투표' }} />
          <Stack.Screen name="model/new" options={{ title: '3D 파일 등록', presentation: 'modal' }} />
          <Stack.Screen name="model/[id]" options={{ title: '3D 파일' }} />
          <Stack.Screen name="model/edit/[id]" options={{ title: '3D 파일 수정', presentation: 'modal' }} />
        </Stack>
      </View>
      {wide ? null : <AppTabBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  shell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stack: {
    flex: 1,
    minHeight: 0,
  },
});
