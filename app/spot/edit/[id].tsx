import { Redirect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Field, Input } from '@/components/Form';
import { PlaceSearch } from '@/components/PlaceSearch';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { stripMapShareUrls } from '@/lib/maps';
import { detailHref } from '@/lib/nav';
import { FORM_MAX_WIDTH, useConstrainedStyle } from '@/lib/layout';
import type { Spot } from '@/lib/types';

export default function EditSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { isAdmin } = useAuth();
  const palette = Colors[useColorScheme()];
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formStyle = useConstrainedStyle(FORM_MAX_WIDTH);

  useEffect(() => {
    if (!id) return;
    api
      .get<Spot>(`/api/spots/${id}`)
      .then((spot) => {
        setTitle(spot.title);
        setPlace(spot.place);
        setDescription(stripMapShareUrls(spot.description));
        setReady(true);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.'));
  }, [id]);

  const onSubmit = useCallback(async () => {
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
  }, [description, id, place, router, title]);

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
    return <Redirect href="/spots" />;
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
      <ScrollView contentContainerStyle={[styles.content, formStyle]} keyboardShouldPersistTaps="handled">
        <Field label="스팟 이름">
          <Input value={title} onChangeText={setTitle} placeholder="스팟 명칭" />
        </Field>
        <PlaceSearch value={place} onChange={setPlace} />
        <Field label="메모">
          <Input value={description} onChangeText={setDescription} placeholder="" multiline minHeight={68} />
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
