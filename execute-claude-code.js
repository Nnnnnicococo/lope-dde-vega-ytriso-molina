#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const prompt = process.argv.slice(2).join(' ');

if (!prompt) {
  console.error('Error: debes pasar un prompt como argumento.');
  console.error('Uso: node execute-claude-code.js "Tu prompt aquí"');
  process.exit(1);
}

const outputDir = path.join(__dirname, 'Cerebro_Central', 'sistema');
const outputFile = path.join(outputDir, 'ultima_respuesta_claude.md');

fs.mkdirSync(outputDir, { recursive: true });

console.log(`Ejecutando: claude con prompt de ${prompt.length} caracteres...`);

const child = spawn('claude', ['-p', prompt], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  const chunk = data.toString();
  stdout += chunk;
  process.stdout.write(chunk);
});

child.stderr.on('data', (data) => {
  const chunk = data.toString();
  stderr += chunk;
  process.stderr.write(chunk);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`\nEl proceso terminó con código ${code}`);
    if (stderr) {
      console.error('stderr:', stderr);
    }
    process.exit(code);
  }

  const timestamp = new Date().toISOString();
  const content = `# Última Respuesta de Claude\n\n**Fecha:** ${timestamp}\n\n**Prompt:**\n> ${prompt}\n\n---\n\n**Respuesta:**\n\n${stdout}`;

  fs.writeFileSync(outputFile, content, 'utf8');
  console.log(`\nRespuesta guardada en: ${outputFile}`);
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('Error: el comando "claude" no fue encontrado en el PATH.');
    console.error('Asegúrate de que Claude Code CLI esté instalado: npm install -g @anthropic-ai/claude-code');
  } else {
    console.error('Error al ejecutar claude:', err.message);
  }
  process.exit(1);
});
