
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET method required' });
  }

  const pathname =
    typeof req.query.pathname === 'string' ? req.query.pathname : '';

  if (
    !pathname ||
    pathname.startsWith('/') ||
    pathname.includes('..') ||
    pathname.includes('\\')
  ) {
    return res.status(400).json({ error: 'Invalid video pathname' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Supabase server configuration is missing'
    });
  }

  try {
    const baseUrl = supabaseUrl.replace(/\/+$/, '');
    const queryUrl = new URL(baseUrl + '/rest/v1/videos');

    queryUrl.searchParams.set('select', 'pathname,category,video_url');
    queryUrl.searchParams.set('pathname', 'eq.' + pathname);
    queryUrl.searchParams.set('limit', '1');

    const dbResponse = await fetch(queryUrl.toString(), {
      headers: {
        apikey: supabaseKey,
        Authorization: 'Bearer ' + supabaseKey
      }
    });

    if (!dbResponse.ok) {
      console.error('Video lookup failed:', dbResponse.status);
      return res.status(502).json({ error: 'Could not verify video' });
    }

    const rows = await dbResponse.json();
    const video = rows[0];

if (
  !video ||
  String(video.category || '').toLowerCase() !== 'short'
) {
      return res.status(403).json({
        error: 'This video is not available for free playback'
      });
    }

    const videoUrl =
      typeof video.video_url === 'string' ? video.video_url : '';

    const expectedPrefix =
      baseUrl + '/storage/v1/object/public/videos/';

    if (!videoUrl.startsWith(expectedPrefix)) {
      return res.status(404).json({
        error: 'Supabase video URL is missing or invalid'
      });
    }

    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok || !videoResponse.body) {
      return res.status(502).json({
        error: 'Could not retrieve video file'
      });
    }

    res.statusCode = 200;
    res.setHeader(
      'Content-Type',
      videoResponse.headers.get('content-type') || 'video/mp4'
    );
    res.setHeader('Content-Disposition', 'inline');

    const length = videoResponse.headers.get('content-length');
    if (length) res.setHeader('Content-Length', length);

    const { Readable } = require('node:stream');
    return Readable.fromWeb(videoResponse.body).pipe(res);
  } catch (error) {
    console.error('Supabase video playback error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Could not play video' });
    }
    return res.end();
  }
};
