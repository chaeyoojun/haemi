import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { appendLocalFile } from '@/lib/formData';

export type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  blob?: Blob;
};

export type ModelFormValues = {
  title: string;
  format: string;
  fileName: string;
  url: string;
  description: string;
};

export function fileStem(name: string) {
  return name.replace(/\.[^.]+$/, '').trim() || name;
}

export function fileExt(name: string) {
  return name.includes('.') ? name.split('.').pop()?.toUpperCase() || '' : '';
}

export function ModelForm({
  values,
  onChange,
  files,
  onFiles,
  allowMultiple = false,
  error,
  saving,
  submitLabel,
  onSubmit,
}: {
  values: ModelFormValues;
  onChange: (next: ModelFormValues) => void;
  files: PickedFile[];
  onFiles: (files: PickedFile[]) => void;
  allowMultiple?: boolean;
  error: string;
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const palette = Colors[useColorScheme()];
  const [picking, setPicking] = useState(false);
  const many = allowMultiple && files.length > 1;

  const set = (key: keyof ModelFormValues, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const pickFile = async () => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        base64: false,
        multiple: allowMultiple,
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }
      const next = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        blob: asset.file,
      }));
      onFiles(allowMultiple ? next : next.slice(0, 1));
      const first = next[0];
      if (!allowMultiple || next.length === 1) {
        onChange({
          ...values,
          fileName: values.fileName || first.name,
          format: values.format || fileExt(first.name),
          title: values.title || fileStem(first.name),
        });
      }
    } finally {
      setPicking(false);
    }
  };

  const pickLabel = picking
    ? '선택 중...'
    : files.length === 0
      ? allowMultiple
        ? '파일 선택 (여러 개 가능)'
        : '파일 선택'
      : files.length === 1
        ? `선택됨: ${files[0].name}`
        : `${files.length}개 선택됨`;

  return (
    <View style={styles.form}>
      {many ? (
        <Text style={[styles.hint, { color: palette.muted }]}>
          고른 파일마다 파일 이름으로 목록에 등록됩니다.
        </Text>
      ) : (
        <>
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
            <Input
              value={values.url}
              onChangeText={(value) => set('url', value)}
              placeholder="https://..."
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
        </>
      )}
      <Field label="파일 등록">
        <Pressable
          onPress={pickFile}
          disabled={picking}
          style={[styles.pickButton, { borderColor: palette.tint }]}>
          <Text style={[styles.pickText, { color: palette.tint }]}>{pickLabel}</Text>
        </Pressable>
        {files.length > 1
          ? files.map((file) => (
              <Text key={`${file.uri}-${file.name}`} style={[styles.fileName, { color: palette.muted }]} numberOfLines={1}>
                {file.name}
              </Text>
            ))
          : null}
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

export function toModelFormData(values: ModelFormValues, file: PickedFile | null) {
  const form = new FormData();
  form.append('title', values.title);
  form.append('format', values.format);
  form.append('fileName', values.fileName);
  form.append('url', values.url);
  form.append('description', values.description);
  if (file) {
    appendLocalFile(form, 'file', file);
  }
  return form;
}

export function valuesForPickedFile(file: PickedFile, description: string): ModelFormValues {
  return {
    title: fileStem(file.name),
    format: fileExt(file.name),
    fileName: file.name,
    url: '',
    description,
  };
}

const styles = StyleSheet.create({
  form: { gap: 16, width: '100%' },
  hint: { fontSize: 14, lineHeight: 20 },
  fileName: { fontSize: 13 },
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
