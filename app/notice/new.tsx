import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Field, Input } from '@/components/Form';
import { FormScroll } from '@/components/FormScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { detailHref } from '@/lib/nav';
import type { Notice } from '@/lib/types';

export default function NewNoticeScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const palette = Colors[useColorScheme()];
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isAdmin) {
    return <Redirect href="/" />;
  }

  const onSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const notice = await api.create<Notice>('/api/notices', { title, body });
      router.replace(detailHref('/notice', notice.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <FormScroll>
      <Field label="제목">
        <Input value={title} onChangeText={setTitle} placeholder="이번 주 모임 시간 변경" />
      </Field>
      <Field label="내용">
        <Input value={body} onChangeText={setBody} placeholder="공지 내용을 적어 주세요" multiline />
      </Field>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <Pressable onPress={onSubmit} disabled={saving} style={[styles.submit, { backgroundColor: palette.tint, opacity: saving ? 0.7 : 1 }]}>
        <Text style={styles.submitText}>{saving ? '저장 중...' : '게시'}</Text>
      </Pressable>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
