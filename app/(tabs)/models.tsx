import { useRouter } from 'expo-router';

import { ItemCard, ResourceList } from '@/components/ResourceList';
import { detailHref } from '@/lib/nav';
import type { Model3d } from '@/lib/types';
import { useApiList } from '@/lib/useApiList';

export default function ModelsScreen() {
  const router = useRouter();
  const { items, ready, error, reload } = useApiList<Model3d>('/api/models');

  return (
    <ResourceList
      ready={ready}
      error={error}
      empty={items.length === 0}
      emptyTitle="3D 파일이 없습니다"
      emptyHint="프레임, 안테나, 고글 마운트 같은 STL·OBJ 파일을 올려 공유하세요."
      createHref="/model/new"
      createLabel="3D 파일 등록"
      table
      onRetry={reload}>
      {items.map((model) => (
        <ItemCard
          key={model.id}
          title={model.title}
          layout="table"
          onPress={() => router.push(detailHref('/model', model.id))}
        />
      ))}
    </ResourceList>
  );
}
