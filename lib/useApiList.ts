import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api } from '@/lib/api';

export function useApiList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      setItems(await api.list<T>(path));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.');
    } finally {
      setReady(true);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { items, ready, error, reload, setItems };
}
