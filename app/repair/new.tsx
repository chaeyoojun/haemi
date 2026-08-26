import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { detailHref } from '@/lib/nav';
import type { Repair } from '@/lib/types';

export default function NewRepairScreen() {
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const repair = await api.create<Repair>('/api/repairs', { title, place, description });
      router.replace(detailHref('/repair', repair.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="제목">
          <Input value={title} onChangeText={setTitle} placeholder="제품명" />
        </Field>
        <Field label="의뢰인">
          <Input value={place} onChangeText={setPlace} placeholder="이름" />
        </Field>
        <Field label="내용">
          <Input value={description} onChangeText={setDescription} placeholder="증상" multiline />
        </Field>
        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
        <Pressable onPress={onSubmit} disabled={saving} style={[styles.submit, { backgroundColor: palette.tint, opacity: saving ? 0.7 : 1 }]}>
          <Text style={styles.submitText}>{saving ? '저장 중...' : '요청하기'}</Text>
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
