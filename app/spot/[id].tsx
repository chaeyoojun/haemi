import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { InlineMoreActions } from '@/components/InlineMoreActions';
import { KakaoMapEmbed } from '@/components/KakaoMapEmbed';
import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import type { Spot } from '@/lib/types';

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [error, setError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setSpot(await api.get<Spot>(`/api/spots/${id}`));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <RefreshableScroll onRefresh={load} contentContainerStyle={styles.content}>
        {error && !spot ? (
          <Text style={{ color: palette.danger }}>{error}</Text>
        ) : !spot ? (
          <ActivityIndicator color={palette.tint} style={{ marginTop: 24 }} />
        ) : (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: palette.text }]}>{spot.title}</Text>
              {isAdmin ? (
                <InlineMoreActions
                  open={menuOpen}
                  onToggle={() => setMenuOpen((open) => !open)}
                  onEdit={() => router.push(`/spot/edit/${spot.id}`)}
                  onDelete={() =>
                    Alert.alert('스팟을 삭제할까요?', spot.title, [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '삭제',
                        style: 'destructive',
                        onPress: async () => {
                          await api.remove(`/api/spots/${spot.id}`);
                          router.replace('/spots');
                        },
                      },
                    ])
                  }
                />
              ) : null}
            </View>
            {spot.place ? (
              <>
                <View style={styles.placeRow}>
                  <Text style={[styles.meta, { color: palette.tint, flex: 1 }]}>{spot.place}</Text>
                  <Pressable
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setMapOpen((open) => !open);
                    }}
                    hitSlop={8}
                    accessibilityLabel={mapOpen ? '지도 닫기' : '지도에서 보기'}>
                    <Icon ios="mappin.and.ellipse" android="location_on" color={palette.tint} size={22} />
                  </Pressable>
                </View>
                {mapOpen ? <KakaoMapEmbed place={spot.place} height={280} /> : null}
              </>
            ) : null}
            {spot.description ? <Text style={[styles.body, { color: palette.text }]}>{spot.description}</Text> : null}
            <Text style={[styles.body, { color: palette.muted }]}>{formatDateTime(spot.createdAt)}</Text>
          </View>
        )}
      </RefreshableScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 24, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  title: { flex: 1, fontSize: 24, fontWeight: '700' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
});
