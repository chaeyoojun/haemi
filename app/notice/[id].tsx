import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import type { Notice } from '@/lib/types';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get<Notice>(`/api/notices/${id}`)
      .then(setNotice)
      .catch((caught) => setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.'));
  }, [id]);

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.danger }}>{error}</Text>
      </View>
    );
  }
  if (!notice) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>{notice.title}</Text>
        <Text style={[styles.body, { color: palette.muted }]}>{formatDateTime(notice.createdAt)}</Text>
        {notice.body ? <Text style={[styles.body, { color: palette.text }]}>{notice.body}</Text> : null}
      </View>
      {isAdmin ? (
        <Pressable
          onPress={() =>
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
            ])
          }
          style={[styles.deleteButton, { borderColor: palette.danger }]}>
          <Text style={[styles.deleteText, { color: palette.danger }]}>삭제</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10 },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  deleteButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteText: { fontSize: 15, fontWeight: '700' },
});
