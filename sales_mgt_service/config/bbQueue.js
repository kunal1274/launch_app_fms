/*
import { Queue } from "bullmq";
import IORedis from "ioredis";

let queue = null;
try {
  const connection = new IORedis();
  queue = new Queue("export-import", { connection });
  queue.on("error", (e) => {
    console.error("❌ Queue error", e?.message || e);
    console.error("Stack trace:", e?.stack);
  });

  console.log("✅ Redis queue ready");
} catch {
  console.log("ℹ️ Redis not found – queue disabled");
}

export const enqueue = async (name, data) => {
  try {
    return await queue?.add(name, data);
  } catch (e) {
    console.error(`❌ Failed to enqueue job [${name}]`, e.message);
  }
};

const worker = new Queue(
  "export-import",
  async (job) => {
    console.log(`👷 Running job: ${job.name}`, job.data);
    // do import or export here
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ Job completed [${job.name}]`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job failed [${job.name}]`, err);
});
*/
