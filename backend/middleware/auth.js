import jwt from 'jsonwebtoken';

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export function createAuthMiddleware() {
  const jwtSecret = requireEnv('JWT_SECRET');

  return function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    try {
      req.user = jwt.verify(token, jwtSecret);
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

export function requireSameUser(req, res, next) {
  const requestedUserId = req.params.userId || req.params.user_id || req.body.user_id;
  if (requestedUserId && requestedUserId !== req.user.id) {
    return res.status(403).json({ error: 'You can only access your own account data' });
  }
  return next();
}
