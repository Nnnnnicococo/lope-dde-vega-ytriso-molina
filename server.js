#!/usr/bin/env node

const http = require('http');
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.PORT || 3333;
const WHISPER_SCRIPT = path.join(__dirname, 'whisper_transcribe.py');
const OUTPUT_DIR = path.join(__dirname, 'Cerebro_Central', 'sistema');

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok → Claude Code</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0f;
      color: #e8e8f0;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 760px; margin: 0 auto; }
    h1 {
      font-size: 1.6rem;
      font-weight: 600;
      margin-bottom: 6px;
      background: linear-gradient(135deg, #a78bfa, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle { color: #6b7280; font-size: 0.9rem; margin-bottom: 32px; }

    .input-section { margin-bottom: 20px; }
    label { display: block; font-size: 0.8rem; color: #9ca3af; margin-bottom: 8px; letter-spacing: 0.05em; text-transform: uppercase; }
    textarea {
      width: 100%;
      background: #111118;
      border: 1px solid #2a2a3a;
      border-radius: 10px;
      color: #e8e8f0;
      font-size: 0.95rem;
      padding: 14px 16px;
      resize: vertical;
      min-height: 110px;
      outline: none;
      transition: border-color 0.2s;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    textarea:focus { border-color: #7c3aed; }
    textarea::placeholder { color: #3d3d55; }

    .options { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
    select {
      background: #111118;
      border: 1px solid #2a2a3a;
      border-radius: 8px;
      color: #e8e8f0;
      padding: 8px 12px;
      font-size: 0.85rem;
      outline: none;
      cursor: pointer;
    }
    .opt-label { font-size: 0.8rem; color: #6b7280; }

    button {
      background: linear-gradient(135deg, #7c3aed, #3b82f6);
      border: none;
      border-radius: 10px;
      color: #fff;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 600;
      padding: 12px 28px;
      transition: opacity 0.2s, transform 0.1s;
    }
    button:hover { opacity: 0.9; transform: translateY(-1px); }
    button:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    .progress {
      display: none;
      background: #111118;
      border: 1px solid #2a2a3a;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 20px;
      font-size: 0.85rem;
      font-family: 'SF Mono', monospace;
    }
    .progress.active { display: block; }
    .log-line { color: #6b7280; line-height: 1.8; }
    .log-line.current { color: #a78bfa; }
    .log-line.done { color: #34d399; }
    .log-line.error { color: #f87171; }

    .results { display: none; }
    .results.visible { display: block; }

    .card {
      background: #111118;
      border: 1px solid #2a2a3a;
      border-radius: 12px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid #2a2a3a;
    }
    .card-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; }
    .badge { font-size: 0.7rem; background: #1e1e2e; color: #7c3aed; padding: 2px 8px; border-radius: 20px; }
    .copy-btn {
      background: #1e1e2e;
      border: 1px solid #2a2a3a;
      border-radius: 6px;
      color: #9ca3af;
      cursor: pointer;
      font-size: 0.75rem;
      padding: 4px 10px;
      transition: all 0.15s;
    }
    .copy-btn:hover { background: #2a2a3a; color: #e8e8f0; transform: none; }
    .card-body {
      padding: 16px 18px;
      font-size: 0.88rem;
      line-height: 1.7;
      color: #d1d5db;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .prompt-body {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.82rem;
      background: #0d0d14;
    }

    .divider { margin: 24px 0; border: none; border-top: 1px solid #1e1e2e; }
    .url-result-header { font-size: 0.75rem; color: #7c3aed; margin-bottom: 12px; font-family: monospace; }
  </style>
</head>
<body>
<div class="container">
  <h1>TikTok → Claude Code</h1>
  <p class="subtitle">Pegá uno o varios links de TikTok, uno por línea. Te devuelve la transcripción, resumen y prompt listo para usar.</p>

  <div class="input-section">
    <label>Links de TikTok</label>
    <textarea id="urls" placeholder="https://www.tiktok.com/@usuario/video/123456789&#10;https://www.tiktok.com/@otro/video/987654321"></textarea>
  </div>

  <div class="options">
    <span class="opt-label">Modelo Whisper:</span>
    <select id="model">
      <option value="base">Base (rápido)</option>
      <option value="small">Small (mejor)</option>
      <option value="medium">Medium (lento)</option>
    </select>
    <button id="btn" onclick="process()">Procesar</button>
  </div>

  <div class="progress" id="progress"></div>
  <div class="results" id="results"></div>
</div>

<script>
function log(msg, type='current') {
  const p = document.getElementById('progress');
  p.classList.add('active');
  const prev = p.querySelector('.log-line.current');
  if (prev) prev.className = 'log-line done';
  const line = document.createElement('div');
  line.className = \`log-line \${type}\`;
  line.textContent = msg;
  p.appendChild(line);
  p.scrollTop = p.scrollHeight;
}

function copyText(id) {
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = el.closest('.card').querySelector('.copy-btn');
    btn.textContent = '✓ Copiado';
    setTimeout(() => btn.textContent = 'Copiar', 1500);
  });
}

function renderResult(url, data) {
  const results = document.getElementById('results');
  results.classList.add('visible');
  const div = document.createElement('div');
  const short = url.length > 60 ? url.slice(0, 57) + '...' : url;
  div.innerHTML = \`
    <p class="url-result-header">↳ \${short}</p>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Transcripción</span>
        <span class="badge">\${data.language || 'auto'}</span>
        <button class="copy-btn" onclick="copyText('t_\${data.id}')">Copiar</button>
      </div>
      <div class="card-body" id="t_\${data.id}">\${data.transcript}</div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Resumen</span>
        <button class="copy-btn" onclick="copyText('s_\${data.id}')">Copiar</button>
      </div>
      <div class="card-body" id="s_\${data.id}">\${data.summary}</div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Prompt para Claude Code</span>
        <button class="copy-btn" onclick="copyText('p_\${data.id}')">Copiar</button>
      </div>
      <div class="card-body prompt-body" id="p_\${data.id}">\${data.prompt}</div>
    </div>
    <hr class="divider">
  \`;
  results.appendChild(div);
}

async function process() {
  const raw = document.getElementById('urls').value.trim();
  if (!raw) return;
  const urls = raw.split('\\n').map(u => u.trim()).filter(Boolean);
  if (!urls.length) return;

  const model = document.getElementById('model').value;
  const btn = document.getElementById('btn');
  btn.disabled = true;
  document.getElementById('progress').innerHTML = '';
  document.getElementById('progress').classList.remove('active');
  document.getElementById('results').innerHTML = '';
  document.getElementById('results').classList.remove('visible');

  log('Iniciando procesamiento...');

  try {
    const res = await fetch('/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, model })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = JSON.parse(line.slice(6));
        if (data.type === 'log') log(data.msg);
        if (data.type === 'error') log('✗ ' + data.msg, 'error');
        if (data.type === 'result') renderResult(data.url, data);
        if (data.type === 'done') log('✓ Todo listo — resultados guardados en Cerebro_Central/sistema/', 'done');
      }
    }
  } catch (e) {
    log('Error de conexión: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}
</script>
</body>
</html>`;

function send(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

function downloadAudio(url, tmpDir) {
  const outputTemplate = path.join(tmpDir, 'audio.%(ext)s');
  execSync(
    `yt-dlp --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" "${url}"`,
    { stdio: 'pipe' }
  );
  const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('audio'));
  if (!files.length) throw new Error('yt-dlp no generó archivo de audio');
  return path.join(tmpDir, files[0]);
}

function transcribe(audioPath, model) {
  const result = spawnSync('python3', [WHISPER_SCRIPT, audioPath, model], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 600000,
  });
  if (result.error) throw new Error(result.error.message);
  const parsed = JSON.parse(result.stdout);
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}

function runClaude(prompt) {
  const result = spawnSync('claude', ['-p', prompt], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120000,
  });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(result.stderr || 'claude falló');
  return result.stdout.trim();
}

function saveResult(url, transcript, language, summary, prompt) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUTPUT_DIR, `tiktok_${ts}.md`);
  fs.writeFileSync(file, `# TikTok → Prompt\n**Fecha:** ${new Date().toISOString()}\n**URL:** ${url}\n**Idioma:** ${language}\n\n---\n\n## Transcripción\n\n${transcript}\n\n---\n\n## Resumen\n\n${summary}\n\n---\n\n## Prompt para Claude Code\n\n\`\`\`\n${prompt}\n\`\`\`\n`, 'utf8');
  return file;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML);
  }

  if (req.method === 'POST' && req.url === '/process') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { urls, model = 'base' } = JSON.parse(body);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      (async () => {
        let idx = 0;
        for (const url of urls) {
          idx++;
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-'));
          try {
            send(res, { type: 'log', msg: `[${idx}/${urls.length}] Descargando audio...` });
            const audioPath = downloadAudio(url, tmpDir);

            send(res, { type: 'log', msg: `[${idx}/${urls.length}] Transcribiendo con Whisper (${model})...` });
            const { text: transcript, language } = transcribe(audioPath, model);

            send(res, { type: 'log', msg: `[${idx}/${urls.length}] Generando resumen con Claude...` });
            const summary = runClaude(`Aquí está la transcripción de un video de TikTok. Escribe un resumen conciso en español (máximo 5 oraciones) que capture los puntos clave, el tema principal y el tono. Solo el resumen, sin introducción ni cierre.\n\nTRANSCRIPCIÓN:\n${transcript}`);

            send(res, { type: 'log', msg: `[${idx}/${urls.length}] Generando prompt para Claude Code...` });
            const claudePrompt = runClaude(`Basándote en esta transcripción de TikTok y su resumen, crea un prompt preciso y accionable para Claude Code. Debe describir una tarea de software, contenido o análisis ejecutable directamente. Específico, con contexto suficiente, listo para usar. Solo el prompt, sin explicaciones.\n\nRESUMEN:\n${summary}\n\nTRANSCRIPCIÓN:\n${transcript}`);

            saveResult(url, transcript, language, summary, claudePrompt);

            send(res, {
              type: 'result',
              url,
              id: `r${Date.now()}`,
              transcript,
              language,
              summary,
              prompt: claudePrompt,
            });
          } catch (e) {
            send(res, { type: 'error', msg: `${url}: ${e.message}` });
          } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          }
        }
        send(res, { type: 'done' });
        res.end();
      })();
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`\n  TikTok → Claude Code`);
  console.log(`  Abrí el browser en: http://localhost:${PORT}`);
  console.log(`  (para cambiar el puerto: PORT=4000 node server.js)\n`);
});
