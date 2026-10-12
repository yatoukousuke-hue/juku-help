// 本番の予想問題ページを開いて A4 の見本を撮る
import puppeteer from 'puppeteer-core';
const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['中2|数学|一次関数|本郷', '中3|理科|遺伝|水谷'];
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 900, height: 1300, deviceScaleFactor: 1.5 });
await p.goto('https://eimeimizutani-support.vercel.app/', { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.setItem('jh_tpass', JSON.stringify('sensei')));
let i = 0;
for (const c of cases) {
  const [grade, subject, unit, school] = c.split('|');
  const url = `https://eimeimizutani-support.vercel.app/yosou?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}&unit=${encodeURIComponent(unit)}&school=${encodeURIComponent(school || '')}`;
  await p.goto(url, { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 1500));
  const info = await p.evaluate(() => ({ papers: document.querySelectorAll('.paper').length, qs: document.querySelectorAll('.paper:not(.ans) .sq').length, figs: document.querySelectorAll('.paper:not(.ans) .fig svg').length, h: document.querySelector('.paper') ? document.querySelector('.paper').scrollHeight : 0, msg: document.querySelector('#out') ? document.querySelector('#out').innerText.slice(0, 80) : '' }));
  console.log(c, JSON.stringify(info));
  const el = await p.$('.paper');
  if (el) { await el.screenshot({ path: `dev/shots/yosou_${++i}.png` }); }
}
await b.close();
