
const { get } = require('@vercel/blob');
const { Readable } = require('node:stream');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'GET method required'
    });
  }

  const pathname =
    typeof req.query.pathname === 'string'
      ? req.query.pathname
      : '';

  if (
    !pathname ||
    pathname.startsWith('/') ||
    pathname.includes('..') ||
    pathname.includes('\\') ||
    !pathname.startsWith('videos/')
  ) {
    return res.status(400).json({
      error: 'Invalid video pathname'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    let video = null;

    // Find the published video in Supabase.
    if (supabaseUrl && supabaseKey) {
      const baseUrl = supabaseUrl.replace(/\/+$/, '');
      const queryUrl = new URL(baseUrl + '/rest/v1/videos');

      queryUrl.searchParams.set(
        'select',
        'pathname,storage_path,category,video_url,is_published'
      );
      queryUrl.searchParams.set('pathname', 'eq.' + pathname);
      queryUrl.searchParams.set('limit', '1');

      const dbResponse = await fetch(queryUrl.toString(), {
        headers: {
          apikey: supabaseKey,
          Authorization: 'Bearer ' + supabaseKey
        }
      });

      if (!dbResponse.ok) {
        console.error(
          'Video lookup failed:',
          dbResponse.status,
          await dbResponse.text()
        );

        return res.status(502).json({
          error: 'Could not verify video'
        });
      }

      const rows = await dbResponse.json();
      video = rows[0] || null;

      // Some existing rows may use storage_path instead.
      if (!video) {
        const fallbackUrl = new URL(
          baseUrl + '/rest/v1/videos'
        );

        fallbackUrl.searchParams.set(
          'select',
          'pathname,storage_path,category,video_url,is_published'
        );
        fallbackUrl.searchParams.set(
          'storage_path',
          'eq.' + pathname
        );
        fallbackUrl.searchParams.set('limit', '1');

        const fallbackResponse = await fetch(
          fallbackUrl.toString(),
          {
            headers: {
              apikey: supabaseKey,
              Authorization: 'Bearer ' + supabaseKey
            }
          }
        );

        if (fallbackResponse.ok) {
          const fallbackRows = await fallbackResponse.json();
          video = fallbackRows[0] || null;
        }
      }
    }

    if (!video || video.is_published !== true) {
      return res.status(404).json({
        error: 'Published video not found'
      });
    }

    const category = String(video.category || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');

    // Only free Short Videos may use this endpoint.
    const isShortVideo = [
      'short',
      'short video',
      'short videos'
    ].includes(category);

    if (!isShortVideo) {
      return res.status(403).json({
        error: 'This video is not available for free playback'
      });
    }

    // New videos stored in private Vercel Blob.
    if (pathname.startsWith('videos/')) {
      const blob = await get(pathname, {
        access: 'private'
      });

      if (!blob || blob.statusCode !== 200 || !blob.stream) {
        return res.status(404).json({
          error: 'Video file not found in private Blob storage'
        });
      }

      res.statusCode = 200;
      res.setHeader(
        'Content-Type',
        blob.blob.contentType || 'video/mp4'
      );
      res.setHeader('Content-Disposition', 'inline');

      if (blob.blob.size != null) {
        res.setHeader('Content-Length', String(blob.blob.size));
      }

      return Readable.fromWeb(blob.stream).pipe(res);
    }

    // Legacy Supabase public videos.
    const videoUrl =
      typeof video.video_url === 'string'
        ? video.video_url
        : '';

    const baseUrl = supabaseUrl.replace(/\/+$/, '');
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
        error: 'Could not retrieve legacy video'
      });
    }

    res.statusCode = 200;
    res.setHeader(
      'Content-Type',
      videoResponse.headers.get('content-type') || 'video/mp4'
    );
    res.setHeader('Content-Disposition', 'inline');

    const length = videoResponse.headers.get('content-length');
    if (length) {
      res.setHeader('Content-Length', length);
    }

    return Readable.fromWeb(videoResponse.body).pipe(res);
  } catch (error) {
    console.error('Video playback error:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Could not play video. Check Blob configuration.'
      });
    }

    return res.end();
  }
};
