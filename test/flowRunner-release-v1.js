import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import request from "supertest";
import createTestOrientedApp from "../app.js";
import { getLocalTimeString } from "../utility/getLocalTime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Load test ENV vars
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

/**
 * Replace "{{foo.bar}}" in templates using `ctx`.
 */
function interp(template, ctx) {
  return template.replace(/{{([^}]+)}}/g, (_, expr) =>
    expr.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : ""), ctx)
  );
}

export default async function runFlow(manifestPath = null) {
  // 2) Connect / clean
  if (!mongoose.connection.readyState) {
    await mongoose.connect(process.env.MONGO_URI_TEST);
  }
  await mongoose.connection.db.dropDatabase();

  // 3) Boot the app
  const app = createTestOrientedApp();

  // 4) Load manifest
  const manifestFile =
    manifestPath || path.join(__dirname, "../flows/am/account-manifest.json");
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

      // 2) **Log what we’re about to do**:
      console.log(
        `\n→ [${node.seq || "?"}] (${node.group}) "${node.name}" → ${
          node.method
        } ${url}`
      );
      if (node.bodyTemplate) console.log("   ▶ body:", node.bodyTemplate);

      // record request snapshot
      const reqSnapshot = {
        method: node.method,
        url,
        headers: node.requestHeaders || {},
        body: node.bodyTemplate || null,
      };

      const ts = Date.now();

      // 3) Fire & assert, but catch failures to re-throw with context
      let res;
      // const res = await req.expect(node.expectedStatus || 200);
      try {
        res = await req.expect(node.expectedStatus || 200);
      } catch (err) {
        // SuperTest’s err.status contains the actual status
        // const got = err.status || err.expected;
        // throw new Error(
        //   `Step [${node.seq}] "${node.name}" (${node.id}): expected HTTP ${
        //     node.expectedStatus || 200
        //   } but got ${got}\n` +
        //     `  → ${node.method} ${url}\n` +
        //     `  ▶ body: ${JSON.stringify(node.bodyTemplate)}`
        // );
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

  // 1) Build a local‐time ISO-like string for the evidence file name
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const filenameTimestamp =
    [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-") +
    "_" +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join(
      "-"
    );

  // 2) Also convert each entry’s `ts` into a human-readable local string
  evidence.forEach((entry) => {
    // overwrite the numeric ts with a local string:
    entry.ts = new Date(entry.ts).toLocaleString();
  });

  // 3) Ensure the recordings folder exists
  const outDir = path.resolve(process.cwd(), "recordings");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // const outPath = path.join(outDir, `evidence-${Date.now()}.json`);
  // 4) Write the file
  const outPath = path.join(outDir, `evidence-${filenameTimestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log("Wrote evidence:", outPath);

  // prune to keep only last 100 evidence files ( Not Required as of now )
  // const allFiles = fs
  //   .readdirSync(outDir)
  //   .filter((f) => f.startsWith("evidence-") && f.endsWith(".json"))
  //   .sort(); // lexicographic sort == chronological for our names
  // if (allFiles.length > 100) {
  //   const toRemove = allFiles.slice(0, allFiles.length - 100);
  //   toRemove.forEach((f) => fs.unlinkSync(path.join(outDir, f)));
  // }

  await mongoose.disconnect();
}
