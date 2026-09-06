import { rateLimit } from "express-rate-limit";
import Idempotency from "../models/Idempotency.js";
import { ApiError } from "../utils/error.js";

/**
 * Strip MongoDB operator keys (`$...`) and dotted keys from untrusted input
 * to block NoSQL injection / prototype-pollution style payloads.
 * Mutates the object graph in place.
 */
export function stripDangerKeys(value, seen = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) stripDangerKeys(item, seen);
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete value[key];
      continue;
    }
    stripDangerKeys(value[key], seen);
  }
}

export const sanitizeInput = (req, _res, next) => {
  stripDangerKeys(req.body);
  stripDangerKeys(req.query);
  stripDangerKeys(req.params);
  next();
};

/**
 * Optimistic-concurrency guard. When a client supplies `expectedVersion`,
 * the request is rejected with 409 unless the quote is at that version.
 * When omitted (existing clients) the guard passes silently.
 */
export const verifyVersion = (quote, expectedVersion) => {
  if (expectedVersion !== undefined && expectedVersion !== null) {
    if (quote.version !== Number(expectedVersion)) {
      throw new ApiError(409, "Quote was modified concurrently. Refresh and retry.");
    }
  }
};

/**
 * Idempotency middleware: `Idempotency-Key` header makes state-changing
 * requests safe to retry. Replays return the original response instead of
 * re-executing the action (protects negotiate/confirm/approve from
 * double-submission races).
 */
export const idempotent = (req, res, next) => {
  const key = req.headers["idempotency-key"];
  if (!key) return next();
  if (typeof key !== "string" || key.length > 128) {
    return next(new ApiError(400, "Idempotency-Key must be a string up to 128 chars"));
  }

  const actorId = String(req.user?._id || req.customer?._id || (req.user ? req.user._id : "anon"));
  const endpoint = `${req.method} ${req.originalUrl.split("?")[0]}`;

  (async () => {
    const existing = await Idempotency.findOne({ key, userId: actorId });
    if (existing) {
      return res.status(existing.statusCode).json(existing.response);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode || 200;
      const respond = () => originalJson(body);
      if (status >= 200 && status < 300) {
        return Idempotency.create({
          key,
          userId: actorId,
          endpoint,
          response: body,
          statusCode: status,
        })
          .then(respond)
          .catch((err) => {
            console.error("Idempotency store failed:", err.message);
            respond();
          });
      }
      return respond();
    };
    next();
  })().catch(next);
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Slow down." },
});