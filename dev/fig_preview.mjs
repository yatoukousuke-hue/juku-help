// 図つきの予想問題を一覧ページにしてスクリーンショットを撮る（目で確認する用）
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const only = process.argv[2] || '';
const rows = readdirSync('dev/exam_bank').filter((f) => f.endsWith('.json') && f.includes(only)).flatMap((f) => JSON.parse(readFileSync('dev/exam_bank/' + f, 'utf8')));
const figs = rows.filter((r) => r.figure_svg);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const html = `<!doctype html><meta charset="utf-8"><style>body{font-family:"Yu Gothic",sans-serif;font-size:12px;margin:10px}.c{display:inline-block;vertical-align:top;width:300px;border:1px solid #ccc;margin:4px;padding:6px}.c svg{width:280px;height:auto;max-height:200px;border:1px dashed #ddd}.q{white-space:pre-wrap}</style>` +
  figs.map((r, i) => `<div class="c"><b>${i + 1}. ${esc(r.grade + r.subject + ' ' + r.unit)}</b><div class="q">${esc(r.question)}</div>${r.figure_svg}<div style="color:#b91c1c">答: ${esc(r.answer)}</div></div>`).join('');
mkdirSync('dev/shots', { recursive: true });
writeFileSync('dev/shots/figs.html', html);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
await p.goto(pathToFileURL(path.resolve('dev/shots/figs.html')).href);
await p.screenshot({ path: `dev/shots/figs${only ? '_' + only : ''}.png`, fullPage: true });
await b.close();
console.log('figures', figs.length);
