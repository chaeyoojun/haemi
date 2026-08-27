import { Redirect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Input } from '@/components/Form';
import { FormScroll } from '@/components/FormScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { detailHref } from '@/lib/nav';
import type { Notice } from '@/lib/types';

export default function EditNoticeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { isAdmin } = useAuth();
  const palette = Colors[useColorScheme()];
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get<Notice>(`/api/notices/${id}`)
      .then((notice) => {
        setTitle(notice.title);
        setBody(notice.body);
        setReady(true);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.'));
  }, [id]);

  const onSubmit = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const notice = await api.patch<Notice>(`/api/notices/${id}`, { title, body });
      router.replace(detailHref('/notice', notice.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  }, [body, id, router, title]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            void onSubmit();
          }}
          disabled={saving || !ready}
          hitSlop={8}
          style={[styles.headerAction, { opacity: saving || !ready ? 0.5 : 1 }]}>
          <Text style={[styles.headerActionText, { color: palette.tint }]}>{saving ? '저장 중' : '수정'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, onSubmit, palette.tint, ready, saving]);

  if (!isAdmin) {
    return <Redirect href="/" />;
  }

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : <ActivityIndicator color={palette.tint} />}
      </View>
    );
  }

  return (
    <FormScroll>
      <Field label="제목">
        <Input value={title} onChangeText={setTitle} placeholder="이번 주 모임 시간 변경" />
      </Field>
      <Field label="내용">
        <Input value={body} onChangeText={setBody} placeholder="공지 내용을 적어 주세요" multiline />
      </Field>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 20, justifyContent: 'center' },
  headerAction: { paddingHorizontal: 8, paddingVertical: 6 },
  headerActionText: { fontSize: 17, fontWeight: '700' },
});
