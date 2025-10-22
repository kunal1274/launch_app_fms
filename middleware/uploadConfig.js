import multer from 'multer';
import path from 'path';
import fs from 'fs';

/* ---------- generic destination ----------- */
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entity = req.params.entity; // ← "sales-orders" | "items" | "companies" …
    const dest = path.join('uploads', entity);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '');
    cb(null, `${stamp}-${file.originalname}`);
  },
});

/* ---------- whitelist & size -------------- */
const ALLOWED = [
  'application/pdf',
  'text/csv',
  'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msproject', // mpp
  'application/x-msproject',
  'application/xml', // drawio export
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'video/mp4',
  'text/plain',
  'text/html',
  'application/x-bson',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

function fileFilter(req, file, cb) {
  ALLOWED.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Unsupported file type'), false);
}

export const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter,
});
