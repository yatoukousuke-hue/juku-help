// 本番の予想問題ページの選ぶ画面を iPhone の大きさで撮る
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: 390, height: 1100, deviceScaleFactor: 2, isMobile: true });
await p.goto('https://eimeimizutani-support.vercel.app/', { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.setItem('jh_tpass', JSON.stringify('sensei')));
await p.goto('https://eimeimizutani-support.vercel.app/yosou?grade=' + encodeURIComponent('中2') + '&subject=' + encodeURIComponent('国語'), { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1200));
await p.type('#sSearch', '古典'); await new Promise((r) => setTimeout(r, 300));
await p.evaluate(() => { const b = [...document.querySelectorAll('[data-k]')]; b.find((x) => x.textContent.startsWith('枕草子')).click(); });
await new Promise((r) => setTimeout(r, 300));
await p.evaluate(() => { const b = [...document.querySelectorAll('[data-k]')]; b.find((x) => x.textContent.startsWith('平家物語')).click(); });
await new Promise((r) => setTimeout(r, 600));
console.log(await p.evaluate(() => [document.querySelector('.range')?.innerText, [...document.querySelectorAll('.paper:not(.ans) .lead')].map((x) => x.textContent).join(' / '), document.documentElement.scrollWidth]));
await p.screenshot({ path: 'dev/shots/yosou_ui.png', clip: { x: 0, y: 0, width: 390, height: 1100 } });
await b.close();
