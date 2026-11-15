const { app, safeStorage } = require('electron');
const http = require('http');
const fs = require('fs');

// safeStorage keyring is keyed by the app name — must match the app that saved the config.
app.setName('codecraft');

app.whenReady().then(() => {
  const file = '/Users/alfie/Library/Application Support/codecraft/llm-config.json';
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const apiKey = safeStorage.decryptString(Buffer.from(raw.apiKey, 'base64'));

  let baseUrl = raw.baseUrl.replace(/\/+$/, '');
  if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.slice(0, -3);
  const url = new URL(baseUrl + '/v1/messages');
  const body = JSON.stringify({
    model: raw.modelId || 'claude-3-5-sonnet-latest',
    max_tokens: 20,
    messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }]
  });

  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    },
    (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        console.log(JSON.stringify({ status: res.statusCode, snippet: data.slice(0, 200) }));
        app.quit();
      });
    }
  );
  req.on('error', (err) => {
    console.log(JSON.stringify({ status: 0, error: err.message }));
    app.quit();
  });
  req.write(body);
  req.end();
});
