import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { confirmLogout, useAuth } from '@/lib/auth';
import { useWideLayout } from '@/lib/layout';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

const tabs: {
  href: Href;
  title: string;
  match: (path: string) => boolean;
  ios: SFSymbol;
  android: AndroidSymbol;
}[] = [
  {
    href: '/',
    title: '공지',
    match: (path) => path === '/' || path.startsWith('/notice'),
    ios: 'megaphone.fill',
    android: 'campaign',
  },
  {
    href: '/flight',
    title: '비행',
    match: (path) => path === '/flight' || path.startsWith('/flight'),
    ios: 'airplane',
    android: 'flight',
  },
  {
    href: '/spots',
    title: '스팟',
    match: (path) => path.startsWith('/spot'),
    ios: 'mappin.and.ellipse',
    android: 'location_on',
  },
  {
    href: '/repairs',
    title: '수리',
    match: (path) => path.startsWith('/repair'),
    ios: 'wrench.and.screwdriver.fill',
    android: 'build',
  },
  {
    href: '/models',
    title: '3D',
    match: (path) => path.startsWith('/model'),
    ios: 'cube.fill',
    android: 'view_in_ar',
  },
  {
    href: '/votes',
    title: '투표',
    match: (path) => path.startsWith('/vote'),
    ios: 'checkmark.square.fill',
    android: 'how_to_vote',
  },
  {
    href: '/game',
    title: '게임',
    match: (path) => path === '/game' || path.startsWith('/game'),
    ios: 'gamecontroller.fill',
    android: 'sports_esports',
  },
];

export function AppTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = Colors[useColorScheme()];
  const wide = useWideLayout();
  const { displayName, logout } = useAuth();

  return (
    <View
      style={[
        wide ? styles.barWide : styles.bar,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          paddingBottom: wide ? 0 : Math.max(insets.bottom, 8),
          paddingTop: wide ? Math.max(insets.top, 0) : 8,
        },
      ]}>
      {wide ? (
        <Text style={[styles.brand, { color: palette.tint }]} accessibilityRole="header">
          HMFPV
        </Text>
      ) : null}
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const color = active ? palette.tint : palette.tabIconDefault;
        return (
          <Pressable
            key={tab.title}
            onPress={() => {
              if (!active || pathname !== tab.href) {
                router.navigate(tab.href);
              }
            }}
            style={[
              wide ? styles.itemWide : styles.item,
              wide && active ? { backgroundColor: '#FEF6EE' } : null,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.title}>
            <Icon ios={tab.ios} android={tab.android} color={color} size={wide ? 20 : 24} />
            <Text style={[wide ? styles.labelWide : styles.label, { color }]}>{tab.title}</Text>
          </Pressable>
        );
      })}
      {wide ? <View style={styles.spacer} /> : null}
      {wide && displayName ? (
        <Pressable
          onPress={() => confirmLogout(logout)}
          hitSlop={8}
          accessibilityLabel={`${displayName} 로그아웃`}>
          <Text style={[styles.nameWide, { color: palette.muted }]} numberOfLines={1}>
            {displayName}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  barWide: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 28,
    minHeight: 64,
    gap: 4,
  },
  brand: {
    fontSize: 20,
    fontWeight: '800',
    marginRight: 20,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  itemWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    cursor: 'pointer',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelWide: {
    fontSize: 15,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  nameWide: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 140,
    cursor: 'pointer',
  },
});
