const crypto = require('node:crypto');
const config = require('./config');

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession() {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    nonce: crypto.randomBytes(16).toString('base64url'),
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function isValidSession(value) {
  if (!value) return false;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !safeEqual(sign(payload), signature)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(session.expiresAt) && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function getCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') || [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator === -1) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }
  return null;
}

function sessionCookie(value, maxAge = SESSION_TTL_SECONDS) {
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function requireAdmin(req, res, next) {
  if (!isValidSession(getCookie(req, COOKIE_NAME))) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdminPage(req, res, next) {
  if (!isValidSession(getCookie(req, COOKIE_NAME))) return res.redirect(302, '/login');
  next();
}

function requireAdminOrBot(req, res, next) {
  if (isValidSession(getCookie(req, COOKIE_NAME))) return next();
  const suppliedKey = req.get('x-internal-api-key');
  if (config.botInternalApiKey && suppliedKey && safeEqual(config.botInternalApiKey, suppliedKey)) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

function verifyPassword(password) {
  const [algorithm, salt, expectedHex, extra] = config.adminPasswordHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex || extra) return Promise.resolve(false);

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(safeEqual(derivedKey.toString('hex'), expectedHex));
    });
  });
}

module.exports = {
  createSession,
  requireAdmin,
  requireAdminPage,
  requireAdminOrBot,
  sessionCookie,
  verifyPassword,
};
