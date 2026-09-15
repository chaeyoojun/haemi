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
  return (
    <ThemeProvider value={HaemiTheme}>
      <AuthProvider>
        <View style={styles.root}>
          <StatusBar style="dark" />
          <SignedInApp />
        </View>
      </AuthProvider>
    </ThemeProvider>
  );
}

function SignedInApp() {
  const { ready, role } = useAuth();
  const [introDone, setIntroDone] = useState(Platform.OS === 'web');

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
    return <BrandSplash />;
  }
  if (!role) {
    return <LoginScreen />;
  }
  if (!introDone) {
    return <BrandSplash onFinish={() => setIntroDone(true)} />;
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
      <View style={[styles.stack, Platform.OS === 'web' && styles.stackWeb]}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: '#F07D22',
            headerTitle: '',
            headerBackTitle: '',
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: '#FFFFFF',
              ...(Platform.OS === 'web' ? { flex: 1, overflow: 'auto' } : null),
            },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="spot/new" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="spot/edit/[id]" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="spot/map" options={{ title: '' }} />
          <Stack.Screen name="spot/[id]" options={{ title: '' }} />
          <Stack.Screen name="repair/new" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="repair/[id]" options={{ title: '' }} />
          <Stack.Screen name="notice/new" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="notice/edit/[id]" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="notice/[id]" options={{ title: '' }} />
          <Stack.Screen name="vote/new" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="vote/edit/[id]" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="vote/[id]" options={{ title: '' }} />
          <Stack.Screen name="model/new" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="model/[id]" options={{ title: '' }} />
          <Stack.Screen name="model/edit/[id]" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="game/ranks" options={{ title: '' }} />
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
  stackWeb: {
    overflow: 'hidden',
  },
});
