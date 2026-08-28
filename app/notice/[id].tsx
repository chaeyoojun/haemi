import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { InlineMoreActions } from '@/components/InlineMoreActions';
import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatAuthorTime } from '@/lib/format';
import type { Notice } from '@/lib/types';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setNotice(await api.get<Notice>(`/api/notices/${id}`));
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
        {error && !notice ? (
          <Text style={{ color: palette.danger }}>{error}</Text>
        ) : !notice ? (
          <ActivityIndicator color={palette.tint} style={{ marginTop: 24 }} />
        ) : (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                {notice.title}
              </Text>
              {isAdmin ? (
                <InlineMoreActions
                  open={menuOpen}
                  onToggle={() => setMenuOpen((open) => !open)}
                  actions={[
                    { label: '수정', onPress: () => router.push(`/notice/edit/${notice.id}`) },
                    {
                      label: '삭제',
                      danger: true,
                      onPress: () =>
                        Alert.alert('공지를 삭제할까요?', notice.title, [
                          { text: '취소', style: 'cancel' },
                          {
                            text: '삭제',
                            style: 'destructive',
                            onPress: async () => {
                              await api.remove(`/api/notices/${notice.id}`);
                              router.replace('/');
                            },
                          },
                        ]),
                    },
                  ]}
                />
              ) : null}
            </View>
            <Text style={[styles.body, { color: palette.muted }]}>{formatAuthorTime(notice.author, notice.createdAt)}</Text>
            {notice.body ? <Text style={[styles.body, { color: palette.text }]}>{notice.body}</Text> : null}
          </View>
        )}
      </RefreshableScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, overflow: 'visible', zIndex: 2 },
  title: { flex: 1, fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
});
