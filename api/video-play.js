const { get } = require('@vercel/blob');
const { Readable } = require('node:stream');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET method required' });
  }

  const pathname = typeof req.query.pathname === 'string' ? req.query.pathname : '';
  if (!pathname || !pathname.startsWith('videos/') || pathname.includes('..')) {
    return res.status(400).json({ error: 'Invalid video pathname' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Video service configuration is missing' });
  }

  try {
    // Free playback is allowed only when the database marks this exact blob as Short Videos.
    const queryUrl = new URL('/rest/v1/videos', supabaseUrl.replace(/\/+$/, ''));
    queryUrl.searchParams.set('select', 'pathname,category');
    queryUrl.searchParams.set('pathname', `eq.${pathname}`);
    queryUrl.searchParams.set('limit', '1');

    const dbResponse = await fetch(queryUrl.toString(), {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!dbResponse.ok) {
      console.error('Short video access lookup failed:', dbResponse.status, await dbResponse.text());
      return res.status(502).json({ error: 'Could not verify video category' });
    }

    const rows = await dbResponse.json();
    if (!rows.length || rows[0].pathname !== pathname || rows[0].category !== 'short') {
      return res.status(403).json({ error: 'This video is not available for free playback' });
    }

    const blob = await get(pathname, { access: 'private' });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', blob.blob.contentType || 'video/mp4');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Accept-Ranges', 'none');
    if (blob.blob.size) res.setHeader('Content-Length', String(blob.blob.size));
    return Readable.fromWeb(blob.stream).pipe(res);
  } catch (error) {
    console.error('Free video playback error:', error);
    if (!res.headersSent) return res.status(500).json({ error: 'Could not play video' });
    return res.end();
  }
};
