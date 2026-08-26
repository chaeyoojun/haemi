import fs from 'node:fs';
import path from 'node:path';

import multer from 'multer';

export const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

export const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 80 * 1024 * 1024 },
});

export function storedPath(id: string, fileName: string) {
  const ext = path.extname(fileName).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12);
  return path.join(uploadDir, `${id}${ext}`);
}

export function keepUpload(tempPath: string, id: string, fileName: string) {
  const dest = storedPath(id, fileName);
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { force: true });
  }
  fs.renameSync(tempPath, dest);
  return dest;
}

export function removeUploadsFor(id: string) {
  if (!fs.existsSync(uploadDir)) {
    return;
  }
  for (const name of fs.readdirSync(uploadDir)) {
    if (name === id || name.startsWith(`${id}.`)) {
      fs.rmSync(path.join(uploadDir, name), { force: true });
    }
  }
}

export function formatFromName(fileName: string) {
  return path.extname(fileName).replace('.', '').toUpperCase();
}
