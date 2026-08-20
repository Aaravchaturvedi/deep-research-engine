// backend/src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { Redis } from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL as string);

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each user to 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: any[]) => redisClient.call(args[0],args.slice(1)) as any,
  }),
  keyGenerator: (req) => {
    // Rate limit based on the authenticated user's ID
    // @ts-ignore
    return req.userId || req.ip;
  },
  message: { error: "Too many requests, please slow down." },
});