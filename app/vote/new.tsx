import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FormScroll } from '@/components/FormScroll';
import { cleanVoteOptions, VoteFormFields } from '@/components/VoteForm';
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
  const [options, setOptions] = useState(['', '', '']);
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [startsAt, setStartsAt] = useState(() => new Date());
  const [endsAt, setEndsAt] = useState(() => plusDays(7));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    const labels = cleanVoteOptions(options);
    if (labels.length < 2) {
      setError('선택지는 2개 이상 넣어 주세요.');
      return;
    }
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
        options: labels,
        allowMultiple,
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
    <FormScroll>
      <VoteFormFields
        title={title}
        body={body}
        options={options}
        allowMultiple={allowMultiple}
        startsAt={startsAt}
        endsAt={endsAt}
        onTitle={setTitle}
        onBody={setBody}
        onOptions={setOptions}
        onAllowMultiple={setAllowMultiple}
        onStartsAt={setStartsAt}
        onEndsAt={setEndsAt}
      />
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <Pressable onPress={onSubmit} disabled={saving} style={[styles.submit, { backgroundColor: palette.tint, opacity: saving ? 0.7 : 1 }]}>
        <Text style={styles.submitText}>{saving ? '저장 중...' : '투표 만들기'}</Text>
      </Pressable>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
