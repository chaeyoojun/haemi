import { useRouter } from 'expo-router';
import { useState } from 'react';

import { FormScroll } from '@/components/FormScroll';
import { ModelForm, toModelFormData, type ModelFormValues, type PickedFile } from '@/components/ModelForm';
import { api } from '@/lib/api';
import { isModelPin, rememberModelPin } from '@/lib/modelPin';
import { detailHref } from '@/lib/nav';
import type { Model3d } from '@/lib/types';

const empty: ModelFormValues = {
  title: '',
  format: '',
  fileName: '',
  url: '',
  description: '',
  pin: '',
};

export default function NewModelScreen() {
  const router = useRouter();
  const [values, setValues] = useState<ModelFormValues>(empty);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    if (!isModelPin(values.pin || '')) {
      setError('숫자 4자리 비밀번호를 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const model = await api.upload<Model3d>('/api/models', toModelFormData(values, files));
      rememberModelPin(model.id, values.pin || '');
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
        requirePin
        error={error}
        saving={saving}
        submitLabel="등록"
        onSubmit={onSubmit}
      />
    </FormScroll>
  );
}
