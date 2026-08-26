import { Redirect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateTimeField } from '@/components/DateTimeField';
import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { detailHref } from '@/lib/nav';
import type { Vote } from '@/lib/types';

export default function EditVoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { isAdmin } = useAuth();
  const palette = Colors[useColorScheme()];
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date());
  const [endsAt, setEndsAt] = useState(() => new Date());
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get<Vote>(`/api/votes/${id}`)
      .then((vote) => {
        setTitle(vote.title);
        setBody(vote.body);
        setOptionA(vote.options[0]?.label || '');
        setOptionB(vote.options[1]?.label || '');
        setOptionC(vote.options[2]?.label || '');
        setStartsAt(new Date(vote.startsAt));
        setEndsAt(new Date(vote.endsAt));
        setReady(true);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.'));
  }, [id]);

  const onSubmit = useCallback(async () => {
    if (!id) return;
    if (endsAt.getTime() <= startsAt.getTime()) {
      setError('마감은 시작 이후여야 합니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const vote = await api.patch<Vote>(`/api/votes/${id}`, {
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
  }, [body, endsAt, id, optionA, optionB, optionC, router, startsAt, title]);

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
    return <Redirect href="/votes" />;
  }

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : <ActivityIndicator color={palette.tint} />}
      </View>
    );
  }

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, padding: 20, justifyContent: 'center' },
  headerAction: { paddingHorizontal: 8, paddingVertical: 6 },
  headerActionText: { fontSize: 17, fontWeight: '700' },
});
