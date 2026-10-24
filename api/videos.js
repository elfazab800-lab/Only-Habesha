const { list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET method required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  // Support the newer secret name and the older project setup name.
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or Supabase server key.');
    return res.status(500).json({ error: 'Supabase environment variables are missing.' });
  }

  const baseUrl = supabaseUrl.replace(/\/+$/, '');
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: 'application/json'
  };

  try {
    // Read the columns that actually exist in this project's videos table.
    // The existing table uses video_url/storage_path, not necessarily pathname.
    const response = await fetch(
      `${baseUrl}/rest/v1/videos?select=*&order=created_at.desc`,
      { headers }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error('Supabase videos query failed:', response.status, details);
      return res.status(502).json({
        error: 'Could not load video database.',
        detail: `Supabase returned HTTP ${response.status}. Check the videos table and server key.`
      });
    }

    const rows = await response.json();
    const videos = rows
      .filter(row => row.is_published !== false)
      .map(row => {
        const videoUrl = row.video_url || row.url || '';
        const pathname = row.pathname || row.storage_path || videoUrl || '';
        return {
          id: row.id,
          title: row.title || row.original_filename || 'Habesha Video',
          description: row.description || '',
          // Keep both names so older and newer front-end code can consume the API.
          pathname,
          video_url: videoUrl,
          videoUrl,
          storage_path: row.storage_path || '',
          thumbnail_path: row.thumbnail_path || row.thumbnail_url || '',
          category: normalizeCategory(row.category),
          uploadedAt: row.uploaded_at || row.created_at || null,
          is_published: row.is_published !== false,
          mime_type: row.mime_type || ''
        };
      })
      .filter(video => video.pathname || video.videoUrl);

    return res.status(200).json({ videos });
  } catch (error) {
    console.error('Video database error:', error);
    return res.status(500).json({ error: 'Could not load video database.' });
  }
};

function normalizeCategory(value) {
  const category = String(value || 'short').trim().toLowerCase();
  if (['short', 'short video', 'short videos', 'free', 'free video'].includes(category)) return 'short';
  if (['premium', 'vip', 'premium vip', 'paid'].includes(category)) return 'premium';
  if (category === 'all' || category === 'all videos') return 'short';
  return category;
}
