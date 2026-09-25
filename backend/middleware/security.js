export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return next();
}

export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, key = req => req.ip } = {}) {
  // Her limiter kendi sayaçlarını tutar. Ortak bir Map kullanıldığında genel API
  // istekleri login limitini de tüketiyor ve kullanıcılar giriş yapamıyordu.
  const buckets = new Map();
  let lastSweep = Date.now();

  return (req, res, next) => {
    const now = Date.now();
    if (now - lastSweep > windowMs) {
      for (const [bucketKey, timestamps] of buckets) {
        if (!timestamps.length || now - timestamps[timestamps.length - 1] >= windowMs) buckets.delete(bucketKey);
      }
      lastSweep = now;
    }

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
