import { readFileSync } from 'node:fs';
const mats = JSON.parse(readFileSync('dev/drive_materials_rows.json', 'utf8')).filter((m) => !m.hidden);
const KANJI_NUM = { '一': '1', '二': '2', '三': '3' };
const ALIAS = [[/連立(?!方程式)/g, '連立方程式'], [/酸アルカリ|酸・アルカリ|酸とアルカリ/g, '酸アルカリ中和'], [/ヒト|人の体|人体/g, '動物のからだ'], [/科学変化/g, '化学変化'], [/仮名遣い|かなづかい/g, '仮名遣い'], [/助動詞|助詞/g, '$&文法'], [/世界の諸地域/g, '世界地理'], [/日本の諸地域/g, '日本地理']];
const normUnit = (s) => { let t = String(s || '').replace(/[\s　]/g, '').replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)).toLowerCase().replace(/([一二三])(次|元)/g, (m, a, b) => KANJI_NUM[a] + b); for (const [re, to] of ALIAS) t = t.replace(re, to); return t; };
const STOP = new Set(['利用', '計算', '問題', 'プリント', '必修', '基本', '応用', '練習', '演習', '復習', 'テスト', 'まで', 'から', 'ワーク', '教科書', '範囲']);
const unitTokens = (s) => normUnit(s).split(/[、,・\/／()（）\-〜~＝=のとや]+/).filter((t) => t.length >= 2 && !STOP.has(t) && !/^p?\d+$/.test(t));
const h = { apikey: 'sb_publishable_eDlgtQQ5lt9zHmmZELZ_LA_P50PFTYW', 'Content-Type': 'application/json' };
const reqs = (await (await fetch('https://lwrjktjccutdhticabsi.supabase.co/rest/v1/rpc/teacher_export', { method: 'POST', headers: h, body: JSON.stringify({ p_pass: 'sensei', p_from: '2026-09-01', p_to: '2026-10-31' }) })).json()).filter((r) => r.kind === 'print' && r.unit_name);
let hit = 0; const bySubj = {}; const miss = [];
for (const r of reqs) {
  const unitN = normUnit(r.unit_name), toks = unitTokens(r.unit_name);
  const hits = mats.filter((m) => (!m.subject || m.subject === r.subject) && (!m.grades.length || m.grades.includes(r.grade)) && (() => { const hay = normUnit(m.unit) + '|' + normUnit(m.title) + '|' + normUnit(m.path); return (unitN && (hay.includes(unitN) || (normUnit(m.unit).length >= 2 && unitN.includes(normUnit(m.unit))))) || toks.some((t) => hay.includes(t)); })());
  const k = r.subject; bySubj[k] = bySubj[k] || [0, 0]; bySubj[k][1]++;
  if (hits.length) { hit++; bySubj[k][0]++; } else miss.push(`${r.grade} ${r.subject}「${r.unit_name}」`);
}
console.log('requests', reqs.length, '| with unit-matching material', hit, `(${Math.round(hit / reqs.length * 100)}%)`);
console.log('by subject', Object.entries(bySubj).map(([k, [a, b]]) => `${k} ${a}/${b}`).join('  '));
console.log('sample misses:', miss.slice(0, 25).join(' | '));
