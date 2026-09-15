import type { Model3d } from '@/lib/types';
import { fileUrl } from '@/lib/api';

export const MODEL_CATEGORIES = ['프레임', '안테나', '범퍼', '데크', '마운트', '커버', '암', '기타'] as const;

export const UNGROUPED_AIRFRAME = '기타';

export function modelAirframe(model: Pick<Model3d, 'airframe'>) {
  return (model.airframe || '').trim() || UNGROUPED_AIRFRAME;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function modelSearchText(model: Model3d) {
  return [
    model.title,
    model.airframe,
    model.category,
    model.fileName,
    model.description,
    model.format,
    ...(model.files || []).map((file) => file.fileName),
  ]
    .filter(Boolean)
    .join('\n');
}

export function matchesModelQuery(model: Model3d, query: string, category: string) {
  if (category && (model.category || '').trim() !== category) {
    return false;
  }
  const needle = normalize(query);
  if (!needle) {
    return true;
  }
  return normalize(modelSearchText(model)).includes(needle);
}

export function matchingFileNames(model: Model3d, query: string) {
  const needle = normalize(query);
  if (!needle) {
    return [] as string[];
  }
  const names = [model.fileName, ...(model.files || []).map((file) => file.fileName)].filter(Boolean);
  return [...new Set(names.filter((name) => normalize(name).includes(needle)))];
}

export function modelCoverUrl(model: Model3d) {
  if (model.cover?.url) {
    return fileUrl(model.cover.url);
  }
  const extra = (model.photos || [])[0];
  if (extra?.url) {
    return fileUrl(extra.url);
  }
  const preview = (model.files || []).flatMap((file) => file.previews || [])[0];
  return preview?.url ? fileUrl(preview.url) : '';
}

export function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => (value || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ko')
  );
}

export function groupModelsByAirframe(models: Model3d[]) {
  const groups = new Map<string, Model3d[]>();
  for (const model of models) {
    const key = modelAirframe(model);
    const list = groups.get(key) || [];
    list.push(model);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === UNGROUPED_AIRFRAME) {
        return 1;
      }
      if (b === UNGROUPED_AIRFRAME) {
        return -1;
      }
      return a.localeCompare(b, 'ko');
    })
    .map(([airframe, items]) => ({ airframe, items }));
}
