import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

import { prisma } from './db.js';
import { formatFromName, keepUpload, removeUploadsFor, storedPath, upload } from './uploads.js';

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

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'haemi-api' });
});

app.get(
  '/api/spots',
  asyncHandler(async (_req, res) => {
    const spots = await prisma.spot.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(spots);
  })
);

app.get(
  '/api/places',
  asyncHandler(async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2) {
      res.json({ places: [] });
      return;
    }
    const key = process.env.KAKAO_REST_API_KEY || '';
    if (!key) {
      throw new HttpError(503, '주소 검색이 아직 설정되지 않았습니다.');
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
    let places = (keywordJson.documents || []).map((doc) => ({
      id: doc.id || `${doc.x},${doc.y},${doc.place_name}`,
      name: doc.place_name || '',
      address: doc.road_address_name || doc.address_name || '',
    }));

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
        places = (addressJson.documents || []).map((doc) => ({
          id: `${doc.x},${doc.y},${doc.address_name}`,
          name: doc.road_address?.address_name || doc.address_name || '',
          address: doc.address_name || '',
        }));
      }
    }

    res.json({ places });
  })
);

app.post(
  '/api/spots',
  asyncHandler(async (req, res) => {
    const spot = await prisma.spot.create({
      data: {
        title: text(req.body.title, '스팟 이름'),
        place: text(req.body.place, '장소', false),
        description: text(req.body.description, '설명', false),
      },
    });
    res.status(201).json(spot);
  })
);

app.get(
  '/api/spots/:id',
  asyncHandler(async (req, res) => {
    const spot = await prisma.spot.findUnique({ where: { id: idParam(req) } });
    if (!spot) {
      throw new HttpError(404, '스팟을 찾을 수 없습니다.');
    }
    res.json(spot);
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
        ...(req.body.description != null ? { description: text(req.body.description, '설명', false) } : {}),
      },
    });
    res.json(spot);
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
    const repairs = await prisma.repair.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(repairs);
  })
);

app.post(
  '/api/repairs',
  asyncHandler(async (req, res) => {
    const repair = await prisma.repair.create({
      data: {
        title: text(req.body.title, '수리 제목'),
        place: text(req.body.place, '장소', false),
        description: text(req.body.description, '내용', false),
        status: 'pending',
      },
    });
    res.status(201).json(repair);
  })
);

app.get(
  '/api/repairs/:id',
  asyncHandler(async (req, res) => {
    const repair = await prisma.repair.findUnique({ where: { id: idParam(req) } });
    if (!repair) {
      throw new HttpError(404, '수리 내역을 찾을 수 없습니다.');
    }
    res.json(repair);
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
    });
    if (status === 'done' && previous.status !== 'done') {
      notifyRepairDone(repair.title).catch((error) => {
        console.error('repair done notification failed', error);
      });
    }
    res.json(repair);
  })
);

app.delete(
  '/api/repairs/:id',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    await prisma.repair.delete({ where: { id: idParam(req) } });
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

const voteInclude = { options: { orderBy: { id: 'asc' as const } } };

app.get(
  '/api/votes',
  asyncHandler(async (_req, res) => {
    const votes = await prisma.vote.findMany({
      orderBy: { createdAt: 'desc' },
      include: voteInclude,
    });
    res.json(votes);
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
        startsAt,
        endsAt,
        options: { create: labels.map((label: string) => ({ label })) },
      },
      include: voteInclude,
    });
    res.status(201).json(vote);
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
    res.json(vote);
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
    if (vote.startsAt.getTime() > Date.now()) {
      throw new HttpError(400, '아직 시작되지 않은 투표입니다.');
    }
    if (vote.endsAt.getTime() <= Date.now()) {
      throw new HttpError(400, '마감된 투표입니다.');
    }
    const optionId = text(req.body.optionId, '선택지');
    const option = await prisma.voteOption.findFirst({
      where: { id: optionId, voteId },
    });
    if (!option) {
      throw new HttpError(404, '선택지를 찾을 수 없습니다.');
    }
    await prisma.voteOption.update({
      where: { id: option.id },
      data: { count: { increment: 1 } },
    });
    const updated = await prisma.vote.findUniqueOrThrow({
      where: { id: voteId },
      include: voteInclude,
    });
    res.json(updated);
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

app.get(
  '/api/models',
  asyncHandler(async (_req, res) => {
    const models = await prisma.model3d.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(models);
  })
);

app.post(
  '/api/models',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const uploaded = req.file;
    const originalName = uploaded?.originalname || text(body.fileName, '파일 이름', false);
    const model = await prisma.model3d.create({
      data: {
        title: text(body.title, '이름'),
        format: text(body.format, '형식', false) || (originalName ? formatFromName(originalName) : ''),
        fileName: originalName,
        url: text(body.url, '파일 주소', false),
        description: text(body.description, '설명', false),
      },
    });
    if (uploaded) {
      keepUpload(uploaded.path, model.id, originalName);
      const saved = await prisma.model3d.update({
        where: { id: model.id },
        data: { url: `/api/models/${model.id}/file`, fileName: originalName },
      });
      res.status(201).json(saved);
      return;
    }
    res.status(201).json(model);
  })
);

app.get(
  '/api/models/:id/file',
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    const filePath = storedPath(model.id, model.fileName || 'file');
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, '저장된 파일을 찾을 수 없습니다.');
    }
    res.download(filePath, model.fileName || 'model.stl');
  })
);

app.get(
  '/api/models/:id',
  asyncHandler(async (req, res) => {
    const model = await prisma.model3d.findUnique({ where: { id: idParam(req) } });
    if (!model) {
      throw new HttpError(404, '3D 파일을 찾을 수 없습니다.');
    }
    res.json(model);
  })
);

app.patch(
  '/api/models/:id',
  adminGuard,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const uploaded = req.file;
    const originalName = uploaded?.originalname || undefined;
    if (uploaded) {
      removeUploadsFor(idParam(req));
      keepUpload(uploaded.path, idParam(req), originalName || 'file');
    }
    const body = req.body ?? {};
    const model = await prisma.model3d.update({
      where: { id: idParam(req) },
      data: {
        ...(body.title != null ? { title: text(body.title, '이름') } : {}),
        ...(body.format != null ? { format: text(body.format, '형식', false) } : {}),
        ...(body.fileName != null || originalName
          ? { fileName: originalName || text(body.fileName, '파일 이름', false) }
          : {}),
        ...(body.url != null && !uploaded ? { url: text(body.url, '파일 주소', false) } : {}),
        ...(uploaded ? { url: `/api/models/${idParam(req)}/file` } : {}),
        ...(body.description != null ? { description: text(body.description, '설명', false) } : {}),
      },
    });
    res.json(model);
  })
);

app.delete(
  '/api/models/:id',
  adminGuard,
  asyncHandler(async (req, res) => {
    const id = idParam(req);
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

function readAppRelease() {
  const metaPath = path.join(releaseDir, 'version.json');
  if (!fs.existsSync(metaPath)) {
    return { version: '1.0.0', versionCode: 0, notes: '' };
  }
  const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
    version?: string;
    versionCode?: number;
    notes?: string;
  };
  return {
    version: typeof raw.version === 'string' ? raw.version : '1.0.0',
    versionCode: Number(raw.versionCode) || 0,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  };
}

app.get('/api/app/version', (_req, res) => {
  const release = readAppRelease();
  res.json({
    ...release,
    apkUrl: '/api/app/hmfpv.apk',
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

app.listen(port, '0.0.0.0', () => {
  console.log(`haemi-api listening on ${port}`);
});
