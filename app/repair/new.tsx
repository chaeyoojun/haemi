import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Field, Input } from '@/components/Form';
import { FormScroll } from '@/components/FormScroll';
import { PhotoAttach, toRepairFormData, type PickedPhoto } from '@/components/PhotoAttach';
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
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const repair =
        photos.length > 0
          ? await api.upload<Repair>('/api/repairs', toRepairFormData({ title, place, description, photos }))
          : await api.create<Repair>('/api/repairs', { title, place, description });
      router.replace(detailHref('/repair', repair.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <FormScroll>
      <Field label="제목">
        <Input value={title} onChangeText={setTitle} placeholder="제품명" />
      </Field>
      <Field label="의뢰인">
        <Input value={place} onChangeText={setPlace} placeholder="이름" />
      </Field>
      <PhotoAttach photos={photos} onChange={setPhotos} />
      <Field label="내용">
        <Input value={description} onChangeText={setDescription} placeholder="증상" multiline />
      </Field>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <Pressable onPress={onSubmit} disabled={saving} style={[styles.submit, { backgroundColor: palette.tint, opacity: saving ? 0.7 : 1 }]}>
        <Text style={styles.submitText}>{saving ? '저장 중...' : '요청하기'}</Text>
      </Pressable>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
