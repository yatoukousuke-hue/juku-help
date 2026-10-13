// 予想問題のストック（dev/exam_bank/*.json）を確かめて本番 DB に入れる
// 実行: node dev/upload_exam_bank.mjs            … 確認だけ（件数・単元・おかしな行）
//       node dev/upload_exam_bank.mjs --upload   … 本番に取り込み（ファイルごとに batch を差し替え）
//       node dev/upload_exam_bank.mjs --upload --only 社会   … 名前に「社会」を含むファイルだけ
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const DIR = 'dev/exam_bank';
if (!existsSync(DIR)) { console.log('no', DIR); process.exit(0); }
const units = JSON.parse(readFileSync('dev/exam_units.json', 'utf8'));
// 個人情報らしい文字列（念のため）: 「〇〇さん」「〇〇くん」「〇〇先生」、氏名欄の書き込みなど
const PERSONAL = /[一-龥]{1,4}(さん|くん|君|先生)|氏名[:：]\s*\S|得点[:：]\s*\d/;
const LEVELS = new Set(['basic', 'standard', 'advanced']);
const oi = process.argv.indexOf('--only');
const only = oi > 0 ? process.argv[oi + 1] : '';
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && (!only || f.includes(only)));
const batches = [];
let bad = 0, dup = 0;
const seenQ = new Set();
for (const f of files) {
  const rows = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
  const ok = [];
  for (const r of rows) {
    const problems = [];
    if (!r.subject || !r.grade || !r.unit || !r.question) problems.push('必須項目なし');
    if (r.level && !LEVELS.has(r.level)) problems.push('level');
    // 家族・職業などの呼び方（お母さん・店員さん・先生方…）は人名ではないので除いてから調べる
    const txt = (r.question + ' ' + (r.answer || '') + ' ' + (r.source_label || '')).replace(/お?(母|父|兄|姉|祖母|祖父|叔母|叔父|伯母|伯父|ばあ|じい|かあ|とう|にい|ねえ|婆|爺)(さん|ちゃん)|皆さん|みなさん|お客さん|店員さん|駅員さん|運転手さん|お医者さん|大工さん|校長先生|担任の先生|英語の先生|数学の先生|国語の先生|理科の先生|社会の先生|音楽の先生|体育の先生|ALTの先生|先生方/g, '');
    if (PERSONAL.test(txt)) problems.push('人名らしい文字');
    if (!r.answer) problems.push('解答なし');
    if (!r.subunit) r._noSub = true;
    if (r.figure_svg && !/^<svg[\s\S]*<\/svg>$/.test(r.figure_svg.trim())) problems.push('SVG');
    if (problems.length) { bad++; if (bad <= 15) console.log('  skip', f, problems.join(','), '|', String(r.question).slice(0, 40)); continue; }
    // 同じ単元の中で問題文も図も同じものは1つだけ（図が違えば別の問題）
    const key = [r.grade, r.subject, r.unit, r.question, r.figure_svg || ''].join('');
    if (seenQ.has(key)) { dup++; continue; }
    seenQ.add(key);
    const known = (units[r.subject] || {})[r.grade] || [];
    if (!known.includes(r.unit)) r._newUnit = true;
    ok.push(r);
  }
  batches.push({ batch: f.replace(/\.json$/, ''), rows: ok });
}
const all = batches.flatMap((b) => b.rows);
const by = {}; all.forEach((r) => { const k = `${r.grade} ${r.subject}`; by[k] = by[k] || {}; by[k][r.unit] = (by[k][r.unit] || 0) + 1; });
console.log('files', files.length, '| questions', all.length, '| skipped', bad, '| duplicates', dup, '| figures', all.filter((r) => r.figure_svg).length);
for (const [k, v] of Object.entries(by).sort()) console.log(' ', k, '→', Object.entries(v).map(([u, n]) => `${u}:${n}`).join('  '));
const noSub = all.filter((r) => r._noSub).length;
if (noSub) console.log('小単元なし:', noSub, '問');
const subs = {}; all.forEach((r) => { const k = `${r.grade}${r.subject}`; subs[k] = subs[k] || new Set(); subs[k].add(r.unit + '/' + (r.subunit || '')); });
console.log('小単元の数:', Object.entries(subs).sort().map(([k, v]) => `${k}:${v.size}`).join(' '));
const newUnits = [...new Set(all.filter((r) => r._newUnit).map((r) => `${r.grade}${r.subject}「${r.unit}」`))];
if (newUnits.length) console.log('一覧に無い単元名:', newUnits.join(' '));

if (process.argv.includes('--upload')) {
  const h = { apikey: 'sb_publishable_eDlgtQQ5lt9zHmmZELZ_LA_P50PFTYW', 'Content-Type': 'application/json' };
  const pass = process.env.JH_PASS || 'sensei';
  for (const b of batches) {
    const rows = b.rows.map(({ _newUnit, _noSub, ...r }) => r);
    const res = await fetch('https://lwrjktjccutdhticabsi.supabase.co/rest/v1/rpc/teacher_import_exam_questions', { method: 'POST', headers: h, body: JSON.stringify({ p_pass: pass, p_batch: b.batch, p_rows: rows }) });
    const j = await res.json();
    if (!res.ok) { console.log('upload error', b.batch, res.status, JSON.stringify(j)); process.exit(1); }
    console.log('uploaded', b.batch, j.imported);
  }
}
