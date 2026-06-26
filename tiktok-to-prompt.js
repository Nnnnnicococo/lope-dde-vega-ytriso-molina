#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WHISPER_SCRIPT = path.join(__dirname, 'whisper_transcribe.py');
const OUTPUT_DIR = path.join(__dirname, 'Cerebro_Central', 'sistema');

function log(msg) {
  process.stderr.write(`[tiktok-to-prompt] ${msg}\n`);
}

function runClaude(prompt) {
  const result = spawnSync('claude', ['-p', prompt], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw new Error(`claude no encontrado: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`claude falló: ${result.stderr}`);
  return result.stdout.trim();
}

function downloadAudio(url, tmpDir) {
  log(`Descargando audio de: ${url}`);
  const outputTemplate = path.join(tmpDir, 'audio.%(ext)s');
  execSync(
    `yt-dlp --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" "${url}"`,
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('audio'));
  if (!files.length) throw new Error('yt-dlp no generó ningún archivo de audio');
  return path.join(tmpDir, files[0]);
}

function transcribe(audioPath) {
  log('Transcribiendo con Whisper (modelo base)...');
  const result = spawnSync('python3', [WHISPER_SCRIPT, audioPath, 'base'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 300000,
  });
  if (result.error) throw new Error(`Whisper falló: ${result.error.message}`);
  const parsed = JSON.parse(result.stdout);
  if (parsed.error) throw new Error(`Whisper error: ${parsed.error}`);
  return parsed;
}

function summarize(transcript) {
  log('Generando resumen con Claude...');
  const prompt = `Aquí está la transcripción de un video de TikTok. Escribe un resumen conciso en español (máximo 5 oraciones) que capture los puntos clave, el tema principal y el tono del video. Solo el resumen, sin introducción ni cierre.

TRANSCRIPCIÓN:
${transcript}`;
  return runClaude(prompt);
}

function generatePrompt(transcript, summary) {
  log('Generando prompt para Claude Code...');
  const prompt = `Basándote en esta transcripción de TikTok y su resumen, crea un prompt preciso y accionable para Claude Code. El prompt debe describir una tarea de desarrollo de software, contenido, o análisis que se pueda ejecutar directamente en Claude Code. Que sea específico, con contexto suficiente, y listo para usar. Solo el prompt, sin explicaciones adicionales.

RESUMEN:
${summary}

TRANSCRIPCIÓN COMPLETA:
${transcript}`;
  return runClaude(prompt);
}

function saveResults(url, transcript, language, summary, claudePrompt) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `tiktok_${timestamp}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const content = `# TikTok → Prompt
**Fecha:** ${new Date().toISOString()}
**URL:** ${url}
**Idioma detectado:** ${language}

---

## Transcripción

${transcript}

---

## Resumen

${summary}

---

## Prompt para Claude Code

\`\`\`
${claudePrompt}
\`\`\`
`;

  fs.writeFileSync(filepath, content, 'utf8');
  return filepath;
}

async function main() {
  const urls = process.argv.slice(2);
  if (!urls.length) {
    console.error('Uso: node tiktok-to-prompt.js <url_tiktok> [url2] [url3...]');
    process.exit(1);
  }

  for (const url of urls) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-'));
    try {
      const audioPath = downloadAudio(url, tmpDir);
      const { text: transcript, language } = transcribe(audioPath);

      log(`Transcripción (${language}): ${transcript.slice(0, 100)}...`);

      const summary = summarize(transcript);
      const claudePrompt = generatePrompt(transcript, summary);

      const savedPath = saveResults(url, transcript, language, summary, claudePrompt);

      console.log('\n' + '='.repeat(60));
      console.log('TRANSCRIPCIÓN:');
      console.log(transcript);
      console.log('\nRESUMEN:');
      console.log(summary);
      console.log('\nPROMPT PARA CLAUDE CODE:');
      console.log(claudePrompt);
      console.log('='.repeat(60));
      console.log(`\nGuardado en: ${savedPath}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
