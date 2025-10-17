// redisClient.js
import { createClient } from "redis";
import { dbgRedis } from "../index.js";

const {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  REDIS_USERNAME,
  REDIS_USE_TLS,
} = process.env;

const socketConfig = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
};

// If TLS is required (e.g., some Redis providers expect SSL/TLS connections)
if (REDIS_USE_TLS === "true") {
  socketConfig.tls = {};
}

// // Optionally, load ENV vars or set defaults
// const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
// const REDIS_PORT = process.env.REDIS_PORT || 6379;
// const REDIS_PASSWORD = process.env.REDIS_PASSWORD || ""; // if needed

const redisClient = createClient({
  socket: socketConfig,
  // If your provider requires username + password (for example, Redis Enterprise Cloud)
  // some providers let you do: url: `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`
  username: REDIS_USERNAME, // omit if not needed
  password: REDIS_PASSWORD, // omit if not needed
});

// Log errors for better debugging
redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

// dbgRedis("redis will be mounted ", redisClient);
// Connect right away
(async () => {
  try {
    await redisClient.connect();
    console.log(`Connected to Redis on ${REDIS_HOST}:${REDIS_PORT}`);
  } catch (err) {
    console.error("Could not connect to Redis:", err);
  }
})();

// dbgRedis("redis mounting complete ", redisClient);

export default redisClient;
