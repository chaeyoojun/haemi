import { File } from 'expo-file-system';

export function appendLocalFile(form: FormData, field: string, uri: string) {
  form.append(field, new File(uri));
}
