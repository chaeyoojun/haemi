import type { Href } from 'expo-router';

export function detailHref(
  base: '/spot' | '/repair' | '/notice' | '/vote' | '/model',
  id: string
): Href {
  return `${base}/${id}` as Href;
}
