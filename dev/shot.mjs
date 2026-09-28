// iPhone サイズで講師画面・生徒画面のスクリーンショットを撮る（画面は開かない）
// 実行: node dev/shot.mjs  → dev/shots/*.png
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const prev = path.join(here, 'preview');
const shots = path.join(here, 'shots');
rmSync(prev, { recursive: true, force: true });
cpSync(path.join(root, 'app'), prev, { recursive: true });
mkdirSync(shots, { recursive: true });
writeFileSync(path.join(prev, 'config.js'), readFileSync(path.join(prev, 'config.js'), 'utf8').replace(/SUPABASE_URL: "[^"]*"/, 'SUPABASE_URL: ""'));
cpSync(path.join(here, 'seed.html'), path.join(prev, 'seed.html'));

// 簡易静的サーバー
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const f = path.join(prev, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8767, r));

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-first-run'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const base = 'http://localhost:8767/';
const shot = async (url, name, full = true) => { await page.goto(base + url, { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 900)); await page.screenshot({ path: path.join(shots, name), fullPage: full }); console.log('shot', name); };

await page.goto(base + 'seed.html', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));
console.log('seed:', await page.evaluate(() => document.body.textContent));
const targets = process.argv.slice(2);
const all = [
  ['teacher.html', '10_teacher_waiting.png'],
  ['teacher.html?open=1', '11_teacher_detail.png'],
  ['teacher.html?tab=in_progress', '12_teacher_progress.png'],
  ['teacher.html?tab=done', '13_teacher_done.png'],
  ['teacher.html?tab=records', '14_teacher_records.png'],
  ['index.html', '20_student_home.png'],
  ['index.html?form=print', '21_student_print.png'],
  ['index.html?form=question', '22_student_question.png'],
];
for (const [u, n] of all) if (!targets.length || targets.some((t) => n.includes(t))) await shot(u, n);
await browser.close();
server.close();
