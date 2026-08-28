import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { InlineMoreActions } from '@/components/InlineMoreActions';
import { pickModelFiles } from '@/components/ModelForm';
import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { appendLocalFile } from '@/lib/formData';
import { formatAuthorTime, formatDateTime } from '@/lib/format';
import type { Model3d, Model3dFile } from '@/lib/types';

export default function ModelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [model, setModel] = useState<Model3d | null>(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);

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

  const files = [...(model?.files || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const addFiles = async () => {
    if (!id) return;
    setAdding(true);
    setError('');
    try {
      const picked = await pickModelFiles(true);
      if (picked.length === 0) {
        return;
      }
      const form = new FormData();
      for (const file of picked) {
        appendLocalFile(form, 'files', file);
      }
      setModel(await api.upload<Model3d>(`/api/models/${id}/files`, form));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '파일을 올리지 못했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const removeFile = (file: Model3dFile) => {
    if (!id) return;
    Alert.alert('이 파일을 삭제할까요?', file.fileName, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.remove(`/api/models/${id}/files/${file.id}`);
            await load();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : '삭제하지 못했습니다.');
          }
        },
      },
    ]);
  };

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
              <View style={styles.header}>
                <Text style={[styles.title, { color: palette.text }]}>{model.title}</Text>
                {isAdmin ? (
                  <InlineMoreActions
                    open={menuOpen}
                    onToggle={() => setMenuOpen((open) => !open)}
                    actions={[
                      { label: '수정', onPress: () => router.push(`/model/edit/${model.id}`) },
                      {
                        label: '삭제',
                        danger: true,
                        onPress: () =>
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
                          ]),
                      },
                    ]}
                  />
                ) : null}
              </View>
              {model.format ? <Text style={[styles.meta, { color: palette.tint }]}>{model.format}</Text> : null}
              {model.description ? <Text style={[styles.body, { color: palette.text }]}>{model.description}</Text> : null}
              <Text style={[styles.body, { color: palette.muted }]}>{formatAuthorTime(model.author, model.createdAt)}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.section, { color: palette.text }]}>파일</Text>
              {files.length === 0 ? (
                model.url ? (
                  <Pressable
                    onPress={() => Linking.openURL(fileUrl(model.url))}
                    style={[styles.smallBtn, { backgroundColor: palette.tint, alignSelf: 'flex-start' }]}>
                    <Text style={styles.smallBtnText}>링크 열기</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.body, { color: palette.muted }]}>아직 올라온 파일이 없습니다.</Text>
                )
              ) : (
                files.map((file, index) => (
                  <View key={file.id} style={[styles.fileRow, { borderTopColor: palette.border }]}>
                    <View style={styles.fileInfo}>
                      <Text style={[styles.fileName, { color: palette.text }]} numberOfLines={2}>
                        {index === 0 ? '최신 · ' : ''}
                        {file.fileName}
                      </Text>
                      <Text style={[styles.fileDate, { color: palette.muted }]}>{formatDateTime(file.createdAt)}</Text>
                    </View>
                    <View style={styles.fileActions}>
                      <Pressable
                        onPress={() => Linking.openURL(fileUrl(file.url))}
                        style={[styles.smallBtn, { backgroundColor: palette.tint }]}>
                        <Text style={styles.smallBtnText}>받기</Text>
                      </Pressable>
                      {isAdmin ? (
                        <Pressable
                          onPress={() => removeFile(file)}
                          style={[styles.smallBtn, { borderColor: palette.border, borderWidth: 1 }]}>
                          <Text style={[styles.smallBtnGhost, { color: palette.muted }]}>삭제</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>

            {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
            <Pressable
              onPress={() => void addFiles()}
              disabled={adding}
              style={[styles.submit, { backgroundColor: palette.tint, opacity: adding ? 0.7 : 1 }]}>
              <Text style={styles.submitText}>{adding ? '올리는 중...' : '파일 추가'}</Text>
            </Pressable>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, overflow: 'visible', zIndex: 2 },
  title: { flex: 1, fontSize: 24, fontWeight: '700' },
  meta: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  section: { fontSize: 15, fontWeight: '800' },
  fileRow: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fileInfo: { gap: 4 },
  fileName: { fontSize: 16, fontWeight: '700' },
  fileDate: { fontSize: 13 },
  fileActions: { flexDirection: 'row', gap: 8 },
  smallBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  smallBtnGhost: { fontSize: 14, fontWeight: '700' },
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
