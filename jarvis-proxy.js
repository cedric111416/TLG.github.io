// jarvis-proxy.js
// Lokaler Vermittler: hält deinen API-Schlüssel geheim und leitet Fragen an Claude weiter.
// Start:  ANTHROPIC_API_KEY="sk-ant-..." node jarvis-proxy.js
// (oder Schlüssel vorher exportieren, siehe Anleitung)

const http  = require('http');
const https = require('https');

const API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT    = 8787;
const MODEL   = 'claude-sonnet-4-5'; // günstig & schnell; z.B. 'claude-opus-4-8' für mehr Qualität

if (!API_KEY) {
  console.error('FEHLER: Umgebungsvariable ANTHROPIC_API_KEY ist nicht gesetzt.');
  console.error('Beispiel:  ANTHROPIC_API_KEY="sk-ant-..." node jarvis-proxy.js');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // CORS: erlaubt der lokalen HTML-Datei, mit dem Proxy zu reden
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST' || req.url !== '/ask') { res.writeHead(404); return res.end('not found'); }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    let userMsg = '';
    try { userMsg = (JSON.parse(body).message || '').toString(); } catch (e) {}

    const payload = JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: 'Du bist Jarvis, ein knapper, freundlicher Sprachassistent. Antworte kurz auf Deutsch, in ein bis drei Sätzen, ohne Aufzählungen.',
      messages: [{ role: 'user', content: userMsg }]
    });

    const apiReq = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-length': Buffer.byteLength(payload)
      }
    }, apiRes => {
      let data = '';
      apiRes.on('data', c => data += c);
      apiRes.on('end', () => {
        let text = 'Entschuldige, ich habe gerade keine Antwort bekommen.';
        try {
          const j = JSON.parse(data);
          if (j.content && j.content.length) {
            text = j.content.map(b => b.text || '').join(' ').trim();
          } else if (j.error) {
            text = 'Fehler von der API: ' + (j.error.message || 'unbekannt');
          }
        } catch (e) {}
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ reply: text }));
      });
    });

    apiReq.on('error', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ reply: 'Ich konnte den KI-Dienst nicht erreichen.' }));
    });

    apiReq.write(payload);
    apiReq.end();
  });
});

server.listen(PORT, () => console.log('Jarvis-Proxy läuft auf http://localhost:' + PORT));
