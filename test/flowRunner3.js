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

jest.setTimeout(30000);

function interp(template, ctx) {
  return template.replace(/{{([^}]+)}}/g, (_, expr) =>
    expr.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : ''), ctx)
  );
}

async function runFlow() {
  // 1) Connect & cleanup
  if (!mongoose.connection.readyState) {
    await mongoose.connect(process.env.MONGO_URI_TEST);
  }
  await mongoose.connection.db.dropDatabase();

  const app = createTestOrientedApp();
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../flows/account-manifest.json'),
      'utf8'
    )
  );
  const ctx = {};
  const pending = new Set(manifest.nodes.map((n) => n.id));
  const evidence = []; // ← record everything here

  while (pending.size) {
    let progressed = false;
    for (let node of manifest.nodes) {
      if (!pending.has(node.id)) continue;
      const parents = node.parents || [];
      if (!parents.every((p) => !pending.has(p))) continue;

      // build URL & body
      const url = interp(node.pathTemplate, ctx);
      let req = request(app)[node.method.toLowerCase()](url);
      if (node.bodyTemplate) {
        const bodyStr = JSON.stringify(node.bodyTemplate);
        req = req.send(JSON.parse(interp(bodyStr, ctx)));
      }

      // snapshot request details
      const reqSnapshot = {
        method: node.method,
        url,
        headers: node.requestHeaders,
        body: node.bodyTemplate || null,
      };

      const ts = Date.now();
      // fire it
      const res = await req.expect(node.expectedStatus || 200);

      // snapshot response details
      const actual = {
        status: res.status,
        headers: res.headers,
        body: res.body,
      };

      const expected = {
        status: node.expectedStatus || 200,
        body: node.expectedBody || null,
        headers: node.expectedResponseHeaders || null,
      };

      // stash into evidence log
      evidence.push({
        ts,
        id: node.id,
        name: node.name,
        group: node.group,
        request: reqSnapshot,
        expected,
        actual,
      });

      // capture for interpolation
      ctx[node.id] = res.body;
      pending.delete(node.id);
      progressed = true;
    }
    if (!progressed) {
      throw new Error('Circular or missing dependencies in flow manifest');
    }
  }

  // write out a timestamped evidence file
  const outPath = path.join(
    process.cwd(),
    'recordings',
    `evidence-${Date.now()}.json`
  );
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log('Wrote evidence log:', outPath);
}

export default runFlow;
