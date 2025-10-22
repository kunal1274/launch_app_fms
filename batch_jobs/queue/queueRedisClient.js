// queue/queueRedis.js  ( ✱ NEW FILE ✱ )
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_USE_TLS,
} = process.env;

export const queueRedis = new Redis({
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  username: REDIS_USERNAME || undefined,
  password: REDIS_PASSWORD || undefined,
  tls: REDIS_USE_TLS === 'true' ? {} : undefined,
  // misc tuning
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

// queueRedis.on("ready", () =>
//   console.log("🟢  BullMQ redis connected →", REDIS_HOST + ":" + REDIS_PORT)
// );
// queueRedis.on("error", (e) => console.error("🔴  BullMQ redis error:", e));
