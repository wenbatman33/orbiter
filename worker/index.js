// 排行榜 API（Cloudflare Worker）；其餘請求交給靜態檔案
// POST /api/run     開局：發行有簽章的憑證，由伺服器記下開始時間
// GET  /api/scores  查詢排行榜 ?mode=cruise|combat&limit=10
// POST /api/scores  上傳成績：{ token, name, km, kills }

const MODES = new Set(['cruise', 'combat']);
const MAX_KM_PER_SEC = 1700; // 最高速 0.24 rad/s × 6371 km ≈ 1529 km/s，留 10% 餘裕（改 GAME.speedMax 要同步）
const MIN_RUN_MS = 3000;
const MAX_RUN_MS = 6 * 60 * 60 * 1000;
const MAX_KILLS_PER_SEC = 12;
const MAX_LIMIT = 50;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 6; // 同來源每分鐘最多上傳幾筆
const RANK_SCAN_LIMIT = 1000; // 名次最多算到 1000，避免冷門榜尾掃太多列
const MAX_BODY = 1024;

const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

const toBase64Url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(secret, text) {
  return toBase64Url(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(text)));
}

// 憑證格式：mode.開始時間.隨機編號.簽章；簽章讓玩家無法竄改開始時間
async function createRunToken(secret, mode) {
  const payload = `${mode}.${Date.now()}.${crypto.randomUUID()}`;
  return `${payload}.${await sign(secret, payload)}`;
}

async function readRunToken(secret, token) {
  if (typeof token !== 'string' || token.length > 200) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [mode, startedAt, runId, signature] = parts;
  let signatureBytes;
  try {
    signatureBytes = fromBase64Url(signature);
  } catch {
    return null;
  }
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signatureBytes, encoder.encode(`${mode}.${startedAt}.${runId}`));
  if (!valid || !MODES.has(mode)) return null;
  return { mode, startedAt: Number(startedAt), runId };
}

// 名字：移除控制字元與隱形字元，長度上限 12 個字
function cleanName(value) {
  const text = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...text].slice(0, 12).join('') || '無名飛行員';
}

async function topScores(env, mode, limit) {
  const { results } = await env.DB.prepare('SELECT name, km, kills, created_at FROM scores WHERE mode = ?1 ORDER BY km DESC, id ASC LIMIT ?2').bind(mode, limit).all();
  return results;
}

async function handleTop(url, env) {
  const mode = url.searchParams.get('mode');
  if (!MODES.has(mode)) return json({ error: 'bad_mode' }, 400);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 10));
  return json({ mode, scores: await topScores(env, mode, limit) }, 200, { 'Cache-Control': 'public, max-age=10' });
}

async function handleRun(request, env) {
  const body = await readBody(request);
  if (!body || !MODES.has(body.mode)) return json({ error: 'bad_mode' }, 400);
  return json({ token: await createRunToken(env.RUN_SECRET, body.mode) });
}

async function handleSubmit(request, env) {
  const body = await readBody(request);
  if (!body) return json({ error: 'bad_request' }, 400);
  const run = await readRunToken(env.RUN_SECRET, body.token);
  if (!run) return json({ error: 'bad_token' }, 403);

  // 用伺服器記下的開始時間驗證：航程不可能超過最高速度 × 實際經過時間
  const now = Date.now();
  const elapsed = now - run.startedAt;
  const km = body.km;
  const kills = body.kills ?? 0;
  if (!Number.isInteger(km) || !Number.isInteger(kills) || km < 1 || kills < 0) return json({ error: 'bad_score' }, 400);
  if (elapsed < MIN_RUN_MS || elapsed > MAX_RUN_MS) return json({ error: 'bad_time' }, 400);
  if (km > (elapsed / 1000) * MAX_KM_PER_SEC || kills > (elapsed / 1000) * MAX_KILLS_PER_SEC) return json({ error: 'impossible_score' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const ipHash = await sign(env.RUN_SECRET, `ip:${ip}`);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE ip_hash = ?1 AND created_at > ?2').bind(ipHash, now - RATE_WINDOW_MS).first();
  if (recent.n >= RATE_MAX) return json({ error: 'rate_limited' }, 429);

  const name = cleanName(body.name);
  const insert = await env.DB.prepare('INSERT OR IGNORE INTO scores (run_id, name, mode, km, kills, ip_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(run.runId, name, run.mode, km, kills, ipHash, now)
    .run();
  if (!insert.meta.changes) return json({ error: 'duplicate' }, 409);

  const ahead = await env.DB.prepare('SELECT COUNT(*) AS n FROM (SELECT 1 FROM scores WHERE mode = ?1 AND km > ?2 LIMIT ?3)').bind(run.mode, km, RANK_SCAN_LIMIT).first();
  return json({ name, rank: ahead.n >= RANK_SCAN_LIMIT ? null : ahead.n + 1, scores: await topScores(env, run.mode, 10) });
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

async function handleApi(request, url, env) {
  const { pathname } = url;
  const { method } = request;
  if (pathname === '/api/run' && method === 'POST') return handleRun(request, env);
  if (pathname === '/api/scores' && method === 'GET') return handleTop(url, env);
  if (pathname === '/api/scores' && method === 'POST') return handleSubmit(request, env);
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, url, env);
    } catch (err) {
      console.error('排行榜 API 錯誤', err);
      return json({ error: 'unavailable' }, 503);
    }
  },
};
