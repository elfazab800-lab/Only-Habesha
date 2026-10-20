const crypto = require('crypto');

function secret() {
  return process.env.ADMIN_SESSION_SECRET || '';
}

function sign(value) {
  return crypto
    .createHmac('sha256', secret())
    .update(value)
    .digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));

  return x.length === y.length &&
    crypto.timingSafeEqual(x, y);
}

function token() {
  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + 8 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(16).toString('hex')
  })).toString('base64url');

  return payload + '.' + sign(payload);
}

function valid(t) {
  if (!secret() || !t) return false;

  const parts = t.split('.');
  if (parts.length !== 2) return false;

  if (!safeEqual(sign(parts[0]), parts[1])) return false;

  try {
    return JSON.parse(
      Buffer.from(parts[0], 'base64url').toString()
    ).exp > Date.now();
  } catch (e) {
    return false;
  }
}

function cookie(value, maxAge) {
  return `oh_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function getCookie(req, name) {
  const raw = req.headers.cookie || '';

  for (const part of raw.split(';')) {
    const item = part.trim();
    const i = item.indexOf('=');

    if (i > 0 && item.slice(0, i) === name) {
      return item.slice(i + 1);
    }
  }

  return '';
}

module.exports = {
  secret,
  sign,
  safeEqual,
  token,
  valid,
  cookie,
  getCookie
};
