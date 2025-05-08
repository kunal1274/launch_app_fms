import { Queue, Worker, QueueScheduler, JobsOptions } from "bullmq";
import { queueRedis } from "./queueRedisClient";

/**
 * Helper that returns { queue, scheduler, addJob(data, opts) }
 * – keeps all queues under a common prefix “bb‑queues”.
 */
export function createQueue(queueName, processor) {
  const q = new Queue(queueName, {
    connection: queueRedis,
    prefix: "bb-queues",
    defaultJobOptions: /** @type {JobsOptions} */ ({
      removeOnComplete: 1000,
      removeOnFail: 1000,
    }),
  });

  // Dedicated scheduler (required for delayed / repeatable jobs)
  const qs = new QueueScheduler(queueName, {
    connection: redis,
    prefix: "bb-queues",
  });

  // Optional processor (you can attach many workers later)
  let worker;
  if (processor) {
    worker = new Worker(queueName, processor, {
      connection: redis,
      prefix: "bb-queues",
      concurrency: 5,
    });
    worker.on("completed", (job) =>
      console.log(`✅  ${queueName} job ${job.id} done`)
    );
    worker.on("failed", (job, err) =>
      console.error(`❌  ${queueName} job ${job?.id}`, err.message)
    );
  }

  const add = (data = {}, opts = {}) => q.add(queueName, data, opts);
  return { queue: q, scheduler: qs, worker, add };
}
