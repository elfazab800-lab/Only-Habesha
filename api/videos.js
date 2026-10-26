module.exports = async function handler(req, res) {
res.setHeader('Cache-Control', 'no-store');
res.setHeader('Content-Type', 'application/json; charset=utf-8');

if (req.method !== 'GET') {
res.setHeader('Allow', 'GET');
return res.status(405).json({ error: 'GET method required' });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
process.env.SUPABASE_SECRET_KEY ||
process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
console.error('Missing Supabase environment variables.');
return res.status(500).json({
error: 'Supabase server configuration is missing.'
});
}

const baseUrl = supabaseUrl.replace(//+$/, '');

try {
const queryUrl = new URL("${baseUrl}/rest/v1/videos");

queryUrl.searchParams.set(
  'select',
  'id,title,description,category,pathname,storage_path,video_url,thumbnail_path,created_at,is_published,mime_type,original_filename'
);

queryUrl.searchParams.set('is_published', 'eq.true');
queryUrl.searchParams.set('order', 'created_at.desc');

const response = await fetch(queryUrl.toString(), {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: 'application/json'
  }
});

if (!response.ok) {
  const details = await response.text();
  console.error(
    'Supabase videos query failed:',
    response.status,
    details
  );

  return res.status(502).json({
    error: 'Could not load videos from the database.'
  });
}

const rows = await response.json();

const videos = rows
  .map(row => {
    const videoUrl = row.video_url || '';
    const pathname = row.pathname || row.storage_path || '';

    return {
      id: row.id,
      title: row.title || row.original_filename || 'Habesha Video',
      description: row.description || '',
      pathname,
      video_url: videoUrl,
      videoUrl,
      storage_path: row.storage_path || '',
      thumbnail_path: row.thumbnail_path || '',
      category: normalizeCategory(row.category),
      uploadedAt: row.created_at || null,
      is_published: row.is_published === true,
      mime_type: row.mime_type || ''
    };
  })
  .filter(video => video.pathname);

return res.status(200).json({ videos });

} catch (error) {
console.error('Video database error:', error);

return res.status(500).json({
  error: 'Could not load videos.'
});

}
};

function normalizeCategory(value) {
const category = String(value || 'short').trim().toLowerCase();

if (
['short', 'short video', 'short videos', 'free', 'free video']
.includes(category)
) {
return 'short';
}

if (
['premium', 'vip', 'premium vip', 'paid']
.includes(category)
) {
return 'premium';
}

return 'short';
}
