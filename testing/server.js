const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env.local');

// Parse .env.local for Supabase credentials
function loadEnv() {
  const env = {
    supabaseUrl: '',
    supabaseAnonKey: ''
  };

  if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const urlMatch = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

    if (urlMatch) env.supabaseUrl = urlMatch[1].trim();
    if (keyMatch) env.supabaseAnonKey = keyMatch[1].trim();
  }

  // Fallback to process.env if available
  if (!env.supabaseUrl) env.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!env.supabaseAnonKey) env.supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return env;
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = parsedUrl.pathname;

  // Configuration API Endpoint
  if (pathname === '/api/config') {
    const config = loadEnv();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
    return;
  }

  // Serve local Supabase UMD bundle directly from node_modules
  if (pathname === '/supabase.js') {
    const localSupabase = path.join(ROOT_DIR, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
    if (fs.existsSync(localSupabase)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      fs.createReadStream(localSupabase).pipe(res);
      return;
    }
  }

  // Serve static testing assets
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n==============================================`);
  console.log(`  Chatlas Auth Test Client running`);
  console.log(`  URL: ${url}`);
  console.log(`  Open or refresh your browser tab at: ${url}`);
  console.log(`  Press Ctrl+C to stop.`);
  console.log(`==============================================\n`);
});
