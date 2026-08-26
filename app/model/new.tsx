import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { ModelForm, toModelFormData, type ModelFormValues, type PickedFile } from '@/components/ModelForm';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { detailHref } from '@/lib/nav';
import type { Model3d } from '@/lib/types';

const empty: ModelFormValues = {
  title: '',
  format: '',
  fileName: '',
  url: '',
  description: '',
};

export default function NewModelScreen() {
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const [values, setValues] = useState<ModelFormValues>(empty);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const model = await api.upload<Model3d>('/api/models', toModelFormData(values, file));
      router.replace(detailHref('/model', model.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ModelForm
          values={values}
          onChange={setValues}
          pickedName={file?.name || ''}
          onPicked={setFile}
          error={error}
          saving={saving}
          submitLabel="등록"
          onSubmit={onSubmit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
});
