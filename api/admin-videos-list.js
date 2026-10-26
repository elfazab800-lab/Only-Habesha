const { valid, getCookie } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET method required' });
  }

  const session = getCookie(req, 'oh_admin');

  if (!valid(session)) {
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

  try {
    const baseUrl = supabaseUrl.replace(/\/+$/, '');
    const queryUrl = new URL(baseUrl + '/rest/v1/videos');

    queryUrl.searchParams.set(
      'select',
      'id,title,description,category,pathname,storage_path,video_url,thumbnail_path,created_at,is_published,mime_type,original_filename'
    );

    queryUrl.searchParams.set('order', 'created_at.desc');

    const response = await fetch(queryUrl.toString(), {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: 'Bearer ' + supabaseKey,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('Admin videos query failed:', response.status, details);

      return res.status(502).json({
        error: 'Could not load videos from database.'
      });
    }

    const videos = await response.json();

    return res.status(200).json({ videos });
  } catch (error) {
    console.error('Admin videos API error:', error);

    return res.status(500).json({
      error: 'Could not load videos.'
    });
  }
};
