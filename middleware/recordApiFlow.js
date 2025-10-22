import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'recordings'); // <repo>/recordings

// Make sure folder exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

export function recordApiFlow(req, res, next) {
  // Buffer the outgoing body
  const chunks = [];
  const oldSend = res.send;
  res.send = function (chunk) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk.toString() : chunk);
    return oldSend.apply(this, arguments);
  };

  res.on('finish', () => {
    // *** Sanitize dynamic bits that break determinism ***
    const sanitise = (payload) => {
      try {
        const obj = JSON.parse(payload);
        // strip Mongo ObjectIds & timestamps for snapshot stability
        const strip = (o) => {
          if (Array.isArray(o)) return o.map(strip);
          if (o && typeof o === 'object') {
            const clone = {};
            Object.entries(o).forEach(([k, v]) => {
              if (['_id', 'createdAt', 'updatedAt', '__v'].includes(k)) return;
              clone[k] = strip(v);
            });
            return clone;
          }
          return o;
        };
        return strip(obj);
      } catch {
        return payload;
      }
    };

    const record = {
      ts: Date.now(),
      method: req.method,
      path: req.originalUrl,
      body: req.body,
      status: res.statusCode,
      response: sanitise(chunks.join('')),
    };

    const fName = `${record.ts}-${req.method}-${req.originalUrl
      .replace(/\//g, '_')
      .replace(/[^a-z0-9_\-]/gi, '')}.json`;

    fs.writeFileSync(
      path.join(LOG_DIR, fName),
      JSON.stringify(record, null, 2)
    );
  });

  next();
}
