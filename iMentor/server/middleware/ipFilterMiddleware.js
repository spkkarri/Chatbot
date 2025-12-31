const ADMIN_IP_WHITELIST = (process.env.ADMIN_IP_WHITELIST || '127.0.0.1,::1').split(',');

const ipFilterMiddleware = (req, res, next) => {
    // 'ip' is the most direct, but 'x-forwarded-for' is needed if behind a proxy like Nginx or a load balancer.
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Normalize IPv6 localhost addresses
    const normalizedClientIp = clientIp === '::ffff:127.0.0.1' ? '127.0.0.1' : clientIp;

    if (ADMIN_IP_WHITELIST.includes(normalizedClientIp)) {
        // IP is in the whitelist, proceed to the next middleware (which is the admin auth)
        return next();
    }

    // IP is not in the whitelist, log the attempt and deny access
    console.warn(`[Security] Denied access to admin route for untrusted IP: ${clientIp}`);
    return res.status(403).json({ message: 'Forbidden: Access from your IP address is not permitted.' });
};

module.exports = { ipFilterMiddleware };
