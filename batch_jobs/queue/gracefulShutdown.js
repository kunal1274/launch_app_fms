import { queueRedis } from "./queueRedisClient.js";

export async function shutdownQueues() {
  console.log("⏏️  Closing BullMQ / Redis …");
  await queueRedis.quit();
}
