const WMS_URL = 'https://api.vworld.kr/req/wms';
const WFS_URL = 'https://api.vworld.kr/req/wfs';
const CACHE_MS = 5 * 60 * 1000;
const POINT_PAD = 0.00018;

export type AirspaceKind =
  | 'prohibited'
  | 'restricted'
  | 'ctr'
  | 'atz'
  | 'danger'
  | 'ua'
  | 'dronezone';

export type AirspaceLevel = 'no-fly' | 'permit' | 'ua' | 'clear';

export type AirspaceZone = {
  kind: AirspaceKind;
  title: string;
  ident: string;
  name: string;
  lower: string;
  upper: string;
  altitude: string;
};

export type AirspaceLookup = {
  lat: number;
  lng: number;
  level: AirspaceLevel;
  title: string;
  summary: string;
  zones: AirspaceZone[];
  source: string;
};

type LayerSpec = {
  id: string;
  kind: AirspaceKind;
  title: string;
  ident: string[];
  name: string[];
  lower: string[];
  upper: string[];
};

const LAYERS: LayerSpec[] = [
  {
    id: 'lt_c_aisprhc',
    kind: 'prohibited',
    title: '비행금지구역',
    ident: ['prh_lbl_1'],
    name: ['prh_lbl_4'],
    lower: ['prh_lbl_3'],
    upper: ['prh_lbl_2'],
  },
  {
    id: 'lt_c_aisresc',
    kind: 'restricted',
    title: '비행제한구역',
    ident: ['res_lbl_1'],
    name: [],
    lower: ['res_lbl_3'],
    upper: ['res_lbl_2'],
  },
  {
    id: 'lt_c_aisctrc',
    kind: 'ctr',
    title: '관제권',
    ident: ['ctr_lbl_1'],
    name: ['ctr_label'],
    lower: [],
    upper: [],
  },
  {
    id: 'lt_c_aisatzc',
    kind: 'atz',
    title: '비행장교통구역',
    ident: ['atm_lbl_1'],
    name: [],
    lower: ['atm_lbl_3'],
    upper: ['atm_lbl_2'],
  },
  {
    id: 'lt_c_aisdngc',
    kind: 'danger',
    title: '위험구역',
    ident: ['dng_lbl_1'],
    name: [],
    lower: ['dng_lbl_3'],
    upper: ['dng_lbl_2'],
  },
  {
    id: 'lt_c_aisuac',
    kind: 'ua',
    title: '초경량비행장치공역',
    ident: ['ident_txt', 'uac_lbl_1'],
    name: ['name_txt'],
    lower: ['uac_lbl_3'],
    upper: ['uac_lbl_2'],
  },
  {
    id: 'lt_c_aisdronezone',
    kind: 'dronezone',
    title: '드론시범사업구역',
    ident: ['name'],
    name: ['lateral'],
    lower: [],
    upper: ['vertical'],
  },
];

const WMS_LAYERS = new Set(LAYERS.map((layer) => layer.id));
const KIND_RANK: Record<AirspaceKind, number> = {
  prohibited: 0,
  restricted: 1,
  ctr: 2,
  atz: 3,
  danger: 4,
  ua: 5,
  dronezone: 6,
};

const cache = new Map<string, { at: number; value: AirspaceLookup }>();

function vworldKey() {
  return process.env.VWORLD_API_KEY?.trim() || '';
}

function vworldDomain() {
  return process.env.VWORLD_DOMAIN?.trim() || 'https://if.io.kr/haemi-api';
}

export function airspaceConfigured() {
  return Boolean(vworldKey());
}

function stripMarkup(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function readProp(props: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === 'string') {
      const text = stripMarkup(value);
      if (text) {
        return text;
      }
    }
  }
  return '';
}

function altitudeText(lower: string, upper: string) {
  if (lower && upper) {
    return `${lower} ~ ${upper}`;
  }
  return upper || lower;
}

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

type WfsCollection = {
  features?: Array<{
    id?: string;
    properties?: Record<string, unknown>;
  }>;
};

async function fetchLayer(layer: LayerSpec, lat: number, lng: number): Promise<AirspaceZone[]> {
  const bbox = `${lat - POINT_PAD},${lng - POINT_PAD},${lat + POINT_PAD},${lng + POINT_PAD}`;
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    REQUEST: 'GetFeature',
    VERSION: '1.1.0',
    TYPENAME: layer.id,
    SRSNAME: 'EPSG:4326',
    OUTPUT: 'application/json',
    MAXFEATURES: '8',
    BBOX: bbox,
    KEY: vworldKey(),
    DOMAIN: vworldDomain(),
  });
  const response = await fetch(`${WFS_URL}?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`wfs ${layer.id} ${response.status}`);
  }
  const json = (await response.json()) as WfsCollection;
  return (json.features || []).map((feature) => {
    const props = feature.properties || {};
    const ident = readProp(props, layer.ident);
    const name = readProp(props, layer.name);
    const lower = readProp(props, layer.lower);
    const upper = readProp(props, layer.upper);
    return {
      kind: layer.kind,
      title: layer.title,
      ident,
      name,
      lower,
      upper,
      altitude: altitudeText(lower, upper),
    };
  });
}

function summarize(zones: AirspaceZone[]): Pick<AirspaceLookup, 'level' | 'title' | 'summary'> {
  if (zones.some((zone) => zone.kind === 'prohibited')) {
    const zone = zones.find((item) => item.kind === 'prohibited');
    return {
      level: 'no-fly',
      title: '비행금지',
      summary: [zone?.ident, zone?.altitude].filter(Boolean).join(' · ') || '이 좌표는 비행금지구역입니다.',
    };
  }
  if (zones.some((zone) => zone.kind === 'restricted' || zone.kind === 'ctr' || zone.kind === 'atz' || zone.kind === 'danger')) {
    const zone = zones.find(
      (item) => item.kind === 'restricted' || item.kind === 'ctr' || item.kind === 'atz' || item.kind === 'danger'
    );
    return {
      level: 'permit',
      title: '승인 필요',
      summary: [zone?.title, zone?.ident, zone?.altitude].filter(Boolean).join(' · ') || '비행 전 승인이 필요한 공역입니다.',
    };
  }
  if (zones.some((zone) => zone.kind === 'ua' || zone.kind === 'dronezone')) {
    const zone = zones.find((item) => item.kind === 'ua' || item.kind === 'dronezone');
    return {
      level: 'ua',
      title: zone?.kind === 'dronezone' ? '드론시범사업구역' : '지정 공역',
      summary: [zone?.ident || zone?.name, zone?.altitude].filter(Boolean).join(' · ') || '초경량비행장치 공역입니다.',
    };
  }
  return {
    level: 'clear',
    title: '제한 없음',
    summary: '',
  };
}

export async function lookupAirspace(lat: number, lng: number): Promise<AirspaceLookup> {
  if (!airspaceConfigured()) {
    throw new Error('missing-key');
  }
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return hit.value;
  }

  const groups = await Promise.all(
    LAYERS.map((layer) => fetchLayer(layer, lat, lng).catch(() => [] as AirspaceZone[]))
  );
  const zones = groups
    .flat()
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.title.localeCompare(b.title, 'ko'));
  const status = summarize(zones);
  const value: AirspaceLookup = {
    lat,
    lng,
    ...status,
    zones,
    source: '국토교통부 브이월드',
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}

const WMS_PARAMS = new Set([
  'service',
  'version',
  'request',
  'layers',
  'styles',
  'crs',
  'srs',
  'bbox',
  'width',
  'height',
  'format',
  'transparent',
  'bgcolor',
  'exceptions',
]);

function queryValue(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '');
  }
  return typeof value === 'string' ? value : '';
}

export async function proxyWms(query: Record<string, unknown>) {
  if (!airspaceConfigured()) {
    throw new Error('missing-key');
  }
  const layers = queryValue(query.layers || query.LAYERS)
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  if (layers.length === 0 || layers.length > 4 || layers.some((name) => !WMS_LAYERS.has(name))) {
    throw new Error('bad-layers');
  }

  const params = new URLSearchParams();
  for (const [rawKey, rawValue] of Object.entries(query)) {
    const key = rawKey.toLowerCase();
    if (!WMS_PARAMS.has(key)) {
      continue;
    }
    const value = queryValue(rawValue);
    if (value) {
      params.set(key, value);
    }
  }
  params.set('service', 'WMS');
  params.set('request', params.get('request') || 'GetMap');
  params.set('version', params.get('version') || '1.3.0');
  params.set('layers', layers.join(','));
  params.set('styles', layers.join(','));
  params.set('format', 'image/png');
  params.set('transparent', 'true');
  params.set('key', vworldKey());
  params.set('domain', vworldDomain());

  const response = await fetch(`${WMS_URL}?${params}`);
  const contentType = response.headers.get('content-type') || 'image/png';
  const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`wms ${response.status}`);
  }
  return { contentType, body };
}
