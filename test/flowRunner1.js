import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import request from 'supertest';

import { fileURLToPath } from 'url';
import createTestOrientedApp from '../app.js';

// allow longer flows
jest.setTimeout(30000);

// __dirname helper for ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// pick up manifest path from args or default
const manifestPath =
  process.argv[2] || path.join(__dirname, '../flows/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// simple interpolation of {{node.key}} against ctx
function interp(template, ctx) {
  return template.replace(/{{([^}]+)}}/g, (_, expr) =>
    expr.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : ''), ctx)
  );
}

async function runFlow() {
  // 1) connect & reset
  if (!mongoose.connection.readyState) {
    await mongoose.connect(process.env.MONGO_URI_TEST);
  }
  await mongoose.connection.db.dropDatabase();

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

      // build URL
      const url = interp(node.pathTemplate, ctx);
      let req = request(app)[node.method.toLowerCase()](url);
      if (node.bodyTemplate) {
        const body = JSON.parse(interp(JSON.stringify(node.bodyTemplate), ctx));
        req = req.send(body);
      }

      // snapshot request
      const reqSnapshot = {
        method: node.method,
        url,
        headers: node.requestHeaders || {},
        body: node.bodyTemplate || null,
      };

      const ts = Date.now();
      // fire
      const res = await req.expect(node.expectedStatus || 200);

      // snapshot response
      const actual = {
        status: res.status,
        headers: res.headers,
        body: res.body,
      };
      const expected = {
        status: node.expectedStatus || 200,
        headers: node.expectedResponseHeaders || null,
        body: node.expectedBody || null,
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

      // stash
      ctx[node.id] = res.body;
      pending.delete(node.id);
      progressed = true;
    }
    if (!progressed)
      throw new Error('Circular or missing dependencies in flow manifest');
  }

  // dump evidence
  const outDir = path.join(process.cwd(), 'recordings');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `evidence-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(evidence, null, 2));
  console.log('Wrote evidence log:', outFile);
}

export default runFlow;
