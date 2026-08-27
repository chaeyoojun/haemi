import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export type LocalUpload = {
  uri: string;
  name?: string;
  mimeType?: string | null;
  blob?: Blob;
};

export function appendLocalFile(form: FormData, field: string, file: LocalUpload) {
  if (Platform.OS === 'web') {
    if (!file.blob) {
      throw new Error('파일을 다시 선택해 주세요.');
    }
    form.append(field, file.blob, file.name || 'upload');
    return;
  }
  form.append(field, new File(file.uri));
}
