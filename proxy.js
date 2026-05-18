// proxy.js — Apex Industrial pricing proxy
// Routes:
//   POST /v1/messages  → HuggingFace Qwen2-VL-2B-Instruct (image mode only)
//   POST /v1/email     → EmailJS REST API
//   GET  * → Static file server

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ─────────────────────────────────────────────
const PORT = process.env.PORT || 3131;
const HF_TOKEN = process.env.HF_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// HuggingFace Router API (OpenAI-compatible)
const HF_HOST = 'router.huggingface.co';
const HF_PATH = '/v1/chat/completions';
const HF_MODEL = 'deepseek-ai/DeepSeek-R1';

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
//  TRANSLATOR: Anthropic format → HuggingFace Qwen2-VL-2B
// ══════════════════════════════════════════════════════

function toHFBody(raw) {
  const req = JSON.parse(raw);
  const messages = [];

  if (req.system) {
    messages.push({ role: 'system', content: req.system });
  }

  for (const msg of req.messages) {
    const content = [];
    const blocks = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];

    for (const b of blocks) {
      if (b.type === 'text') {
        content.push({ type: 'text', text: b.text });
      } else if (b.type === 'image') {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` }
        });
      }
    }
    messages.push({ role: msg.role || 'user', content });
  }

  return JSON.stringify({
    model: HF_MODEL,
    messages,
    max_tokens: req.max_tokens || 4000,
    temperature: 0.1
  });
}

function fromHFBody(raw) {
  try {
    if (raw.trim().startsWith('<')) {
      return JSON.stringify({ error: { type: 'html_response', message: 'HuggingFace returned an HTML error page. Model may be gated or unavailable.' } });
    }

    const data = JSON.parse(raw);

    if (data.estimated_time !== undefined) {
      return JSON.stringify({ error: { type: 'model_loading', message: `Model loading on HF servers (est. ${Math.ceil(data.estimated_time)}s). Please retry.` } });
    }

    if (data.error) {
      const msg = typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error);
      return JSON.stringify({ error: { type: 'api_error', message: msg } });
    }

    let text = '';
    if (Array.isArray(data) && data[0]?.generated_text !== undefined) {
      text = data[0].generated_text;
    }
    else if (data.choices?.[0]?.message?.content !== undefined) {
      text = data.choices[0].message.content;
    }
    else {
      return JSON.stringify({ error: { type: 'empty_response', message: 'HuggingFace returned no usable content. Raw: ' + raw.slice(0, 200) } });
    }

    return JSON.stringify({ content: [{ type: 'text', text }] });

  } catch (e) {
    return JSON.stringify({ error: { type: 'parse_error', message: 'Failed to parse HF response: ' + e.message + ' | Raw: ' + raw.slice(0, 200) } });
  }
}

// ══════════════════════════════════════════════════════
//  HTTP SERVER
// ══════════════════════════════════════════════════════
http.createServer((req, res) => {

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // ── POST /v1/messages → HuggingFace Qwen2-VL-2B ─────────
  if (req.method === 'POST' && req.url === '/v1/messages') {
    if (!HF_TOKEN) {
      res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'HF_TOKEN not configured. Set env var HF_TOKEN=hf_xxx to enable image mode.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let hfBody;
      try {
        hfBody = toHFBody(body);
      } catch (e) {
        res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Request parse failed: ' + e.message } }));
        return;
      }

      const options = {
        hostname: HF_HOST,
        port: 443,
        path: HF_PATH,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(hfBody),
        },
      };

      const proxyReq = https.request(options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          const translated = fromHFBody(data);
          res.writeHead(proxyRes.statusCode, { ...CORS, 'Content-Type': 'application/json' });
          res.end(translated);
          console.log(`[proxy] HF Qwen2-VL-2B ${proxyRes.statusCode} → client`);
        });
      });

      proxyReq.on('error', err => {
        console.error('[proxy] HF upstream error:', err.message);
        res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Upstream error: ' + err.message } }));
      });

      proxyReq.write(hfBody);
      proxyReq.end();
    });
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

  // ── POST /v1/gemini → Google Gemini ─────────────────
  if (req.method === 'POST' && req.url === '/v1/gemini') {
    if (!GEMINI_API_KEY) {
      res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'GEMINI_API_KEY not configured in proxy environment.' } }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const proxyReq = https.request(options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { ...CORS, 'Content-Type': 'application/json' });
          res.end(data);
          console.log(`[proxy] Gemini API ${proxyRes.statusCode}`);
        });
      });

      proxyReq.on('error', err => {
        console.error('[proxy] Gemini upstream error:', err.message);
        res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Gemini Upstream error: ' + err.message } }));
      });

      proxyReq.write(body);
      proxyReq.end();
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
  console.log(`║  Image   : HF Router → ${HF_MODEL}  ║`);
  console.log(`║  HF Token: ${HF_TOKEN ? '✓ Set' : '✗ Missing'}                             ║`);
  console.log(`║  Gemini  : ${GEMINI_API_KEY ? '✓ Set' : '✗ Missing'}                             ║`);
  console.log(`║  EmailJS : ${EJS_PRIV_KEY && EJS_PUB_KEY && EJS_SERVICE && EJS_TEMPLATE ? '✓ All Keys Configured' : '✗ Keys Missing (Emails will fail)'}       ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});