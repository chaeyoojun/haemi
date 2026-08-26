import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
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
];

export function AppTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = Colors[useColorScheme()];

  return (
    <View style={[styles.bar, { backgroundColor: palette.card, borderTopColor: palette.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
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
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.title}>
            <Icon ios={tab.ios} android={tab.android} color={color} size={24} />
            <Text style={[styles.label, { color }]}>{tab.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
