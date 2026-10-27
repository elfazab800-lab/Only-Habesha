const { valid, getCookie } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST method required' });
  }

  const session = getCookie(req, 'oh_admin');

  if (!valid(session)) {
    return res.status(401).json({
      error: 'Admin login required'
    });
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

  const body = req.body || {};

  const title =
    typeof body.title === 'string' ? body.title.trim() : '';

  const description =
    typeof body.description === 'string'
      ? body.description.trim()
      : '';

  const category =
    typeof body.category === 'string'
      ? body.category.trim().toLowerCase()
      : '';

  const pathname =
    typeof body.pathname === 'string'
      ? body.pathname.trim()
      : '';

  const originalFilename =
    typeof body.original_filename === 'string'
      ? body.original_filename.trim()
      : '';

  const mimeType =
    typeof body.mime_type === 'string'
      ? body.mime_type.trim()
      : '';

  const sizeBytes = Number(body.size_bytes);

  const thumbnailPath =
    typeof body.thumbnail_path === 'string'
      ? body.thumbnail_path.trim()
      : '';

  const duration =
    typeof body.duration === 'string'
      ? body.duration.trim().slice(0, 20)
      : '';

  const isPublished = body.is_published === true;

  if (!title || !pathname) {
    return res.status(400).json({
      error: 'Video title and pathname are required'
    });
  }

  if (
    !pathname.startsWith('videos/') ||
    pathname.includes('..') ||
    pathname.includes('\\')
  ) {
    return res.status(400).json({
      error: 'Invalid video pathname'
    });
  }

  if (!['short', 'premium'].includes(category)) {
    return res.status(400).json({
      error: 'Category must be short or premium'
    });
  }

  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 0
  ) {
    return res.status(400).json({
      error: 'Invalid video file size'
    });
  }

  const video = {
    title,
    description,
    category,
    pathname,
    storage_path: pathname,
    video_url: '',
    thumbnail_path: thumbnailPath || null,
    duration: duration || null,
    original_filename: originalFilename || null,
    mime_type: mimeType || null,
    size_bytes: sizeBytes,
    is_published: isPublished
  };

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/videos`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(video)
      }
    );

    if (!response.ok) {
      const details = await response.text();

      console.error('Supabase video insert failed:', details);

      return res.status(502).json({
        error: 'Could not save video to database. Check the videos table configuration.'
      });
    }

    return res.status(201).json({
      ok: true,
      message: 'Video metadata saved successfully'
    });
  } catch (error) {
    console.error('Video save error:', error);

    return res.status(500).json({
      error: 'Could not save video'
    });
  }
};
