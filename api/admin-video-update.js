const { valid, getCookie } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'PATCH method required' });
  }

  if (!valid(getCookie(req, 'oh_admin'))) {
    return res.status(401).json({ error: 'Admin login required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Supabase server configuration is missing.'
    });
  }

  const body = req.body || {};
  const id = body.id;

  if (id === undefined || id === null || String(id).trim() === '') {
    return res.status(400).json({ error: 'Video id is required.' });
  }

  const allowed = [
    'title',
    'description',
    'category',
    'thumbnail_path',
    'is_published'
  ];

  const update = {};

  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      update[field] = body[field];
    }
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'No fields to update.' });
  }

  if ('title' in update) {
    if (typeof update.title !== 'string' || !update.title.trim()) {
      return res.status(400).json({ error: 'A video title is required.' });
    }
    update.title = update.title.trim();
  }

  if ('description' in update && typeof update.description !== 'string') {
    return res.status(400).json({ error: 'Invalid description.' });
  }

  if ('category' in update) {
    if (!['short', 'premium'].includes(update.category)) {
      return res.status(400).json({
        error: 'Category must be short or premium.'
      });
    }
  }

  if (
    'thumbnail_path' in update &&
    typeof update.thumbnail_path !== 'string'
  ) {
    return res.status(400).json({ error: 'Invalid thumbnail path.' });
  }

  if (
    'is_published' in update &&
    typeof update.is_published !== 'boolean'
  ) {
    return res.status(400).json({ error: 'Invalid publish status.' });
  }

  try {
    const baseUrl = supabaseUrl.replace(/\/+$/, '');
    const queryUrl = new URL(baseUrl + '/rest/v1/videos');

    queryUrl.searchParams.set('id', 'eq.' + String(id));
    queryUrl.searchParams.set('select', 'id');

    const response = await fetch(queryUrl.toString(), {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(update)
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('Video update failed:', response.status, details);

      return res.status(502).json({
        error: 'Could not update video in database.'
      });
    }

    const rows = await response.json();

    if (!rows.length) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    return res.status(200).json({
      ok: true,
      message: 'Video updated successfully.'
    });
  } catch (error) {
    console.error('Video update API error:', error);

    return res.status(500).json({
      error: 'Could not update video.'
    });
  }
};
