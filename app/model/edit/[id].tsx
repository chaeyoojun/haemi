import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FormScroll } from '@/components/FormScroll';
import { ModelForm, toModelFormData, type ModelFormValues, type PickedFile } from '@/components/ModelForm';
import { PinPrompt } from '@/components/PinPrompt';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { forgetModelPin, modelPin, modelPinHeaders, unlockOrSetModelPin } from '@/lib/modelPin';
import { detailHref } from '@/lib/nav';
import type { Model3d } from '@/lib/types';

export default function EditModelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const palette = Colors[useColorScheme()];
  const [values, setValues] = useState<ModelFormValues | null>(null);
  const [hasPin, setHasPin] = useState(true);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<Model3d>(`/api/models/${id}`)
      .then((model) => {
        setValues({
          title: model.title,
          format: model.format,
          fileName: model.fileName,
          url: model.url,
          description: model.description,
        });
        const pinned = Boolean(model.hasPin);
        setHasPin(pinned);
        setUnlocked(Boolean((isAdmin || modelPin(id)) && pinned));
        setReady(true);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.');
        setReady(true);
      });
  }, [id, isAdmin]);

  if (!id) {
    return null;
  }

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.tint} />
      </View>
    );
  }

  if (error && !values) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.danger }}>{error}</Text>
      </View>
    );
  }

  if (!unlocked) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <PinPrompt
          visible
          title={hasPin ? '수정 비밀번호' : '비밀번호 정하기'}
          message={
            hasPin
              ? '등록할 때 넣은 숫자 4자리 비밀번호를 입력해 주세요.'
              : '이 글은 예전에 올려서 비밀번호가 없습니다. 앞으로 쓸 숫자 4자리를 정해 주세요.'
          }
          submitLabel={hasPin ? '확인' : '정하기'}
          error={pinError}
          submitting={unlocking}
          onCancel={() => router.back()}
          onSubmit={async (pin) => {
            setUnlocking(true);
            setPinError('');
            try {
              await unlockOrSetModelPin(id, pin, isAdmin, hasPin);
              setHasPin(true);
              setUnlocked(true);
            } catch (caught) {
              forgetModelPin(id);
              setPinError(caught instanceof Error ? caught.message : '비밀번호가 올바르지 않습니다.');
            } finally {
              setUnlocking(false);
            }
          }}
        />
      </View>
    );
  }

  if (!values) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        {error ? <Text style={{ color: palette.danger }}>{error}</Text> : <ActivityIndicator color={palette.tint} />}
      </View>
    );
  }

  const onSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const model = await api.upload<Model3d>(
        `/api/models/${id}`,
        toModelFormData(values, file ? [file] : []),
        'PATCH',
        modelPinHeaders(id)
      );
      router.replace(detailHref('/model', model.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <FormScroll>
      <ModelForm
        values={values}
        onChange={setValues}
        files={file ? [file] : []}
        onFiles={(next) => setFile(next[0] ?? null)}
        error={error}
        saving={saving}
        submitLabel="수정"
        onSubmit={onSubmit}
      />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 20, justifyContent: 'center' },
});
