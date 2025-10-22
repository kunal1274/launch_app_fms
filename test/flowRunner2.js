// test/flowRunner.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import createTestOrientedApp from '../app.js';

// ───────────────────────────────────────────────────────────────────────────────
// bootstrap dotenv
// ───────────────────────────────────────────────────────────────────────────────
dotenv.config({
  path: path.resolve(process.cwd(), '.env.test'),
});

// ───────────────────────────────────────────────────────────────────────────────
// load manifest
// ───────────────────────────────────────────────────────────────────────────────
const manifestPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), 'flows/manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error(` ✖ manifest not found at ${manifestPath}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// ───────────────────────────────────────────────────────────────────────────────
// simple interpolation helper
// ───────────────────────────────────────────────────────────────────────────────
function interp(template, ctx) {
  return template.replace(/{{([^}]+)}}/g, (_, expr) =>
    expr.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : ''), ctx)
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// main runner
// ───────────────────────────────────────────────────────────────────────────────
export default async function runFlow() {
  // 1) connect & cleanup
  if (!mongoose.connection.readyState) {
    await mongoose.connect(process.env.MONGO_URI_TEST);
  }
  await mongoose.connection.db.dropDatabase();

  // 2) spin up app
  const app = createTestOrientedApp();

  const ctx = {};
  const pending = new Set(manifest.nodes.map((n) => n.id));
  const evidence = [];

  while (pending.size) {
    let progressed = false;

    for (const node of manifest.nodes) {
      if (!pending.has(node.id)) continue;
      const parents = node.parents || [];
      if (!parents.every((p) => !pending.has(p))) continue;

      // ─── build URL & request ───────────────────────────────────────────────
      const url = interp(node.pathTemplate, ctx);
      let req = request(app)[node.method.toLowerCase()](url);
      if (node.bodyTemplate) {
        const bodyStr = JSON.stringify(node.bodyTemplate);
        req = req.send(JSON.parse(interp(bodyStr, ctx)));
      }

      // ─── snapshot request ───────────────────────────────────────────────────
      const reqSnapshot = {
        method: node.method,
        url,
        headers: node.requestHeaders || {},
        body: node.bodyTemplate
          ? JSON.parse(interp(JSON.stringify(node.bodyTemplate), ctx))
          : null,
      };

      // ─── fire & await ───────────────────────────────────────────────────────
      const ts = Date.now();
      const res = await req.expect(node.expectedStatus || 200);

      // ─── snapshot response ──────────────────────────────────────────────────
      const actual = {
        status: res.status,
        headers: res.headers,
        body: res.body,
      };
      const expected = {
        status: node.expectedStatus || 200,
        body:
          node.expectedBody !== undefined
            ? JSON.parse(interp(JSON.stringify(node.expectedBody), ctx))
            : null,
        headers: node.expectedResponseHeaders || null,
      };

      evidence.push({
        ts,
        id: node.id,
        name: node.name,
        group: node.group,
        request: reqSnapshot,
        expected,
        actual,
      });

      // ─── stash for later interpolation ───────────────────────────────────────
      ctx[node.id] = res.body;
      pending.delete(node.id);
      progressed = true;
    }

    if (!progressed) {
      throw new Error(
        'Circular or missing dependencies in flow manifest – could not make progress'
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // write evidence log
  // ───────────────────────────────────────────────────────────────────────────────
  const outDir = path.resolve(process.cwd(), 'recordings');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `evidence-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log('✔ wrote evidence log to', outPath);

  // close
  await mongoose.disconnect();
}

// ───────────────────────────────────────────────────────────────────────────────
// if invoked directly via `node test/flowRunner.js …`, run it
// ───────────────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1].endsWith(path.basename(__filename))) {
  runFlow().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
