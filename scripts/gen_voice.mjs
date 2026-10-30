// 產生地面通訊語音：macOS say → ffmpeg 轉成單聲道 mp3（無線電效果在遊戲裡即時處理）
// 用法：node scripts/gen_voice.mjs [--force]　已存在的檔案預設略過，可中斷續跑
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINES, VOICES } from '../src/commsLines.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'assets', 'voice');
const force = process.argv.includes('--force');
const DEFAULT_RATE = 172;

mkdirSync(outDir, { recursive: true });
const tmp = path.join(os.tmpdir(), `orbiter-voice-${process.pid}.aiff`);

let made = 0, skipped = 0, bytes = 0;
try {
  for (const [id, line] of Object.entries(LINES)) {
    const out = path.join(outDir, `${id}.mp3`);
    if (!force && existsSync(out)) {
      skipped += 1;
    } else {
      execFileSync('say', ['-v', VOICES[line.who], '-r', String(line.rate || DEFAULT_RATE), '-o', tmp, line.en]);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', '22050',
        '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=7',
        '-ar', '22050', '-codec:a', 'libmp3lame', '-b:a', '48k', out]);
      made += 1;
    }
    bytes += statSync(out).size;
  }
} finally {
  rmSync(tmp, { force: true });
}
console.log(`完成：新產生 ${made} 句、略過 ${skipped} 句，共 ${(bytes / 1024).toFixed(0)} KB → ${outDir}`);
