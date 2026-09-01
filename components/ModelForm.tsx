import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Input } from '@/components/Form';
import { PhotoAttach, type PickedPhoto } from '@/components/PhotoAttach';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { appendLocalFile } from '@/lib/formData';

export type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  blob?: Blob;
  previews: PickedPhoto[];
};

export type ModelFormValues = {
  title: string;
  format: string;
  fileName: string;
  url: string;
  description: string;
  pin?: string;
};

export function fileStem(name: string) {
  return name.replace(/\.[^.]+$/, '').trim() || name;
}

export function fileExt(name: string) {
  return name.includes('.') ? name.split('.').pop()?.toUpperCase() || '' : '';
}

export async function pickModelFiles(multiple: boolean) {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    base64: false,
    multiple,
  });
  if (result.canceled || !result.assets?.length) {
    return [] as PickedFile[];
  }
  const next = result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType,
    blob: asset.file,
    previews: [] as PickedPhoto[],
  }));
  return multiple ? next : next.slice(0, 1);
}

export function ModelFilePreviewList({
  files,
  onFiles,
}: {
  files: PickedFile[];
  onFiles: (files: PickedFile[]) => void;
}) {
  const palette = Colors[useColorScheme()];
  if (files.length === 0) {
    return null;
  }
  return (
    <View style={styles.fileList}>
      {files.map((file, index) => (
        <View key={`${file.uri}-${file.name}-${index}`} style={styles.fileBlock}>
          <Text style={[styles.fileName, { color: palette.text }]} numberOfLines={1}>
            {file.name}
          </Text>
          <PhotoAttach
            photos={file.previews}
            maxPhotos={2}
            label="미리보기"
            formats={['jpg', 'jpeg', 'png']}
            onChange={(previews) => {
              const next = files.slice();
              next[index] = { ...file, previews };
              onFiles(next);
            }}
          />
        </View>
      ))}
    </View>
  );
}

export function ModelForm({
  values,
  onChange,
  files,
  onFiles,
  allowMultiple = false,
  requirePin = false,
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
  requirePin?: boolean;
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
      const next = await pickModelFiles(allowMultiple);
      if (next.length === 0) {
        return;
      }
      onFiles(next);
      const first = next[0];
      onChange({
        ...values,
        fileName: values.fileName || first.name,
        format: values.format || fileExt(first.name),
        title: values.title || fileStem(first.name),
      });
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
      <Field label="이름">
        <Input value={values.title} onChangeText={(value) => set('title', value)} placeholder="고글 안테나 마운트" />
      </Field>
      <Field label="형식">
        <Input value={values.format} onChangeText={(value) => set('format', value)} placeholder="STL, OBJ, 3MF, STEP, GLB" />
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
      <Field label="파일 등록">
        <Pressable
          onPress={pickFile}
          disabled={picking}
          style={[styles.pickButton, { borderColor: palette.tint }]}>
          <Text style={[styles.pickText, { color: palette.tint }]}>{pickLabel}</Text>
        </Pressable>
        {allowMultiple ? (
          <Text style={[styles.hint, { color: palette.muted }]}>
            여러 개를 고르면 이 항목에 함께 저장됩니다. 파일마다 JPG, JPEG, PNG 미리보기 2장까지 첨부할 수 있습니다.
          </Text>
        ) : (
          <Text style={[styles.hint, { color: palette.muted }]}>
            파일마다 JPG, JPEG, PNG 미리보기 2장까지 첨부할 수 있습니다.
          </Text>
        )}
        <ModelFilePreviewList files={files} onFiles={onFiles} />
      </Field>
      <Field label="설명">
        <Input
          value={values.description}
          onChangeText={(value) => set('description', value)}
          placeholder="출력 설정, 용도, 주의사항"
          multiline
        />
      </Field>
      {requirePin ? (
        <Field label="비밀번호">
          <Input
            value={values.pin || ''}
            onChangeText={(value) => set('pin', value.replace(/\D/g, '').slice(0, 4))}
            placeholder="숫자 4자리"
            secureTextEntry
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={4}
          />
          <Text style={[styles.hint, { color: palette.muted }]}>나중에 수정하거나 삭제할 때 필요합니다.</Text>
        </Field>
      ) : null}
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

export function toModelFilesFormData(files: PickedFile[]) {
  const form = new FormData();
  form.append('previewCounts', files.map((file) => String(file.previews.length)).join(','));
  for (const file of files) {
    appendLocalFile(form, 'files', file);
  }
  for (const file of files) {
    for (const photo of file.previews) {
      appendLocalFile(form, 'previews', photo);
    }
  }
  return form;
}

export function toModelFormData(values: ModelFormValues, files: PickedFile[]) {
  const form = toModelFilesFormData(files);
  form.append('title', values.title);
  form.append('format', values.format);
  form.append('fileName', values.fileName);
  form.append('url', values.url);
  form.append('description', values.description);
  if (values.pin) {
    form.append('pin', values.pin);
  }
  return form;
}

const styles = StyleSheet.create({
  form: { gap: 16, width: '100%' },
  hint: { fontSize: 13, lineHeight: 18 },
  fileName: { fontSize: 14, fontWeight: '700' },
  fileList: { gap: 12 },
  fileBlock: { gap: 8 },
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
