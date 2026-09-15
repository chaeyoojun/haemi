import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { appDownloadPageUrl, fetchAppRelease } from '@/lib/appUpdate';

type Variant = 'link' | 'button' | 'bar';

export function AppDownloadLink({ variant = 'link' }: { variant?: Variant }) {
  const palette = Colors[useColorScheme()];
  const [label, setLabel] = useState('앱 설치');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    fetchAppRelease()
      .then((release) => {
        if (release.version && release.version !== 'web') {
          setLabel(`앱 설치 ${release.version}`);
        }
      })
      .catch(() => undefined);
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  const onPress = () => {
    void Linking.openURL(appDownloadPageUrl());
  };

  if (variant === 'bar') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel="앱 설치 페이지 열기"
        style={[styles.bar, { backgroundColor: palette.tint }]}>
        <Text style={styles.barText}>{label}</Text>
      </Pressable>
    );
  }

  if (variant === 'button') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel="앱 설치 페이지 열기"
        style={[styles.button, { borderColor: palette.tint }]}>
        <Text style={[styles.buttonText, { color: palette.tint }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel="앱 설치 페이지 열기">
      <Text style={[styles.link, { color: palette.tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: 14,
    fontWeight: '700',
    cursor: 'pointer',
  },
  button: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    cursor: 'pointer',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  bar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    cursor: 'pointer',
  },
  barText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
