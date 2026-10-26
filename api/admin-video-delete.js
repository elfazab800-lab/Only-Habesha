const { valid, getCookie } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'DELETE method required' });
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

  try {
    const baseUrl = supabaseUrl.replace(/\/+$/, '');
    const queryUrl = new URL(baseUrl + '/rest/v1/videos');

    queryUrl.searchParams.set('id', 'eq.' + String(id));
    queryUrl.searchParams.set('select', 'id');

    const response = await fetch(queryUrl.toString(), {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: 'Bearer ' + supabaseKey,
        Accept: 'application/json',
        Prefer: 'return=representation'
      }
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('Video delete failed:', response.status, details);

      return res.status(502).json({
        error: 'Could not delete video from database.'
      });
    }

    const rows = await response.json();

    if (!rows.length) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    return res.status(200).json({
      ok: true,
      message: 'Video record deleted successfully.'
    });
  } catch (error) {
    console.error('Video delete API error:', error);

    return res.status(500).json({
      error: 'Could not delete video.'
    });
  }
};
