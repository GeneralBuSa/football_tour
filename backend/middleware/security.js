const buckets = new Map();

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return next();
}

export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, key = req => req.ip } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = key(req);
    const timestamps = (buckets.get(bucketKey) || []).filter(ts => now - ts < windowMs);
    if (timestamps.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    timestamps.push(now);
    buckets.set(bucketKey, timestamps);
    return next();
  };
}

export function validateObjectBody(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'A JSON object body is required' });
  }
  return next();
}
