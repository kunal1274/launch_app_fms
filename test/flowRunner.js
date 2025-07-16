// test/flowRunner.js
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import createTestOrientedApp from "../app.js";
// import { getLocalTimeString } from "../utility/getLocalTime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Load test ENV vars
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

// ————————————————
// Replica‐set shim for transactions
// ————————————————
let replSet;
async function ensureReplicaSet() {
  if (!replSet) {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
  }
  return replSet.getUri();
}

/**
 * Replace "{{foo.bar}}" in templates using `ctx`.
 */
function interp(template, ctx) {
  return template.replace(/{{([^}]+)}}/g, (_, expr) =>
    expr.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : ""), ctx)
  );
}

export default async function runFlow(manifestPath = null) {
  // 2) Boot a single‐node in-memory replica set & connect
  const uri = await ensureReplicaSet();
  if (!mongoose.connection.readyState) {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // replicaSet is inferred by the driver from the URI
    });
  }

  // 3) Start fresh
  await mongoose.connection.db.dropDatabase();

  // 4) Boot the app
  const app = createTestOrientedApp();

  // 5) Load manifest
  const manifestFile =
    //manifestPath || path.join(__dirname, "../flows/am/account-manifest.json");
    manifestPath ||
    path.join(__dirname, "../flows/am/gl-journal-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));

  const ctx = {};
  const pending = new Set(manifest.nodes.map((n) => n.id));
  const evidence = [];

  while (pending.size) {
    let progressed = false;

    for (const node of manifest.nodes) {
      if (!pending.has(node.id)) continue;
      const parents = node.parents || [];
      if (!parents.every((p) => !pending.has(p))) continue;

      // build request
      const url = interp(node.pathTemplate, ctx);
      let req = request(app)[node.method.toLowerCase()](url);
      if (node.bodyTemplate) {
        const body = JSON.parse(interp(JSON.stringify(node.bodyTemplate), ctx));
        req = req.send(body);
      }

      // 6) **Log what we’re about to do**:
      console.log(
        `\n→ [${node.seq || "?"}] (${node.group}) "${node.name}" → ${
          node.method
        } ${url}`
      );
      if (node.bodyTemplate) console.log("   ▶ body:", node.bodyTemplate);

      // snapshot
      const reqSnapshot = {
        method: node.method,
        url,
        headers: node.requestHeaders || {},
        body: node.bodyTemplate || null,
      };
      const ts = Date.now();

      // fire & assert
      let res;
      try {
        res = await req.expect(node.expectedStatus || 200);
      } catch (err) {
        const got = err.status || res?.status || "⚠️ no status";
        throw new Error(
          `\n‼️ Step [${node.seq}] "${node.name}" (${node.id}):\n` +
            `   expected HTTP ${node.expectedStatus || 200} but got ${got}\n` +
            `   → ${node.method} ${url}\n` +
            `   ▶ body: ${JSON.stringify(node.bodyTemplate)}\n`
        );
      }

      // record response
      const actual = {
        status: res.status,
        headers: res.headers,
        body: res.body,
      };
      const expected = {
        status: node.expectedStatus || 200,
        body: node.expectedBody
          ? JSON.parse(interp(JSON.stringify(node.expectedBody), ctx))
          : null,
        headers: node.expectedResponseHeaders || null,
      };

      evidence.push({
        ts,
        id: node.id,
        seq: node.seq,
        name: node.name,
        group: node.group,
        request: reqSnapshot,
        expected,
        actual,
      });

      // capture for downstream interpolation
      ctx[node.id] = res.body;
      pending.delete(node.id);
      progressed = true;
    }

    if (!progressed) {
      throw new Error("Circular or missing dependencies in flow manifest");
    }
  }

  // 7) Timestamp & prettify
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const filenameTimestamp =
    [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-") +
    "_" +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join(
      "-"
    );
  evidence.forEach((e) => {
    e.ts = new Date(e.ts).toLocaleString();
  });

  // 8) Write out evidence
  const outDir = path.resolve(process.cwd(), "recordings");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `evidence-${filenameTimestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log("Wrote evidence:", outPath);

  // 9) Tear down
  await mongoose.disconnect();
  await replSet.stop();
}
