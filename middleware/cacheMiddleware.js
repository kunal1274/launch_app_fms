// cacheMiddleware.js
import { dbgRedis } from '../index.js';
import redisClient from './redisClient.js';

/**
 * Caching middleware for GET requests:
 * - Uses request URL as a simple cache key, or you can customize the key logic.
 */
export async function cacheMiddleware(req, res, next) {
  try {
    // Only cache GET requests by default. If you want to cache other methods, remove this check.
    if (req.method !== 'GET') {
      return next();
    }
    dbgRedis('cache middleware mounting');
    const cacheKey = req.originalUrl; // e.g. "/fms/api/v0/companies?archived=false"
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      // If we have cached data, return it immediately
      console.log(`📦 [Cache HIT]  ${cacheKey}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    console.log(`🚫[Cache MISS] ${cacheKey}`);
    return next(); // proceed to controller/DB
  } catch (err) {
    console.error('Error in cacheMiddleware:', err);
    return next(); // fallback if cache fails
  }
}
