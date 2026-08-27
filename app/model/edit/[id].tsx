import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ModelForm, toModelFormData, type ModelFormValues, type PickedFile } from '@/components/ModelForm';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { detailHref } from '@/lib/nav';
import { FORM_MAX_WIDTH, useConstrainedStyle } from '@/lib/layout';
import type { Model3d } from '@/lib/types';

export default function EditModelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const palette = Colors[useColorScheme()];
  const [values, setValues] = useState<ModelFormValues | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formStyle = useConstrainedStyle(FORM_MAX_WIDTH);

  useEffect(() => {
    if (!id) return;
    api
      .get<Model3d>(`/api/models/${id}`)
      .then((model) =>
        setValues({
          title: model.title,
          format: model.format,
          fileName: model.fileName,
          url: model.url,
          description: model.description,
        })
      )
      .catch((caught) => setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.'));
  }, [id]);

  if (!isAdmin) {
    return <Redirect href="/models" />;
  }

  if (!values) {
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
      const model = await api.upload<Model3d>(`/api/models/${id}`, toModelFormData(values, file), 'PATCH');
      router.replace(detailHref('/model', model.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, formStyle]} keyboardShouldPersistTaps="handled">
        <ModelForm
          values={values}
          onChange={setValues}
          pickedName={file?.name || ''}
          onPicked={setFile}
          error={error}
          saving={saving}
          submitLabel="수정"
          onSubmit={onSubmit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, padding: 20, justifyContent: 'center' },
});
