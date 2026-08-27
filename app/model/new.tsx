import { useRouter } from 'expo-router';
import { useState } from 'react';

import { FormScroll } from '@/components/FormScroll';
import {
  toModelFormData,
  valuesForPickedFile,
  type ModelFormValues,
  type PickedFile,
  ModelForm,
} from '@/components/ModelForm';
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
  const [values, setValues] = useState<ModelFormValues>(empty);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      if (files.length > 1) {
        for (const file of files) {
          await api.upload<Model3d>('/api/models', toModelFormData(valuesForPickedFile(file, values.description), file));
        }
        router.replace('/models');
        return;
      }
      const model = await api.upload<Model3d>('/api/models', toModelFormData(values, files[0] ?? null));
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
        files={files}
        onFiles={setFiles}
        allowMultiple
        error={error}
        saving={saving}
        submitLabel={files.length > 1 ? `${files.length}개 등록` : '등록'}
        onSubmit={onSubmit}
      />
    </FormScroll>
  );
}
