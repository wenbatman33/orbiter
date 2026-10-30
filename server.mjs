// 本機開發伺服器（無相依套件）：靜態檔案 + DEV 工具「寫入 src/layout.js」端點
// 啟動：node server.mjs  →  http://localhost:5178/   （加 ?dev 顯示齒輪按鈕）
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5178;
const layoutFile = path.join(root, 'src', 'layout.js');
const backupFile = path.join(root, 'src', 'layout.backup.js');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function renderLayoutFile({ LAYOUTS, GAME, THEME }) {
  const j = (o) => JSON.stringify(o, null, 2);
  return `// 版面與遊戲參數 — 由 DEV 微調工具於 ${new Date().toISOString()} 寫入（可直接手動編輯）
// LAYOUTS：各裝置版面（pc / tablet / mobile）｜GAME：玩法參數｜THEME：配色與星球外觀

export const LAYOUTS = ${j(LAYOUTS)};

export const GAME = ${j(GAME)};

export const THEME = ${j(THEME)};
`;
}

async function readBody(req, limit = 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleSave(req, res) {
  try {
    const data = JSON.parse(await readBody(req));
    const ok = isPlainObject(data) && isPlainObject(data.LAYOUTS) && isPlainObject(data.GAME) && isPlainObject(data.THEME)
      && ['pc', 'tablet', 'mobile'].every((k) => isPlainObject(data.LAYOUTS[k]));
    if (!ok) throw new Error('格式不正確');
    // 寫入前先備份舊檔
    await fs.copyFile(layoutFile, backupFile).catch(() => {});
    await fs.writeFile(layoutFile, renderLayoutFile(data), 'utf8');
    console.log(`[DEV] 已寫入 ${layoutFile}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
  }
}

async function handleStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let file = path.normalize(path.join(root, urlPath));
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const stat = await fs.stat(file);
    if (stat.isDirectory()) file = path.join(file, 'index.html');
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__dev/save') return handleSave(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return handleStatic(req, res);
    res.writeHead(405).end();
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`ORBITER 開發伺服器：http://localhost:${port}/   （DEV 工具：按 D，或網址加 ?dev）`);
  });
