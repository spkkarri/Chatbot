// server/middleware/cacheMiddleware.js
const { redisClient } = require('../config/redisClient');

const cacheMiddleware = (durationInSeconds) => async (req, res, next) => {
    if (!redisClient || !redisClient.isOpen || req.method !== 'GET') {
        return next();
    }

    const key = `__express__${req.originalUrl || req.url}`;
    try {
        const cachedResponse = await redisClient.get(key);
        if (cachedResponse) {
            res.setHeader('X-Cache', 'HIT');
            res.send(JSON.parse(cachedResponse));
            return;
        }

        res.setHeader('X-Cache', 'MISS');
        const originalSend = res.send;

        res.send = (body) => {
            // Only cache successful 2xx responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                redisClient.setEx(key, durationInSeconds, JSON.stringify(body)).catch(err => {
                    console.error(`Redis SETEX error for key ${key}:`, err);
                });
            }
            return originalSend.call(res, body);
        };
        next();
    } catch (err) {
        console.error('Redis cache middleware error:', err);
        next();
    }
};

module.exports = { cacheMiddleware };