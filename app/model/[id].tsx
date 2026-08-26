import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import type { Model3d } from '@/lib/types';

export default function ModelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [model, setModel] = useState<Model3d | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setModel(await api.get<Model3d>(`/api/models/${id}`));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const download = model ? fileUrl(model.url) : '';

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <RefreshableScroll onRefresh={load} contentContainerStyle={styles.content}>
        {error && !model ? (
          <Text style={{ color: palette.danger }}>{error}</Text>
        ) : !model ? (
          <ActivityIndicator color={palette.tint} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.title, { color: palette.text }]}>{model.title}</Text>
              {model.format ? <Text style={[styles.meta, { color: palette.tint }]}>{model.format}</Text> : null}
              {model.fileName ? <Text style={[styles.body, { color: palette.text }]}>{model.fileName}</Text> : null}
              {model.description ? <Text style={[styles.body, { color: palette.text }]}>{model.description}</Text> : null}
              <Text style={[styles.body, { color: palette.muted }]}>{formatDateTime(model.createdAt)}</Text>
            </View>
            {download ? (
              <Pressable onPress={() => Linking.openURL(download)} style={[styles.submit, { backgroundColor: palette.tint }]}>
                <Text style={styles.submitText}>다운로드</Text>
              </Pressable>
            ) : null}
            {isAdmin ? (
              <>
                <Pressable
                  onPress={() => router.push(`/model/edit/${model.id}`)}
                  style={[styles.submit, { backgroundColor: palette.tint }]}>
                  <Text style={styles.submitText}>수정</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('3D 파일을 삭제할까요?', model.title, [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '삭제',
                        style: 'destructive',
                        onPress: async () => {
                          await api.remove(`/api/models/${model.id}`);
                          router.replace('/models');
                        },
                      },
                    ])
                  }
                  style={[styles.deleteButton, { borderColor: palette.danger }]}>
                  <Text style={[styles.deleteText, { color: palette.danger }]}>삭제</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}
      </RefreshableScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10 },
  title: { fontSize: 24, fontWeight: '700' },
  meta: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  deleteButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteText: { fontSize: 15, fontWeight: '700' },
});
