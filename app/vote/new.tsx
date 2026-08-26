import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { DateTimeField } from '@/components/DateTimeField';
import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { detailHref } from '@/lib/nav';
import type { Vote } from '@/lib/types';

function plusDays(days: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next;
}

export default function NewVoteScreen() {
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date());
  const [endsAt, setEndsAt] = useState(() => plusDays(7));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    if (endsAt.getTime() <= startsAt.getTime()) {
      setError('마감은 시작 이후여야 합니다.');
      return;
    }
    if (endsAt.getTime() <= Date.now()) {
      setError('마감은 현재 이후여야 합니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const vote = await api.create<Vote>('/api/votes', {
        title,
        body,
        options: [optionA, optionB, optionC],
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
      router.replace(detailHref('/vote', vote.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="투표 제목">
          <Input value={title} onChangeText={setTitle} placeholder="다음 모임 장소" />
        </Field>
        <Field label="설명">
          <Input value={body} onChangeText={setBody} placeholder="선택 기준이나 마감 안내" multiline />
        </Field>
        <DateTimeField label="시작" value={startsAt} onChange={setStartsAt} />
        <DateTimeField label="마감" value={endsAt} onChange={setEndsAt} minimumDate={startsAt} />
        <Field label="선택지 1">
          <Input value={optionA} onChangeText={setOptionA} placeholder="필수" />
        </Field>
        <Field label="선택지 2">
          <Input value={optionB} onChangeText={setOptionB} placeholder="필수" />
        </Field>
        <Field label="선택지 3">
          <Input value={optionC} onChangeText={setOptionC} placeholder="선택" />
        </Field>
        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
        <Pressable onPress={onSubmit} disabled={saving} style={[styles.submit, { backgroundColor: palette.tint, opacity: saving ? 0.7 : 1 }]}>
          <Text style={styles.submitText}>{saving ? '저장 중...' : '투표 만들기'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
