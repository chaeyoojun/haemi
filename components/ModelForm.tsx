import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export type ModelFormValues = {
  title: string;
  format: string;
  fileName: string;
  url: string;
  description: string;
};

export function ModelForm({
  values,
  onChange,
  pickedName,
  onPicked,
  error,
  saving,
  submitLabel,
  onSubmit,
}: {
  values: ModelFormValues;
  onChange: (next: ModelFormValues) => void;
  pickedName: string;
  onPicked: (file: PickedFile | null) => void;
  error: string;
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const palette = Colors[useColorScheme()];
  const [picking, setPicking] = useState(false);

  const set = (key: keyof ModelFormValues, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const pickFile = async () => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const asset = result.assets[0];
      const ext = asset.name.includes('.') ? asset.name.split('.').pop()?.toUpperCase() || '' : '';
      onPicked({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
      onChange({
        ...values,
        fileName: asset.name,
        format: values.format || ext,
      });
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={styles.form}>
      <Field label="이름">
        <Input value={values.title} onChangeText={(value) => set('title', value)} placeholder="고글 안테나 마운트" />
      </Field>
      <Field label="형식">
        <Input value={values.format} onChangeText={(value) => set('format', value)} placeholder="STL, OBJ, 3MF, STEP, GLB" />
      </Field>
      <Field label="파일 이름">
        <Input value={values.fileName} onChangeText={(value) => set('fileName', value)} placeholder="antenna-mount-v2.stl" />
      </Field>
      <Field label="파일 주소">
        <Input value={values.url} onChangeText={(value) => set('url', value)} placeholder="https://..." autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label="파일 등록">
        <Pressable
          onPress={pickFile}
          disabled={picking}
          style={[styles.pickButton, { borderColor: palette.tint }]}>
          <Text style={[styles.pickText, { color: palette.tint }]}>
            {picking ? '선택 중...' : pickedName ? `선택됨: ${pickedName}` : '파일 선택'}
          </Text>
        </Pressable>
      </Field>
      <Field label="설명">
        <Input
          value={values.description}
          onChangeText={(value) => set('description', value)}
          placeholder="출력 설정, 용도, 주의사항"
          multiline
        />
      </Field>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <Pressable
        onPress={onSubmit}
        disabled={saving}
        style={[styles.submit, { backgroundColor: palette.tint, opacity: saving ? 0.7 : 1 }]}>
        <Text style={styles.submitText}>{saving ? '저장 중...' : submitLabel}</Text>
      </Pressable>
    </View>
  );
}

function appendModelFile(form: FormData, values: ModelFormValues, file: PickedFile | null) {
  form.append('title', values.title);
  form.append('format', values.format);
  form.append('fileName', values.fileName);
  form.append('url', values.url);
  form.append('description', values.description);
  if (file) {
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  }
}

export function toModelFormData(values: ModelFormValues, file: PickedFile | null) {
  const form = new FormData();
  appendModelFile(form, values, file);
  return form;
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  pickButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  pickText: { fontSize: 15, fontWeight: '700' },
  submit: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
