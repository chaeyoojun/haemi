import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { airspaceConfigured, lookupAirspace, proxyWms } from './airspace.js';
import { prisma } from './db.js';
import { formatFromName, keepUpload, removeUploadsFor, storedPath, copyUpload, upload } from './uploads.js';

const app = express();
const port = Number(process.env.PORT || 4400);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAP_SHARE_URL =
  /https?:\/\/(?:(?:www\.)?(?:tmap\.life|tmap\.co\.kr)|(?:m\.)?map\.kakao\.com|kko\.to|kko\.kakao\.com|naver\.me|map\.naver\.com|nmap\.naver\.com|maps\.app\.goo\.gl|maps\.google\.com|goo\.gl\/maps)[^\s]*/gi;

function stripMapShareUrls(text: string) {
  return text
    .replace(MAP_SHARE_URL, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function spotPayload<T extends { description: string }>(spot: T) {
  return { ...spot, description: stripMapShareUrls(spot.description) };
}

function text(value: unknown, field: string, required = true) {
  if (typeof value !== 'string') {
    if (required) {
      throw new HttpError(400, `${field}을(를) 입력해 주세요.`);
    }
    return '';
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new HttpError(400, `${field}을(를) 입력해 주세요.`);
  }
  return trimmed;
}

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

function idParam(req: Request) {
  const value = req.params['id'];
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) {
    throw new HttpError(400, 'id가 필요합니다.');
  }
  return id;
}

function boolField(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === 'false' || value === 0 || value === '0') {
    return false;
  }
  return fallback;
}

function optionIdsFromBody(body: { optionId?: unknown; optionIds?: unknown }) {
  const raw = Array.isArray(body.optionIds)
    ? body.optionIds
    : body.optionId != null
      ? [body.optionId]
      : [];
  return [...new Set(raw.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean))];
}

function assertVoteOpen(vote: { startsAt: Date; endsAt: Date }) {
  if (vote.startsAt.getTime() > Date.now()) {
    throw new HttpError(400, '아직 시작되지 않은 투표입니다.');
  }
  if (vote.endsAt.getTime() <= Date.now()) {
    throw new HttpError(400, '마감된 투표입니다.');
  }
}

function dateField(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${field}을(를) 선택해 주세요.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${field} 형식이 올바르지 않습니다.`);
  }
  return date;
}

const adminId = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || '230408';

function headerValue(req: Request, name: string) {
  const value = req.header(name);
  return typeof value === 'string' ? value : '';
}

function decodeHeader(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function actorName(req: Request) {
  return decodeHeader(headerValue(req, 'x-user-name')).replace(/\s+/g, ' ').trim().slice(0, 20);
}

function actorKey(req: Request) {
  return decodeHeader(headerValue(req, 'x-user-key')).trim().slice(0, 64);
}

function requireAdmin(req: Request) {
  if (headerValue(req, 'x-admin-id') !== adminId || headerValue(req, 'x-admin-password') !== adminPassword) {
    throw new HttpError(401, '관리자만 할 수 있습니다.');
  }
}

function adminGuard(req: Request, _res: Response, next: NextFunction) {
  try {
    requireAdmin(req);
    next();
  } catch (error) {
    next(error);
  }
}

function isAdminRequest(req: Request) {
  return headerValue(req, 'x-admin-id') === adminId && headerValue(req, 'x-admin-password') === adminPassword;
}

function requestPin(req: Request) {
  const fromHeader = headerValue(req, 'x-model-pin').trim();
  if (fromHeader) {
    return fromHeader;
  }
  const body = req.body ?? {};
  return typeof body.pin === 'string' ? body.pin.trim() : '';
}

function parsePin(value: string) {
  if (!/^\d{4}$/.test(value)) {
    throw new HttpError(400, '비밀번호는 숫자 4자리여야 합니다.');
  }
  return value;
}

function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(`${salt}:${pin}`).digest('hex');
  return `${salt}:${hash}`;
}

function pinMatches(pin: string, stored: string) {
  const sep = stored.indexOf(':');
  if (sep < 0 || !pin || !stored) {
    return false;
  }
  const salt = stored.slice(0, sep);
  const hash = stored.slice(sep + 1);
  const next = createHash('sha256').update(`${salt}:${pin}`).digest('hex');
  if (hash.length !== next.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(next));
  } catch {
    return false;
  }
}

function sameAuthor(req: Request, author: string) {
  const name = actorName(req);
  const posted = author.replace(/\s+/g, ' ').trim();
  return Boolean(name) && name === posted;
}

function requireModelWrite(req: Request, model: { pinHash: string }) {
  if (isAdminRequest(req)) {
    return;
  }
  if (!model.pinHash) {
    throw new HttpError(403, '이 글은 비밀번호가 없습니다. 작성자 이름과 같은 계정으로 들어가 비밀번호를 정하거나, 관리자에게 요청해 주세요.');
  }
  if (!pinMatches(parsePin(requestPin(req)), model.pinHash)) {
    throw new HttpError(403, '비밀번호가 올바르지 않습니다.');
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'haemi-api' });
});

app.get(
  '/api/spots',
  asyncHandler(async (_req, res) => {
    const spots = await prisma.spot.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(spots.map(spotPayload));
  })
);

type PlaceHit = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

function parseCoord(value?: string) {
  const coord = Number(value);
  return Number.isFinite(coord) ? coord : null;
}

function toPlaceHit(doc: {
  id?: string;
  name: string;
  address: string;
  x?: string;
  y?: string;
}): PlaceHit | null {
  const lng = parseCoord(doc.x);
  const lat = parseCoord(doc.y);
  if (lat == null || lng == null) {
    return null;
  }
  return {
    id: doc.id || `${lng},${lat},${doc.name}`,
    name: doc.name,
    address: doc.address,
    lat,
    lng,
  };
}

async function searchKakaoPlaces(query: string): Promise<PlaceHit[]> {
  const key = process.env.KAKAO_REST_API_KEY || '';
  if (!key) {
    return [];
  }

  const headers = { Authorization: `KakaoAK ${key}` };
  const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`;
  const keywordRes = await fetch(keywordUrl, { headers });
  if (!keywordRes.ok) {
    throw new HttpError(502, '카카오 지도를 찾지 못했습니다.');
  }
  const keywordJson = (await keywordRes.json()) as {
    documents?: Array<{
      id?: string;
      place_name?: string;
      address_name?: string;
      road_address_name?: string;
      x?: string;
      y?: string;
    }>;
  };
  let places = (keywordJson.documents || [])
    .map((doc) =>
      toPlaceHit({
        id: doc.id,
        name: doc.place_name || '',
        address: doc.road_address_name || doc.address_name || '',
        x: doc.x,
        y: doc.y,
      })
    )
    .filter((place): place is PlaceHit => place != null);

  if (places.length === 0) {
    const addressUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=10`;
    const addressRes = await fetch(addressUrl, { headers });
    if (addressRes.ok) {
      const addressJson = (await addressRes.json()) as {
        documents?: Array<{
          address_name?: string;
          x?: string;
          y?: string;
          road_address?: { address_name?: string };
        }>;
      };
      places = (addressJson.documents || [])
        .map((doc) =>
          toPlaceHit({
            name: doc.road_address?.address_name || doc.address_name || '',
            address: doc.address_name || '',
            x: doc.x,
            y: doc.y,
          })
        )
        .filter((place): place is PlaceHit => place != null);
    }
  }

  return places;
}

const REGION_TOKEN =
  /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|충청|전라|경상)/;
const ROAD_NUMBER = /([가-힣0-9]+(?:대로|번길|로|길|가))(\d+(?:-\d+)*)/g;

function geocodeQueries(query: string) {
  const trimmed = query.trim().replace(/\s+/g, ' ');
  const spaced = trimmed.replace(ROAD_NUMBER, '$1 $2');
  const queries: string[] = [];
  const add = (value: string) => {
    const next = value.trim();
    if (next.length >= 2 && !queries.includes(next)) {
      queries.push(next);
    }
  };
  add(trimmed);
  add(spaced);
  add(spaced.replace(/\s+\d+(-\d+)*$/, ''));
  for (const part of spaced.split(/[,\s]+/)) {
    if (
      part.length >= 2 &&
      !REGION_TOKEN.test(part) &&
      !/^\d/.test(part) &&
      !/(시|군|구|읍|면|동|로|길)$/.test(part)
    ) {
      add(part);
    }
  }
  return queries;
}

async function searchNominatimPlaces(query: string): Promise<PlaceHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=ko&q=${encodeURIComponent(query)}`;
  const nominatimRes = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ko',
      'User-Agent': 'HMFPV/1.0 (https://if.io.kr/haemi-api)',
    },
  });
  if (!nominatimRes.ok) {
    return [];
  }
  const rows = (await nominatimRes.json()) as Array<{
    place_id?: number;
    lat?: string;
    lon?: string;
    name?: string;
    display_name?: string;
  }>;
  return (Array.isArray(rows) ? rows : [])
    .map((row) =>
      toPlaceHit({
        id: String(row.place_id || `${row.lon},${row.lat}`),
        name: row.name || row.display_name || query,
        address: row.display_name || '',
        x: row.lon,
        y: row.lat,
      })
    )
    .filter((place): place is PlaceHit => place != null);
}

async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const queries = geocodeQueries(query);
  for (const next of queries) {
    try {
      const kakao = await searchKakaoPlaces(next);
      if (kakao.length > 0) {
        return kakao;
      }
    } catch {
      // Fall through to OpenStreetMap when Kakao is unset or failing.
    }
  }
  for (const next of queries) {
    const found = await searchNominatimPlaces(next);
    if (found.length > 0) {
      return found;
    }
  }
  return [];
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = process.env.KAKAO_REST_API_KEY || '';
  if (key) {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${encodeURIComponent(String(lng))}&y=${encodeURIComponent(String(lat))}`;
    const kakaoRes = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (kakaoRes.ok) {
      const json = (await kakaoRes.json()) as {
        documents?: Array<{
          address?: { address_name?: string };
          road_address?: { address_name?: string };
        }>;
      };
      const doc = json.documents?.[0];
      const address = doc?.road_address?.address_name || doc?.address?.address_name || '';
      if (address) {
        return address;
      }
    }
  }
  const nominatimRes = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=ko`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'ko',
        'User-Agent': 'HMFPV/1.0 (https://if.io.kr/haemi-api)',
      },
    }
  );
  if (!nominatimRes.ok) {
    return '';
  }
  const json = (await nominatimRes.json()) as { display_name?: string };
  return typeof json.display_name === 'string' ? json.display_name : '';
}

app.get(
  '/api/places',
  asyncHandler(async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2) {
      res.json({ places: [] });
      return;
    }
    res.json({ places: await searchPlaces(query) });
  })
);

app.get(
  '/api/map',
  asyncHandler(async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2) {
      throw new HttpError(400, '주소를 입력해 주세요.');
    }
    const [place] = await searchPlaces(query);
    if (!place) {
      throw new HttpError(404, '지도를 찾지 못했습니다.');
    }
    res.json({ lat: place.lat, lng: place.lng, name: place.name, address: place.address });
  })
);

app.get(
  '/api/map/reverse',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new HttpError(400, '좌표가 올바르지 않습니다.');
    }
    const address = await reverseGeocode(lat, lng);
    if (!address) {
      throw new HttpError(404, '주소를 찾지 못했습니다.');
    }
    res.json({ address, lat, lng });
  })
);

app.get(
  '/api/airspace',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new HttpError(400, '좌표가 올바르지 않습니다.');
    }
    if (!airspaceConfigured()) {
      throw new HttpError(503, '공역 데이터를 아직 연결하지 못했습니다.');
    }
    try {
      res.json(await lookupAirspace(lat, lng));
    } catch {
      throw new HttpError(502, '공역 정보를 불러오지 못했습니다.');
    }
  })
);

app.get(
  '/api/airspace/wms',
  asyncHandler(async (req, res) => {
    if (!airspaceConfigured()) {
      throw new HttpError(503, '공역 데이터를 아직 연결하지 못했습니다.');
    }
    try {
      const tile = await proxyWms(req.query as Record<string, unknown>);
      res.setHeader('Content-Type', tile.contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(tile.body);
    } catch (error) {
      if (error instanceof Error && error.message === 'bad-layers') {
        throw new HttpError(400, '공역 레이어가 올바르지 않습니다.');
      }
      throw new HttpError(502, '공역 지도를 불러오지 못했습니다.');
    }
  })
);

app.post(
  '/api/spots',
  asyncHandler(async (req, res) => {
    const spot = await prisma.spot.create({
      data: {
        title: text(req.body.title, '스팟 이름'),
        place: text(req.body.place, '장소', false),
        description: stripMapShareUrls(text(req.body.description, '설명', false)),
        author: actorName(req),
      },
    });
    res.status(201).json(spotPayload(spot));
  })
);

app.get(
  '/api/spots/:id',
  asyncHandler(async (req, res) => {
    const spot = await prisma.spot.findUnique({ where: { id: idParam(req) } });
    if (!spot) {
      throw new HttpError(404, '스팟을 찾을 수 없습니다.');
    }
    res.json(spotPayload(spot));
  })
);

app.patch(
  '/api/spots/:id',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const spot = await prisma.spot.update({
      where: { id: idParam(req) },
      data: {
        ...(req.body.title != null ? { title: text(req.body.title, '스팟 이름') } : {}),
        ...(req.body.place != null ? { place: text(req.body.place, '장소', false) } : {}),
        ...(req.body.description != null ? { description: stripMapShareUrls(text(req.body.description, '설명', false)) } : {}),
      },
    });
    res.json(spotPayload(spot));
  })
);

app.delete(
  '/api/spots/:id',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    await prisma.spot.delete({ where: { id: idParam(req) } });
    res.status(204).end();
  })
);

const repairStatuses = new Set(['pending', 'doing', 'done']);
const repairPhotoInclude = { photos: { orderBy: { sort: 'asc' as const } } };

function repairPayload(repair: {
  id: string;
  title: string;
  place: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  photos: Array<{ id: string; fileName: string; sort: number }>;
}) {
  return {
    ...repair,
    photos: repair.photos.map((photo) => ({
      id: photo.id,
      fileName: photo.fileName,
      url: `/api/repairs/${repair.id}/photos/${photo.id}`,
    })),
  };
}

async function saveRepairPhotos(repairId: string, files: Express.Multer.File[]) {
  if (files.length > 3) {
    for (const file of files) {
      fs.rmSync(file.path, { force: true });
    }
    throw new HttpError(400, '사진은 최대 3장까지 첨부할 수 있습니다.');
  }
  for (const [index, file] of files.entries()) {
    if (!String(file.mimetype || '').startsWith('image/')) {
      fs.rmSync(file.path, { force: true });
      throw new HttpError(400, '이미지 파일만 첨부할 수 있습니다.');
    }
    const photo = await prisma.repairPhoto.create({
      data: {
        repairId,
        fileName: file.originalname || `photo-${index + 1}.jpg`,
        sort: index,
      },
    });
    keepUpload(file.path, photo.id, photo.fileName);
  }
}

async function sendPushToAll(payload: {
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
}) {
  const tokens = await prisma.pushToken.findMany();
  if (tokens.length === 0) {
    return;
  }
  const messages = tokens.map((item) => ({
    to: item.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data,
    channelId: payload.channelId,
  }));
  for (let index = 0; index < messages.length; index += 100) {
    const chunk = messages.slice(index, index + 100);
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`expo push failed: ${response.status} ${detail}`);
    }
  }
}

function notifyRepairDone(title: string) {
  return sendPushToAll({
    title: '수리 완료',
    body: `${title} 수리가 완료되었습니다.`,
    data: { url: '/repairs' },
    channelId: 'repairs',
  });
}

function notifyNoticeCreated(id: string, title: string, body: string) {
  const preview = body.trim() ? `${title}\n${body.trim()}` : title;
  return sendPushToAll({
    title: '새 공지',
    body: preview.length > 180 ? `${preview.slice(0, 179)}…` : preview,
    data: { url: `/notice/${id}` },
    channelId: 'notices',
  });
}

app.get(
  '/api/repairs',
  asyncHandler(async (_req, res) => {
    const repairs = await prisma.repair.findMany({
      orderBy: { createdAt: 'desc' },
      include: repairPhotoInclude,
    });
    res.json(repairs.map(repairPayload));
  })
);

app.post(
  '/api/repairs',
  upload.array('photos', 3),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
    const repair = await prisma.repair.create({
      data: {
        title: text(body.title, '수리 제목'),
        place: text(body.place, '장소', false),
        description: text(body.description, '내용', false),
        author: actorName(req),
        status: 'pending',
      },
    });
    try {
      await saveRepairPhotos(repair.id, files);
    } catch (error) {
      const photos = await prisma.repairPhoto.findMany({ where: { repairId: repair.id } });
      for (const photo of photos) {
        removeUploadsFor(photo.id);
      }
      await prisma.repair.delete({ where: { id: repair.id } });
      throw error;
    }
    const saved = await prisma.repair.findUniqueOrThrow({
      where: { id: repair.id },
      include: repairPhotoInclude,
    });
    res.status(201).json(repairPayload(saved));
  })
);

app.get(
  '/api/repairs/:id/photos/:photoId',
  asyncHandler(async (req, res) => {
    const repairId = idParam(req);
    const photoId = Array.isArray(req.params['photoId']) ? req.params['photoId'][0] : req.params['photoId'];
    if (!photoId) {
      throw new HttpError(400, 'id가 필요합니다.');
    }
    const photo = await prisma.repairPhoto.findFirst({
      where: { id: photoId, repairId },
    });
    if (!photo) {
      throw new HttpError(404, '사진을 찾을 수 없습니다.');
    }
    const filePath = storedPath(photo.id, photo.fileName || 'photo.jpg');
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, '저장된 사진을 찾을 수 없습니다.');
    }
    res.sendFile(path.resolve(filePath));
  })
);

app.get(
  '/api/repairs/:id',
  asyncHandler(async (req, res) => {
    const repair = await prisma.repair.findUnique({
      where: { id: idParam(req) },
      include: repairPhotoInclude,
    });
    if (!repair) {
      throw new HttpError(404, '수리 내역을 찾을 수 없습니다.');
    }
    res.json(repairPayload(repair));
  })
);

app.patch(
  '/api/repairs/:id',
  asyncHandler(async (req, res) => {
    const status = req.body.status;
    if (status != null) {
      requireAdmin(req);
      if (!repairStatuses.has(status)) {
        throw new HttpError(400, '수리 상태가 올바르지 않습니다.');
      }
    }
    const id = idParam(req);
    const previous = await prisma.repair.findUnique({ where: { id } });
    if (!previous) {
      throw new HttpError(404, '수리 내역을 찾을 수 없습니다.');
    }
    const repair = await prisma.repair.update({
      where: { id },
      data: {
        ...(req.body.title != null ? { title: text(req.body.title, '수리 제목') } : {}),
        ...(req.body.place != null ? { place: text(req.body.place, '장소', false) } : {}),
        ...(req.body.description != null ? { description: text(req.body.description, '내용', false) } : {}),
        ...(status != null ? { status } : {}),
      },
      include: repairPhotoInclude,
    });
    if (status === 'done' && previous.status !== 'done') {
      notifyRepairDone(repair.title).catch((error) => {
        console.error('repair done notification failed', error);
      });
    }
    res.json(repairPayload(repair));
  })
);

app.delete(
  '/api/repairs/:id',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const id = idParam(req);
    const photos = await prisma.repairPhoto.findMany({ where: { repairId: id } });
    for (const photo of photos) {
      removeUploadsFor(photo.id);
    }
    await prisma.repair.delete({ where: { id } });
    res.status(204).end();
  })
);

app.get(
  '/api/notices',
  asyncHandler(async (_req, res) => {
    const notices = await prisma.notice.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(notices);
  })
);

app.post(
  '/api/notices',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const notice = await prisma.notice.create({
      data: {
        title: text(req.body.title, '공지 제목'),
        body: text(req.body.body, '내용', false),
        author: actorName(req) || '관리자',
      },
    });
    notifyNoticeCreated(notice.id, notice.title, notice.body).catch((error) => {
      console.error('notice notification failed', error);
    });
    res.status(201).json(notice);
  })
);

app.get(
  '/api/notices/:id',
  asyncHandler(async (req, res) => {
    const notice = await prisma.notice.findUnique({ where: { id: idParam(req) } });
    if (!notice) {
      throw new HttpError(404, '공지를 찾을 수 없습니다.');
    }
    res.json(notice);
  })
);

app.patch(
  '/api/notices/:id',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const notice = await prisma.notice.update({
      where: { id: idParam(req) },
      data: {
        ...(req.body.title != null ? { title: text(req.body.title, '공지 제목') } : {}),
        ...(req.body.body != null ? { body: text(req.body.body, '내용', false) } : {}),
      },
    });
    res.json(notice);
  })
);

app.delete(
  '/api/notices/:id',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    await prisma.notice.delete({ where: { id: idParam(req) } });
    res.status(204).end();
  })
);

const voteInclude = {
  options: {
    orderBy: { id: 'asc' as const },
    include: { ballots: { orderBy: { createdAt: 'asc' as const }, select: { name: true } } },
  },
};

type VoteRow = {
  id: string;
  title: string;
  body: string;
  author: string;
  startsAt: Date;
  endsAt: Date;
  allowMultiple: boolean;
  createdAt: Date;
  updatedAt: Date;
  options: Array<{
    id: string;
    label: string;
    count: number;
    voteId: string;
    ballots: Array<{ name: string }>;
  }>;
};

function votePayload(vote: VoteRow) {
  return {
    id: vote.id,
    title: vote.title,
    body: vote.body,
    author: vote.author,
    startsAt: vote.startsAt,
    endsAt: vote.endsAt,
    allowMultiple: vote.allowMultiple,
    createdAt: vote.createdAt,
    updatedAt: vote.updatedAt,
    options: vote.options.map((option) => ({
      id: option.id,
      label: option.label,
      count: option.count,
      voteId: option.voteId,
      voters: option.ballots.map((ballot) => ballot.name),
    })),
  };
}

app.get(
  '/api/votes',
  asyncHandler(async (_req, res) => {
    const votes = await prisma.vote.findMany({
      orderBy: { createdAt: 'desc' },
      include: voteInclude,
    });
    res.json(votes.map(votePayload));
  })
);

app.post(
  '/api/votes',
  asyncHandler(async (req, res) => {
    const options = Array.isArray(req.body.options) ? req.body.options : [];
    const labels = options
      .map((option: unknown) => (typeof option === 'string' ? option.trim() : ''))
      .filter(Boolean);
    if (labels.length < 2) {
      throw new HttpError(400, '선택지는 2개 이상 넣어 주세요.');
    }
    const startsAt = req.body.startsAt ? dateField(req.body.startsAt, '시작') : new Date();
    const endsAt = req.body.endsAt
      ? dateField(req.body.endsAt, '마감')
      : new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new HttpError(400, '마감은 시작 이후여야 합니다.');
    }
    if (endsAt.getTime() <= Date.now()) {
      throw new HttpError(400, '마감은 현재 이후여야 합니다.');
    }
    const vote = await prisma.vote.create({
      data: {
        title: text(req.body.title, '투표 제목'),
        body: text(req.body.body, '설명', false),
        author: actorName(req),
        startsAt,
        endsAt,
        allowMultiple: boolField(req.body.allowMultiple, true),
        options: { create: labels.map((label: string) => ({ label })) },
      },
      include: voteInclude,
    });
    res.status(201).json(votePayload(vote));
  })
);

app.get(
  '/api/votes/:id',
  asyncHandler(async (req, res) => {
    const vote = await prisma.vote.findUnique({
      where: { id: idParam(req) },
      include: voteInclude,
    });
    if (!vote) {
      throw new HttpError(404, '투표를 찾을 수 없습니다.');
    }
    res.json(votePayload(vote));
  })
);

app.patch(
  '/api/votes/:id',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const id = idParam(req);
    const existing = await prisma.vote.findUnique({
      where: { id },
      include: voteInclude,
    });
    if (!existing) {
      throw new HttpError(404, '투표를 찾을 수 없습니다.');
    }

    const startsAt = req.body.startsAt != null ? dateField(req.body.startsAt, '시작') : existing.startsAt;
    const endsAt = req.body.endsAt != null ? dateField(req.body.endsAt, '마감') : existing.endsAt;
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new HttpError(400, '마감은 시작 이후여야 합니다.');
    }

    if (Array.isArray(req.body.options)) {
      const labels = req.body.options
        .map((option: unknown) => (typeof option === 'string' ? option.trim() : ''))
        .filter(Boolean);
      if (labels.length < 2) {
        throw new HttpError(400, '선택지는 2개 이상 넣어 주세요.');
      }
      const current = existing.options;
      for (const [index, label] of labels.entries()) {
        const option = current[index];
        if (option) {
          await prisma.voteOption.update({ where: { id: option.id }, data: { label } });
        } else {
          await prisma.voteOption.create({ data: { voteId: id, label } });
        }
      }
      const extra = current.slice(labels.length);
      if (extra.length > 0) {
        await prisma.voteOption.deleteMany({ where: { id: { in: extra.map((option) => option.id) } } });
      }
    }

    const vote = await prisma.vote.update({
      where: { id },
      data: {
        ...(req.body.title != null ? { title: text(req.body.title, '투표 제목') } : {}),
        ...(req.body.body != null ? { body: text(req.body.body, '설명', false) } : {}),
        ...(req.body.startsAt != null ? { startsAt } : {}),
        ...(req.body.endsAt != null ? { endsAt } : {}),
        ...(req.body.allowMultiple != null ? { allowMultiple: boolField(req.body.allowMultiple, existing.allowMultiple) } : {}),
      },
      include: voteInclude,
    });
    res.json(votePayload(vote));
  })
);

app.post(
  '/api/votes/:id/cast',
  asyncHandler(async (req, res) => {
    const voteId = idParam(req);
    const vote = await prisma.vote.findUnique({ where: { id: voteId } });
    if (!vote) {
      throw new HttpError(404, '투표를 찾을 수 없습니다.');
    }
    assertVoteOpen(vote);
    const optionIds = optionIdsFromBody(req.body);
    if (optionIds.length === 0) {
      throw new HttpError(400, '선택지를 고르세요.');
    }
    if (!vote.allowMultiple && optionIds.length > 1) {
      throw new HttpError(400, '한 개만 선택할 수 있습니다.');
    }
    const options = await prisma.voteOption.findMany({
      where: { id: { in: optionIds }, voteId },
    });
    if (options.length !== optionIds.length) {
      throw new HttpError(404, '선택지를 찾을 수 없습니다.');
    }
    const name = actorName(req);
    const voterKey = actorKey(req);
    if (voterKey) {
      if (!name) {
        throw new HttpError(400, '이름을 입력해 주세요.');
      }
      const already = await prisma.voteBallot.findFirst({ where: { voteId, voterKey } });
      if (already) {
        throw new HttpError(409, '이미 투표했습니다.');
      }
    }
    try {
      await prisma.$transaction([
        ...options.map((option) =>
          prisma.voteOption.update({
            where: { id: option.id },
            data: { count: { increment: 1 } },
          })
        ),
        ...(voterKey
          ? options.map((option) =>
              prisma.voteBallot.create({
                data: { voteId, optionId: option.id, voterKey, name },
              })
            )
          : []),
      ]);
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        throw new HttpError(409, '이미 투표했습니다.');
      }
      throw error;
    }
    const updated = await prisma.vote.findUniqueOrThrow({
      where: { id: voteId },
      include: voteInclude,
    });
    res.json(votePayload(updated));
  })
);

app.post(
  '/api/votes/:id/uncast',
  asyncHandler(async (req, res) => {
    const voteId = idParam(req);
    const vote = await prisma.vote.findUnique({ where: { id: voteId } });
    if (!vote) {
      throw new HttpError(404, '투표를 찾을 수 없습니다.');
    }
    assertVoteOpen(vote);
    const voterKey = actorKey(req);
    const ballots = voterKey
      ? await prisma.voteBallot.findMany({ where: { voteId, voterKey } })
      : [];
    const optionIds = ballots.length > 0 ? ballots.map((ballot) => ballot.optionId) : optionIdsFromBody(req.body);
    if (optionIds.length === 0) {
      throw new HttpError(400, '취소할 선택지가 없습니다.');
    }
    const options = await prisma.voteOption.findMany({
      where: { id: { in: optionIds }, voteId },
    });
    if (ballots.length === 0 && options.length !== optionIds.length) {
      throw new HttpError(404, '선택지를 찾을 수 없습니다.');
    }
    await prisma.$transaction([
      ...(voterKey ? [prisma.voteBallot.deleteMany({ where: { voteId, voterKey } })] : []),
      ...options.map((option) =>
        prisma.voteOption.updateMany({
          where: { id: option.id, count: { gt: 0 } },
          data: { count: { decrement: 1 } },
        })
      ),
    ]);
    const updated = await prisma.vote.findUniqueOrThrow({
      where: { id: voteId },
      include: voteInclude,
    });
    res.json(votePayload(updated));
  })
);

app.delete(
  '/api/votes/:id',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    await prisma.vote.delete({ where: { id: idParam(req) } });
    res.status(204).end();
  })
);

const modelFileInclude = {
  files: {
    orderBy: { createdAt: 'desc' as const },
    include: { previews: { orderBy: { sort: 'asc' as const } } },
  },
};

const modelUploadFields = [
  { name: 'file', maxCount: 1 },
  { name: 'files', maxCount: 30 },
  { name: 'previews', maxCount: 60 },
];

type ModelPreviewRow = { id: string; fileName: string; sort: number; createdAt: Date };

type ModelRow = {
  id: string;
  title: string;
  format: string;
  fileName: string;
  url: string;
  description: string;
  author: string;
  pinHash: string;
  createdAt: Date;
  updatedAt: Date;
  files: Array<{
    id: string;
    fileName: string;
    format: string;
    createdAt: Date;
    previews: ModelPreviewRow[];
  }>;
};

function modelPayload(model: ModelRow) {
  const { pinHash, ...rest } = model;
  return {
    ...rest,
    hasPin: Boolean(pinHash),
    files: model.files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      format: file.format,
      url: `/api/models/${model.id}/files/${file.id}`,
      createdAt: file.createdAt,
      previews: file.previews.map((preview) => ({
        id: preview.id,
        fileName: preview.fileName,
        url: `/api/models/${model.id}/files/${file.id}/previews/${preview.id}`,
        createdAt: preview.createdAt,
      })),
    })),
  };
}

function requestFiles(req: Request) {
  if (Array.isArray(req.files)) {
    return req.files as Express.Multer.File[];
  }
  const grouped = req.files as Record<string, Express.Multer.File[]> | undefined;
  const listed = [...(grouped?.files || []), ...(grouped?.file || [])];
  if (listed.length > 0) {
    return listed;
  }
  return req.file ? [req.file] : [];
}

async function syncModelFileMeta(modelId: string) {
  const latest = await prisma.model3dFile.findFirst({
    where: { modelId },
    orderBy: { createdAt: 'desc' },
  });
  await prisma.model3d.update({
    where: { id: modelId },
    data: {
      fileName: latest?.fileName || '',
      format: latest?.format || '',
      url: latest ? `/api/models/${modelId}/file` : '',
    },
  });
}

function namedUploads(req: Request, name: string) {
  if (Array.isArray(req.files)) {
    return name === 'files' || name === 'file' ? (req.files as Express.Multer.File[]) : [];
  }
  const grouped = req.files as Record<string, Express.Multer.File[]> | undefined;
  return grouped?.[name] || [];
}

function previewExtOk(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  const mime = mimeType.toLowerCase();
  const extOk = ext === 'jpg' || ext === 'jpeg' || ext === 'png';
  const mimeOk = mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png';
  if (ext) {
    return extOk;
  }
  return mimeOk;
}

function assertPreviewPhoto(file: Express.Multer.File) {
  const name = file.originalname || 'preview.jpg';
  if (!previewExtOk(name, file.mimetype || '')) {
    fs.rmSync(file.path, { force: true });
    throw new HttpError(400, '미리보기 사진은 JPG, JPEG, PNG만 올릴 수 있습니다.');
  }
}

function parsePreviewCounts(value: unknown, fileCount: number) {
  if (fileCount === 0) {
    return [] as number[];
  }
  if (typeof value !== 'string' || !value.trim()) {
    return Array.from({ length: fileCount }, () => 0);
  }
  const counts = value.split(',').map((item) => Number(item.trim()));
  if (counts.length !== fileCount || counts.some((count) => !Number.isInteger(count) || count < 0 || count > 2)) {
    throw new HttpError(400, '파일마다 미리보기 사진은 최대 2장입니다.');
  }
  return counts;
}

async function saveFilePreviews(fileId: string, files: Express.Multer.File[]) {
  const existing = await prisma.model3dPreview.count({ where: { fileId } });
  if (existing + files.length > 2) {
    for (const file of files) {
      fs.rmSync(file.path, { force: true });
    }
    throw new HttpError(400, '파일마다 미리보기 사진은 최대 2장입니다.');
  }
  for (const [index, file] of files.entries()) {
    assertPreviewPhoto(file);
    const originalName = file.originalname || `preview-${existing + index + 1}.jpg`;
    const row = await prisma.model3dPreview.create({
      data: {
        fileId,
        fileName: originalName,
        sort: existing + index,
      },
    });
    keepUpload(file.path, row.id, originalName);
  }
}

async function saveModelFiles(
  modelId: string,
  files: Express.Multer.File[],
  previewCounts: number[] = [],
  previews: Express.Multer.File[] = []
) {
  const counts = previewCounts.length === files.length ? previewCounts : files.map(() => 0);
  const totalPreviews = counts.reduce((sum, count) => sum + count, 0);
  if (previews.length !== totalPreviews) {
    for (const file of previews) {
      fs.rmSync(file.path, { force: true });
    }
    throw new HttpError(400, '미리보기 사진 수가 올바르지 않습니다.');
  }
  let offset = 0;
  for (const [index, file] of files.entries()) {
    const originalName = file.originalname || 'file';
    const row = await prisma.model3dFile.create({
      data: {
        modelId,
        fileName: originalName,
        format: formatFromName(originalName),
      },
    });
    keepUpload(file.path, row.id, originalName);
    const count = counts[index] || 0;
    await saveFilePreviews(row.id, previews.slice(offset, offset + count));
    offset += count;
  }
  if (files.length > 0) {
    await syncModelFileMeta(modelId);
  }
}

async function removeModelFileDisk(fileId: string) {
  const previews = await prisma.model3dPreview.findMany({ where: { fileId } });
  for (const preview of previews) {
    removeUploadsFor(preview.id);
  }
  removeUploadsFor(fileId);
}

async function hydrateLegacyModelFile(model: ModelRow): Promise<ModelRow> {
  if (model.files.length > 0 || (!model.fileName && !model.url)) {
    return model;
  }
  const row = await prisma.model3dFile.create({
    data: {
      modelId: model.id,
      fileName: model.fileName,
      format: model.format || formatFromName(model.fileName),
      createdAt: model.createdAt,
    },
  });
  const oldPath = storedPath(model.id, model.fileName || 'file');
  if (fs.existsSync(oldPath)) {
    copyUpload(oldPath, row.id, row.fileName || 'file');
  }
  return { ...model, files: [{ ...row, previews: [] }] };
}

function sendModelDiskFile(res: Response, id: string, fileName: string) {
  const filePath = storedPath(id, fileName || 'file');
  if (!fs.existsSync(filePath)) {
    throw new HttpError(404, '저장된 파일을 찾을 수 없습니다.');
  }
  res.download(filePath, fileName || 'model.stl');
}

app.get(
  '/api/models',
  asyncHandler(async (_req, res) => {
    const models = await prisma.model3d.findMany({
      orderBy: { updatedAt: 'desc' },
      include: modelFileInclude,
    });
    const hydrated = [];
    for (const model of models) {
      hydrated.push(modelPayload(await hydrateLegacyModelFile(model)));
    }
    res.json(hydrated);
  })
);

app.post(
  '/api/models',
  upload.fields(modelUploadFields),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const uploaded = requestFiles(req);
    const previews = namedUploads(req, 'previews');
    const previewCounts = parsePreviewCounts(body.previewCounts, uploaded.length);
    const firstName = uploaded[0]?.originalname || text(body.fileName, '파일 이름', false);
    const pin = parsePin(requestPin(req));
    const model = await prisma.model3d.create({
      data: {
        title: text(body.title, '이름'),
        format: text(body.format, '형식', false) || (firstName ? formatFromName(firstName) : ''),
        fileName: firstName,
        url: text(body.url, '파일 주소', false),
        description: text(body.description, '설명', false),
        author: actorName(req),
        pinHash: hashPin(pin),
      },
    });
    try {
      await saveModelFiles(model.id, uploaded, previewCounts, previews);
    } catch (error) {
      const rows = await prisma.model3dFile.findMany({ where: { modelId: model.id } });
      for (const row of rows) {
        await removeModelFileDisk(row.id);
      }
      await prisma.model3d.delete({ where: { id: model.id } });
      throw error;
    }
    if (uploaded.length === 0 && model.url) {
      const saved = await prisma.model3d.findUniqueOrThrow({
        where: { id: model.id },
        include: modelFileInclude,
      });
      res.status(201).json(modelPayload(saved));
      return;
    }
    if (uploaded.length > 0) {
      await prisma.model3d.update({
        where: { id: model.id },
        data: { url: `/api/models/${model.id}/file` },
      });
    }
    const saved = await prisma.model3d.findUniqueOrThrow({
      where: { id: model.id },
      include: modelFileInclude,
    });
    res.status(201).json(modelPayload(saved));
  })
);

app.get(
  '/api/models/:id/file',
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({
      where: { id: idParam(req) },
      include: modelFileInclude,
    });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    const latest = (await hydrateLegacyModelFile(model)).files[0];
    if (latest) {
      sendModelDiskFile(res, latest.id, latest.fileName);
      return;
    }
    sendModelDiskFile(res, model.id, model.fileName);
  })
);

app.get(
  '/api/models/:id/files/:fileId/previews/:previewId',
  asyncHandler(async (req, res) => {
    const previewId = String(req.params.previewId || '');
    const file = await prisma.model3dFile.findFirst({
      where: { id: String(req.params.fileId), modelId: idParam(req) },
    });
    if (!file || !previewId) {
      throw new HttpError(404, '미리보기 사진을 찾을 수 없습니다.');
    }
    const preview = await prisma.model3dPreview.findFirst({
      where: { id: previewId, fileId: file.id },
    });
    if (!preview) {
      throw new HttpError(404, '미리보기 사진을 찾을 수 없습니다.');
    }
    const filePath = storedPath(preview.id, preview.fileName || 'preview.jpg');
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, '저장된 사진을 찾을 수 없습니다.');
    }
    res.sendFile(path.resolve(filePath));
  })
);

app.post(
  '/api/models/:id/files/:fileId/previews',
  upload.array('previews', 2),
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    requireModelWrite(req, model);
    const file = await prisma.model3dFile.findFirst({
      where: { id: String(req.params.fileId), modelId: model.id },
    });
    if (!file) {
      throw new HttpError(404, '저장된 파일을 찾을 수 없습니다.');
    }
    const uploaded = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    if (uploaded.length === 0) {
      throw new HttpError(400, '미리보기 사진을 선택해 주세요.');
    }
    await saveFilePreviews(file.id, uploaded);
    const saved = await prisma.model3d.findUniqueOrThrow({
      where: { id: model.id },
      include: modelFileInclude,
    });
    res.status(201).json(modelPayload(saved));
  })
);

app.delete(
  '/api/models/:id/files/:fileId/previews/:previewId',
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    requireModelWrite(req, model);
    const preview = await prisma.model3dPreview.findFirst({
      where: {
        id: String(req.params.previewId),
        fileId: String(req.params.fileId),
        file: { modelId: model.id },
      },
    });
    if (!preview) {
      throw new HttpError(404, '미리보기 사진을 찾을 수 없습니다.');
    }
    removeUploadsFor(preview.id);
    await prisma.model3dPreview.delete({ where: { id: preview.id } });
    res.status(204).end();
  })
);

app.get(
  '/api/models/:id/files/:fileId',
  asyncHandler(async (req, res) => {
    const file = await prisma.model3dFile.findFirst({
      where: { id: String(req.params.fileId), modelId: idParam(req) },
    });
    if (!file) {
      throw new HttpError(404, '저장된 파일을 찾을 수 없습니다.');
    }
    const primary = storedPath(file.id, file.fileName || 'file');
    if (fs.existsSync(primary)) {
      res.download(primary, file.fileName || 'model.stl');
      return;
    }
    sendModelDiskFile(res, idParam(req), file.fileName);
  })
);

app.post(
  '/api/models/:id/files',
  upload.fields(modelUploadFields),
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    requireModelWrite(req, model);
    const uploaded = requestFiles(req);
    if (uploaded.length === 0) {
      throw new HttpError(400, '파일을 선택해 주세요.');
    }
    const previews = namedUploads(req, 'previews');
    const previewCounts = parsePreviewCounts(req.body?.previewCounts, uploaded.length);
    await saveModelFiles(model.id, uploaded, previewCounts, previews);
    const saved = await prisma.model3d.findUniqueOrThrow({
      where: { id: model.id },
      include: modelFileInclude,
    });
    res.status(201).json(modelPayload(saved));
  })
);

app.delete(
  '/api/models/:id/files/:fileId',
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    requireModelWrite(req, model);
    const file = await prisma.model3dFile.findFirst({
      where: { id: String(req.params.fileId), modelId: model.id },
    });
    if (!file) {
      throw new HttpError(404, '저장된 파일을 찾을 수 없습니다.');
    }
    await removeModelFileDisk(file.id);
    await prisma.model3dFile.delete({ where: { id: file.id } });
    await syncModelFileMeta(idParam(req));
    res.status(204).end();
  })
);

app.get(
  '/api/models/:id',
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({
      where: { id: idParam(req) },
      include: modelFileInclude,
    });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    res.json(modelPayload(await hydrateLegacyModelFile(model)));
  })
);

app.post(
  '/api/models/:id/unlock',
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    requireModelWrite(req, model);
    res.json({ ok: true });
  })
);

app.post(
  '/api/models/:id/pin',
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    if (model.pinHash) {
      throw new HttpError(409, '이미 비밀번호가 있습니다.');
    }
    if (!isAdminRequest(req) && !sameAuthor(req, model.author)) {
      throw new HttpError(
        403,
        '이 글은 예전에 올려서 비밀번호가 없습니다. 작성자 이름과 같은 계정으로 들어가 비밀번호를 정하거나, 관리자에게 요청해 주세요.'
      );
    }
    const pin = parsePin(requestPin(req));
    await prisma.model3d.update({
      where: { id: model.id },
      data: { pinHash: hashPin(pin) },
    });
    res.json({ ok: true, hasPin: true });
  })
);

app.patch(
  '/api/models/:id',
  upload.fields(modelUploadFields),
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    requireModelWrite(req, model);
    const uploaded = requestFiles(req);
    if (uploaded.length > 0) {
      const previews = namedUploads(req, 'previews');
      const previewCounts = parsePreviewCounts(req.body?.previewCounts, uploaded.length);
      await saveModelFiles(model.id, uploaded, previewCounts, previews);
    }
    const body = req.body ?? {};
    await prisma.model3d.update({
      where: { id: model.id },
      data: {
        ...(body.title != null ? { title: text(body.title, '이름') } : {}),
        ...(body.format != null ? { format: text(body.format, '형식', false) } : {}),
        ...(body.fileName != null ? { fileName: text(body.fileName, '파일 이름', false) } : {}),
        ...(body.url != null && uploaded.length === 0 ? { url: text(body.url, '파일 주소', false) } : {}),
        ...(body.description != null ? { description: text(body.description, '설명', false) } : {}),
      },
    });
    const saved = await prisma.model3d.findUniqueOrThrow({
      where: { id: model.id },
      include: modelFileInclude,
    });
    res.json(modelPayload(saved));
  })
);

app.delete(
  '/api/models/:id',
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const model = await prisma.model3d.findUnique({ where: { id } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    requireModelWrite(req, model);
    const files = await prisma.model3dFile.findMany({ where: { modelId: id } });
    for (const file of files) {
      await removeModelFileDisk(file.id);
    }
    removeUploadsFor(id);
    await prisma.model3d.delete({ where: { id } });
    res.status(204).end();
  })
);

app.post(
  '/api/push-tokens',
  asyncHandler(async (req, res) => {
    const token = text(req.body.token, '알림 토큰');
    await prisma.pushToken.upsert({
      where: { token },
      update: {},
      create: { token },
    });
    res.status(204).end();
  })
);

const releaseDir = process.env.APP_RELEASE_DIR || path.join(process.cwd(), 'releases');
const publicBase = process.env.PUBLIC_APP_BASE || 'https://if.io.kr/haemi-api';
const iosBundleId = 'com.haemi.app';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readAppRelease() {
  const metaPath = path.join(releaseDir, 'version.json');
  const apkPath = path.join(releaseDir, 'hmfpv.apk');
  const ipaPath = path.join(releaseDir, 'hmfpv.ipa');
  const fallback = { version: '1.0.0', versionCode: 0, notes: '' };
  const raw = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        version?: string;
        versionCode?: number;
        notes?: string;
      })
    : fallback;
  return {
    version: typeof raw.version === 'string' ? raw.version : fallback.version,
    versionCode: Number(raw.versionCode) || 0,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    hasApk: fs.existsSync(apkPath),
    hasIpa: fs.existsSync(ipaPath),
  };
}

function iosInstallUrl() {
  const manifest = `${publicBase}/api/app/manifest.plist`;
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifest)}`;
}

app.get(
  '/api/game/ranks',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.gameScore.findMany({
      orderBy: [{ score: 'desc' }, { updatedAt: 'asc' }],
      take: 10,
    });
    res.json(
      rows.map((row, index) => ({
        rank: index + 1,
        name: row.name,
        score: row.score,
      }))
    );
  })
);

app.post(
  '/api/game/scores',
  asyncHandler(async (req, res) => {
    const name = actorName(req);
    if (name.length < 2) {
      throw new HttpError(400, '로그인 이름이 필요합니다.');
    }
    const score = Number(req.body?.score);
    if (!Number.isFinite(score) || score < 1) {
      throw new HttpError(400, '점수가 올바르지 않습니다.');
    }
    const next = Math.min(9999, Math.floor(score));
    const current = await prisma.gameScore.findUnique({ where: { name } });
    if (!current) {
      const created = await prisma.gameScore.create({ data: { name, score: next } });
      res.json({ name: created.name, score: created.score, best: true });
      return;
    }
    if (next > current.score) {
      const updated = await prisma.gameScore.update({
        where: { name },
        data: { score: next },
      });
      res.json({ name: updated.name, score: updated.score, best: true });
      return;
    }
    res.json({ name: current.name, score: current.score, best: false });
  })
);

app.get('/api/app/version', (_req, res) => {
  const release = readAppRelease();
  res.json({
    version: release.version,
    versionCode: release.versionCode,
    notes: release.notes,
    hasApk: release.hasApk,
    hasIpa: release.hasIpa,
    apkUrl: '/api/app/hmfpv.apk',
    ipaUrl: '/api/app/hmfpv.ipa',
    iosInstallUrl: iosInstallUrl(),
  });
});

app.get(
  '/api/app/hmfpv.apk',
  asyncHandler(async (_req, res) => {
    const apkPath = path.join(releaseDir, 'hmfpv.apk');
    if (!fs.existsSync(apkPath)) {
      throw new HttpError(404, '새 설치 파일이 없습니다.');
    }
    res.download(apkPath, 'HMFPV.apk');
  })
);

app.get(
  '/api/app/hmfpv.ipa',
  asyncHandler(async (_req, res) => {
    const ipaPath = path.join(releaseDir, 'hmfpv.ipa');
    if (!fs.existsSync(ipaPath)) {
      throw new HttpError(404, 'iOS 설치 파일이 없습니다.');
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.download(ipaPath, 'HMFPV.ipa');
  })
);

app.get('/api/app/manifest.plist', (_req, res) => {
  const release = readAppRelease();
  if (!release.hasIpa) {
    res.status(404).type('text/plain').send('iOS 설치 파일이 없습니다.');
    return;
  }
  res
    .type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${publicBase}/api/app/hmfpv.ipa</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${iosBundleId}</string>
        <key>bundle-version</key>
        <string>${release.version}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>HMFPV</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
`);
});

app.get('/app', (_req, res) => {
  const release = readAppRelease();
  const apkHref = `${publicBase}/api/app/hmfpv.apk`;
  const iosHref = iosInstallUrl();
  res.type('html').send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HMFPV 설치</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; color: #1a1a1a; }
    main { max-width: 420px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    p { color: #666; line-height: 1.5; }
    .ver { color: #F07D22; font-weight: 700; margin: 16px 0 24px; }
    a.btn { display: block; text-align: center; text-decoration: none; color: #fff; background: #F07D22; border-radius: 14px; padding: 16px; font-weight: 700; margin-bottom: 12px; }
    a.btn.secondary { background: #1a1a1a; }
    a.btn.disabled { background: #ddd; color: #888; pointer-events: none; }
    .hint { font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>HMFPV</h1>
    <p>${escapeHtml(release.notes || '앱을 설치하거나 업데이트하세요.')}</p>
    <div class="ver">${escapeHtml(release.version)}</div>
    <a class="btn${release.hasApk ? '' : ' disabled'}" href="${apkHref}">Android APK 받기</a>
    <a class="btn secondary${release.hasIpa ? '' : ' disabled'}" href="${iosHref}">iPhone에 설치</a>
    <p class="hint">iPhone 설치는 Safari에서 열고, 기기 서명이 된 IPA가 올라온 뒤에만 동작합니다.</p>
  </main>
</body>
</html>`);
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error && typeof error === 'object' && 'code' in error && error.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: '파일이 너무 큽니다. 80MB 이하로 올려 주세요.' });
    return;
  }
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'P2025') {
    res.status(404).json({ error: '대상을 찾을 수 없습니다.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

async function cleanupLegacySpotNotes() {
  const spots = await prisma.spot.findMany();
  for (const spot of spots) {
    const description = stripMapShareUrls(spot.description);
    if (description !== spot.description) {
      await prisma.spot.update({ where: { id: spot.id }, data: { description } });
    }
  }
}

app.listen(port, '0.0.0.0', () => {
  console.log(`haemi-api listening on ${port}`);
  void cleanupLegacySpotNotes().catch((error) => {
    console.error('failed to clean legacy spot map links', error);
  });
});
