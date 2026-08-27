import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Field, Input } from '@/components/Form';
import { FormScroll } from '@/components/FormScroll';
import { PlaceSearch } from '@/components/PlaceSearch';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { detailHref } from '@/lib/nav';
import type { Spot } from '@/lib/types';

export default function NewSpotScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const palette = Colors[useColorScheme()];
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const spot = await api.create<Spot>('/api/spots', { title, place, description });
      router.replace(detailHref('/spot', spot.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  }, [description, place, router, title]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            void onSubmit();
          }}
          disabled={saving}
          hitSlop={8}
          style={[styles.headerAction, { opacity: saving ? 0.5 : 1 }]}>
          <Text style={[styles.headerActionText, { color: palette.tint }]}>{saving ? '저장 중' : '등록'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, onSubmit, palette.tint, saving]);

  return (
    <FormScroll>
      <Field label="스팟 이름">
        <Input value={title} onChangeText={setTitle} placeholder="스팟 명칭" />
      </Field>
      <PlaceSearch value={place} onChange={setPlace} />
      <Field label="메모">
        <Input value={description} onChangeText={setDescription} placeholder="" multiline minHeight={68} />
      </Field>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  headerAction: { paddingHorizontal: 8, paddingVertical: 6 },
  headerActionText: { fontSize: 17, fontWeight: '700' },
});
