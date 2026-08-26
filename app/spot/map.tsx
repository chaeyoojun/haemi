import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { KakaoMapEmbed } from '@/components/KakaoMapEmbed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function SpotMapScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const palette = Colors[useColorScheme()];
  const query = Array.isArray(q) ? q[0] : q;

  if (!query?.trim()) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.muted }}>주소가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <KakaoMapEmbed place={query} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
