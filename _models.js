const { app, safeStorage } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
app.setName('codecraft');
app.whenReady().then(() => {
  const raw = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'llm-config.json'), 'utf8'));
  const apiKey = safeStorage.decryptString(Buffer.from(raw.apiKey, 'base64'));
  const models = ['auto:default','test-model','claude-3-5-sonnet-latest','claude-3-5-haiku-latest','gpt-4o'];
  let i = 0;
  function next() {
    if (i >= models.length) { app.quit(); return; }
    const m = models[i++];
    const body = JSON.stringify({ model: m, max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] });
    const req = http.request({ hostname: '127.0.0.1', port: 31415, path: '/v1/messages', method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ console.log(m, '->', res.statusCode, d.slice(0,120)); next(); });
    });
    req.on('error', e => { console.log(m, 'ERR', e.message); next(); });
    req.write(body); req.end();
  }
  next();
});
