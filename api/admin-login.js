const { safeEqual, token, cookie, secret } = require('./_auth');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!secret() || !process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin is not configured' });
  }

  const password = req.body && req.body.password;

  if (typeof password !== 'string' ||
      !safeEqual(password, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', cookie(token(), 28800));
  return res.status(200).json({ ok: true });
};
