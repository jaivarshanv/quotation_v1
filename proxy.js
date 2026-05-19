// proxy.js — Apex Industrial pricing proxy
// Routes:
//   POST /v1/email     → EmailJS REST API
//   GET  * → Static file server

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ─────────────────────────────────────────────
const PORT = process.env.PORT || 3131;

// EmailJS config (Strictly relying on environment variables for security)
const EJS_SERVICE = process.env.EMAILJS_SERVICE_ID;
const EJS_TEMPLATE = process.env.EMAILJS_TEMPLATE_ID;
const EJS_PUB_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EJS_PRIV_KEY = process.env.EMAILJS_PRIVATE_KEY;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cross-Origin-Opener-Policy': 'unsafe-none',
  'Cross-Origin-Embedder-Policy': 'unsafe-none'
};

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

// ══════════════════════════════════════════════════════
//  HTTP SERVER
// ══════════════════════════════════════════════════════
http.createServer((req, res) => {

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // ── POST /v1/email → EmailJS REST API ─────────────────
  if (req.method === 'POST' && req.url === '/v1/email') {

    // SAFETY CHECK: Ensure all EmailJS keys are present
    if (!EJS_SERVICE || !EJS_TEMPLATE || !EJS_PUB_KEY || !EJS_PRIV_KEY) {
      res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server misconfiguration: Missing one or more EmailJS environment variables.' }));
      console.error('[proxy] Email failed: Missing EmailJS environment variables.');
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let params;
      try { params = JSON.parse(body); } catch (e) {
        res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const ejsBody = JSON.stringify({
        service_id: EJS_SERVICE,
        template_id: EJS_TEMPLATE,
        user_id: EJS_PUB_KEY,
        template_params: params,
        accessToken: EJS_PRIV_KEY,
      });

      const options = {
        hostname: 'api.emailjs.com',
        port: 443,
        path: '/api/v1.0/email/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(ejsBody),
        },
      };

      const emailReq = https.request(options, emailRes => {
        let data = '';
        emailRes.on('data', chunk => data += chunk);
        emailRes.on('end', () => {
          res.writeHead(emailRes.statusCode, CORS);
          res.end(data);
          console.log(`[proxy] EmailJS ${emailRes.statusCode}`);
        });
      });

      emailReq.on('error', err => {
        res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });

      emailReq.write(ejsBody);
      emailReq.end();
    });
    return;
  }

  // ── GET * → Static file server ─────────────────────────
  if (req.method === 'GET') {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const ext = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(err.code === 'ENOENT' ? 404 : 500);
        res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error: ' + err.code);
      } else {
        res.writeHead(200, { 'Content-Type': contentType, ...CORS });
        res.end(content, 'utf-8');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');

}).listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Apex Industrial — Pricing Proxy             ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Server  : http://localhost:${PORT}             ║`);
  console.log(`║  CSV/Preset: Local engine (zero API)         ║`);
  console.log(`║  EmailJS : ${EJS_PRIV_KEY && EJS_PUB_KEY && EJS_SERVICE && EJS_TEMPLATE ? '✓ All Keys Configured' : '✗ Keys Missing (Emails will fail)'}       ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});