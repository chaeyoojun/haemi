import { useRouter } from 'expo-router';

import { ItemCard, ResourceList } from '@/components/ResourceList';
import { detailHref } from '@/lib/nav';
import type { Spot } from '@/lib/types';
import { useApiList } from '@/lib/useApiList';

export default function SpotsScreen() {
  const router = useRouter();
  const { items, ready, error, reload } = useApiList<Spot>('/api/spots');

  return (
    <ResourceList
      ready={ready}
      error={error}
      empty={items.length === 0}
      emptyTitle="아직 스팟이 없어요"
      emptyHint="모임이 열리는 장소나 자주 가는 곳을 등록해 보세요."
      createHref="/spot/new"
      createLabel="스팟 등록"
      onRetry={reload}>
      {items.map((spot) => (
        <ItemCard
          key={spot.id}
          title={spot.title}
          layout="row"
          onPress={() => router.push(detailHref('/spot', spot.id))}
        />
      ))}
    </ResourceList>
  );
}
