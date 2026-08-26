import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Field, Input } from '@/components/Form';
import { PlaceSearch } from '@/components/PlaceSearch';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { detailHref } from '@/lib/nav';
import type { Spot } from '@/lib/types';

export default function EditSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const palette = Colors[useColorScheme()];
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get<Spot>(`/api/spots/${id}`)
      .then((spot) => {
        setTitle(spot.title);
        setPlace(spot.place);
        setDescription(spot.description);
        setReady(true);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.'));
  }, [id]);

  if (!isAdmin) {
    return <Redirect href="/spots" />;
  }

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : <ActivityIndicator color={palette.tint} />}
      </View>
    );
  }

  const onSubmit = async () => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const spot = await api.patch<Spot>(`/api/spots/${id}`, { title, place, description });
      router.replace(detailHref('/spot', spot.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="스팟 이름">
          <Input value={title} onChangeText={setTitle} placeholder="스팟 명칭" />
        </Field>
        <PlaceSearch
          value={place}
          onChange={setPlace}
          onPickedName={(name) => {
            if (!title.trim()) {
              setTitle(name);
            }
          }}
        />
        <Field label="메모">
          <Input value={description} onChangeText={setDescription} placeholder="" multiline />
        </Field>
        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
        <Pressable onPress={onSubmit} disabled={saving} style={[styles.submit, { backgroundColor: palette.tint, opacity: saving ? 0.7 : 1 }]}>
          <Text style={styles.submitText}>{saving ? '저장 중...' : '수정'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, padding: 20, justifyContent: 'center' },
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
