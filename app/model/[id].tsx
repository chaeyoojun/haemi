import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { InlineMoreActions } from '@/components/InlineMoreActions';
import { ModelFilePreviewList, pickModelFiles, toModelFilesFormData, type PickedFile } from '@/components/ModelForm';
import { pickPreviewPhotos } from '@/components/PhotoAttach';
import { PinPrompt } from '@/components/PinPrompt';
import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { appendLocalFile } from '@/lib/formData';
import { formatAuthorTime, formatDateTime } from '@/lib/format';
import { forgetModelPin, modelPin, modelPinHeaders, unlockOrSetModelPin } from '@/lib/modelPin';
import type { Model3d, Model3dFile } from '@/lib/types';

export default function ModelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin, displayName } = useAuth();
  const [model, setModel] = useState<Model3d | null>(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PickedFile[]>([]);
  const [adding, setAdding] = useState(false);
  const [pinTitle, setPinTitle] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [pendingAction, setPendingAction] = useState<((pin: string) => void | Promise<void>) | null>(null);

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

  const withPin = (title: string, action: (pin: string) => void | Promise<void>) => {
    if (!id || !model) return;
    if (isAdmin && model.hasPin) {
      void action('');
      return;
    }
    const stored = modelPin(id);
    if (stored && model.hasPin) {
      void action(stored);
      return;
    }
    setPinTitle(model.hasPin ? title : '비밀번호 정하기');
    setPinError('');
    setPendingAction(() => action);
  };

  const addFiles = async () => {
    if (!id) return;
    const picked = await pickModelFiles(true);
    if (picked.length === 0) {
      return;
    }
    setPendingFiles(picked);
  };

  const uploadPending = () => {
    if (!id || pendingFiles.length === 0) return;
    withPin('파일 추가', async () => {
      setAdding(true);
      setError('');
      try {
        setModel(await api.upload<Model3d>(`/api/models/${id}/files`, toModelFilesFormData(pendingFiles), 'POST', modelPinHeaders(id)));
        setPendingFiles([]);
      } catch (caught) {
        forgetModelPin(id);
        setError(caught instanceof Error ? caught.message : '파일을 올리지 못했습니다.');
      } finally {
        setAdding(false);
      }
    });
  };

  const addPreviews = (file: Model3dFile) => {
    if (!id) return;
    const remaining = 2 - (file.previews?.length || 0);
    void pickPreviewPhotos(remaining).then((picked) => {
      if (picked.length === 0) {
        return;
      }
      withPin('미리보기 추가', async () => {
        try {
          const form = new FormData();
          for (const photo of picked) {
            appendLocalFile(form, 'previews', photo);
          }
          setModel(await api.upload<Model3d>(`/api/models/${id}/files/${file.id}/previews`, form, 'POST', modelPinHeaders(id)));
        } catch (caught) {
          forgetModelPin(id);
          setError(caught instanceof Error ? caught.message : '사진을 올리지 못했습니다.');
        }
      });
    });
  };

  const removePreview = (file: Model3dFile, previewId: string) => {
    if (!id) return;
    withPin('미리보기 삭제', async () => {
      try {
        await api.remove(`/api/models/${id}/files/${file.id}/previews/${previewId}`, modelPinHeaders(id));
        await load();
      } catch (caught) {
        forgetModelPin(id);
        setError(caught instanceof Error ? caught.message : '삭제하지 못했습니다.');
      }
    });
  };

  const removeFile = (file: Model3dFile) => {
    if (!id) return;
    withPin('파일 삭제', () => {
      Alert.alert('이 파일을 삭제할까요?', file.fileName, [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.remove(`/api/models/${id}/files/${file.id}`, modelPinHeaders(id));
              await load();
            } catch (caught) {
              forgetModelPin(id);
              setError(caught instanceof Error ? caught.message : '삭제하지 못했습니다.');
            }
          },
        },
      ]);
    });
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
                <InlineMoreActions
                  open={menuOpen}
                  onToggle={() => setMenuOpen((open) => !open)}
                  actions={[
                    {
                      label: '수정',
                      onPress: () =>
                        withPin('수정', () => {
                          router.push(`/model/edit/${model.id}`);
                        }),
                    },
                    {
                      label: '삭제',
                      danger: true,
                      onPress: () =>
                        withPin('삭제', () => {
                          Alert.alert('3D 파일을 삭제할까요?', model.title, [
                            { text: '취소', style: 'cancel' },
                            {
                              text: '삭제',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await api.remove(`/api/models/${model.id}`, modelPinHeaders(id || ''));
                                  router.replace('/models');
                                } catch (caught) {
                                  forgetModelPin(id || '');
                                  setError(caught instanceof Error ? caught.message : '삭제하지 못했습니다.');
                                }
                              },
                            },
                          ]);
                        }),
                    },
                  ]}
                />
              </View>
              {model.format ? <Text style={[styles.meta, { color: palette.tint }]}>{model.format}</Text> : null}
              {model.description ? <Text style={[styles.body, { color: palette.text }]}>{model.description}</Text> : null}
              <Text style={[styles.body, { color: palette.muted }]}>{formatAuthorTime(model.author, model.createdAt)}</Text>
              {!model.hasPin ? (
                <Text style={[styles.body, { color: palette.muted }]}>
                  {displayName && displayName === (model.author || '').trim()
                    ? '예전 글이라 비밀번호가 없습니다. 수정할 때 숫자 4자리를 새로 정하면 됩니다.'
                    : '예전 글이라 비밀번호가 없습니다. 작성자나 관리자가 수정할 때 숫자 4자리를 정할 수 있습니다.'}
                </Text>
              ) : null}
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
                    <View style={styles.previewRow}>
                      {(file.previews || []).map((preview) => (
                          <View key={preview.id} style={styles.previewSlot}>
                            <Pressable onPress={() => Linking.openURL(fileUrl(preview.url))}>
                              <Image source={{ uri: fileUrl(preview.url) }} style={styles.previewImage} />
                            </Pressable>
                            <Pressable
                              onPress={() => removePreview(file, preview.id)}
                              style={styles.previewRemove}
                              hitSlop={8}
                              accessibilityLabel="미리보기 삭제">
                              <Text style={styles.previewRemoveText}>×</Text>
                            </Pressable>
                          </View>
                        ))}
                        {(file.previews?.length || 0) < 2 ? (
                          <Pressable
                            onPress={() => addPreviews(file)}
                            style={[styles.previewSlot, styles.previewAdd, { borderColor: palette.border }]}
                            accessibilityLabel="미리보기 추가">
                            <Text style={[styles.previewAddText, { color: palette.tint }]}>+</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    <View style={styles.fileActions}>
                      <Pressable
                        onPress={() => Linking.openURL(fileUrl(file.url))}
                        style={[styles.smallBtn, { backgroundColor: palette.tint }]}>
                        <Text style={styles.smallBtnText}>받기</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => removeFile(file)}
                        style={[styles.smallBtn, { borderColor: palette.border, borderWidth: 1 }]}>
                        <Text style={[styles.smallBtnGhost, { color: palette.muted }]}>삭제</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
            {pendingFiles.length > 0 ? (
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.section, { color: palette.text }]}>올릴 파일</Text>
                <Text style={[styles.body, { color: palette.muted }]}>
                  파일마다 JPG, JPEG, PNG 미리보기 2장까지 첨부할 수 있습니다.
                </Text>
                <ModelFilePreviewList files={pendingFiles} onFiles={setPendingFiles} />
                <Pressable
                  onPress={uploadPending}
                  disabled={adding}
                  style={[styles.submit, { backgroundColor: palette.tint, opacity: adding ? 0.7 : 1 }]}>
                  <Text style={styles.submitText}>{adding ? '올리는 중...' : '파일 올리기'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPendingFiles([])}
                  disabled={adding}
                  style={[styles.smallBtn, { borderColor: palette.border, borderWidth: 1, alignSelf: 'center' }]}>
                  <Text style={[styles.smallBtnGhost, { color: palette.muted }]}>취소</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => void addFiles()}
                disabled={adding}
                style={[styles.submit, { backgroundColor: palette.tint, opacity: adding ? 0.7 : 1 }]}>
                <Text style={styles.submitText}>파일 추가</Text>
              </Pressable>
            )}
          </>
        )}
      </RefreshableScroll>
      <PinPrompt
        visible={pendingAction != null}
        title={pinTitle}
        message={
          model?.hasPin
            ? '등록할 때 넣은 숫자 4자리 비밀번호를 입력해 주세요.'
            : '이 글은 예전에 올려서 비밀번호가 없습니다. 앞으로 쓸 숫자 4자리를 정해 주세요.'
        }
        submitLabel={model?.hasPin ? '확인' : '정하기'}
        error={pinError}
        submitting={unlocking}
        onCancel={() => {
          setPendingAction(null);
          setPinError('');
        }}
        onSubmit={async (pin) => {
          if (!id || !pendingAction) {
            return;
          }
          setUnlocking(true);
          setPinError('');
          try {
            await unlockOrSetModelPin(id, pin, isAdmin, Boolean(model?.hasPin));
            const action = pendingAction;
            setPendingAction(null);
            if (model && !model.hasPin) {
              setModel({ ...model, hasPin: true });
            }
            await action(pin);
          } catch (caught) {
            forgetModelPin(id);
            setPinError(caught instanceof Error ? caught.message : '비밀번호가 올바르지 않습니다.');
          } finally {
            setUnlocking(false);
          }
        }}
      />
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
  previewRow: { flexDirection: 'row', gap: 8 },
  previewSlot: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F4F4F4',
  },
  previewImage: { width: '100%', height: '100%' },
  previewAdd: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  previewAddText: { fontSize: 28, lineHeight: 30, fontWeight: '300' },
  previewRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemoveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  smallBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  smallBtnGhost: { fontSize: 14, fontWeight: '700' },
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
