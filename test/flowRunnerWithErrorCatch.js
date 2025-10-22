// test/flowRunner.js
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import createTestOrientedApp from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Load test ENV vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// —————————————————
// Replica-set shim for transactions
// —————————————————
let replSet;
async function ensureReplicaSet() {
  if (!replSet) {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
  }
  return replSet.getUri();
}

/**
 * Replace "{{foo.bar}}" in templates using `ctx`.
 */
function interp(template, ctx) {
  return template.replace(/{{([^}]+)}}/g, (_, expr) =>
    expr.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : ''), ctx)
  );
}

export default async function runFlow(manifestPath = null) {
  // 2) Boot a single-node in-memory replica set & connect
  const uri = await ensureReplicaSet();
  if (!mongoose.connection.readyState) {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }

  // 3) Start fresh
  await mongoose.connection.db.dropDatabase();

  // 4) Boot the app
  const app = createTestOrientedApp();

  // 5) Load manifest
  const manifestFile =
    // manifestPath || path.join(__dirname, "../flows/am/account-manifest.json");
    manifestPath ||
    path.join(__dirname, '../flows/am/gl-journal-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

  const ctx = {};
  const pending = new Set(manifest.nodes.map((n) => n.id));
  const evidence = [];

  // Track whether any step failed
  let anyFailed = false;
  let anyFailedSeq = [];

  // 6) Execute steps, capturing errors but never stopping
  while (pending.size) {
    let progressed = false;

    for (const node of manifest.nodes) {
      if (!pending.has(node.id)) continue;
      const parents = node.parents || [];
      if (!parents.every((p) => !pending.has(p))) continue;

      // interpolate URL and body
      const url = interp(node.pathTemplate, ctx);
      let req = request(app)[node.method.toLowerCase()](url);
      if (node.bodyTemplate) {
        const body = JSON.parse(interp(JSON.stringify(node.bodyTemplate), ctx));
        req = req.send(body);
      }

      console.log(
        `\n→ [${node.seq || '?'}] (${node.group}) "${node.name}" → ${
          node.method
        } ${url}`
      );
      if (node.bodyTemplate) console.log('   ▶ body:', node.bodyTemplate);

      const reqSnapshot = {
        method: node.method,
        url,
        headers: node.requestHeaders || {},
        body: node.bodyTemplate || null,
      };
      const ts = Date.now();

      // fire the request, catching any mismatch
      let res,
        stepError = null;
      try {
        res = await req.expect(node.expectedStatus || 200);
      } catch (err) {
        stepError = err;
        // SuperTest puts the response on err.response
        res = err.response || {};
      }

      // build actual result
      const actual = {
        status: res.status || stepError?.status || 'ERR',
        headers: res.headers || {},
        body:
          res.body != null
            ? res.body
            : { error: stepError?.message || String(stepError) },
      };

      // build expected snapshot
      const expected = {
        status: node.expectedStatus || 200,
        body: node.expectedBody
          ? JSON.parse(interp(JSON.stringify(node.expectedBody), ctx))
          : null,
        headers: node.expectedResponseHeaders || null,
      };

      // record pass/fail
      const passed = actual.status === expected.status;
      if (!passed) {
        anyFailedSeq.push({
          id: node.id,
          seq: node.seq,
          name: node.name,
        });
        anyFailed = true;
      }

      evidence.push({
        ts,
        id: node.id,
        seq: node.seq,
        name: node.name,
        group: node.group,
        request: reqSnapshot,
        expected,
        actual,
        passed,
      });

      // allow interpolation even on failure
      ctx[node.id] = res.body || {};

      // mark done
      pending.delete(node.id);
      progressed = true;
    }

    if (!progressed) {
      throw new Error('Circular or missing dependencies in flow manifest');
    }
  }

  // 7) Write out evidence (always)
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filenameTimestamp =
    [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('-') +
    '_' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join(
      '-'
    );
  evidence.forEach((e) => {
    e.ts = new Date(e.ts).toLocaleString();
  });

  const outDir = path.resolve(process.cwd(), 'recordings');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `evidence-${filenameTimestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2), 'utf8');
  console.log('Wrote evidence:', outPath);
  if (!anyFailed) {
    console.log(`Total Test Cases Passed : ${evidence.length}`);
  }

  // 8) Tear down
  await mongoose.disconnect();
  await replSet.stop();

  // 9) Fail the test if any step didn’t pass
  if (anyFailed) {
    console.log(
      `Failed Log Sequences count is : ${anyFailedSeq.length} and failed data is `,
      anyFailedSeq
    );
    throw new Error(
      'One or more steps did not match their expected results (see evidence).'
    );
  }
}
