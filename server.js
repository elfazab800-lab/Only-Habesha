const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', (req, res) => {
  const name = path.basename(req.path);

  if (!/^[a-z0-9-]+$/i.test(name) || name.startsWith('_')) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const handler = require(path.join(__dirname, 'api', name + '.js'));
    if (typeof handler !== 'function') {
      return res.status(404).json({ error: 'Not found' });
    }
    return handler(req, res);
  } catch (error) {
    console.error('API route error:', error);
    return res.status(500).json({ error: 'API route failed' });
  }
});

const publicFiles = [
  'admin.html',
  'payment.html',
  'telebirr.html',
  'logo.png',
  'Picsart_26-10-28_17-10-24-126.jpg',
  'sitemap.xml',
  'robots.txt',
  'googlef2b99bfd809e2c9c.html'
];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get(publicFiles.map(file => '/' + file), (req, res) => {
  res.sendFile(path.join(__dirname, path.basename(req.path)));
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Only Habesha server listening on port ${PORT}`);
});
