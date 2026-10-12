// ドライブの教材一覧（dev/drive_materials.json：ファイル名・フォルダ名・リンクだけ）を
// 教科・学年・単元・用途（導入/弱点補強/類題演習/テスト形式/難問）に分類して dev/drive_materials_rows.json に書く。
// 中身は読まない。個人情報らしいものはここでも念のため除外する。
// 実行: node dev/classify_materials.mjs [--upload]   （--upload で本番 DB に取り込む）
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('dev/drive_materials.json', 'utf8'));
const z2h = (s) => String(s || '').replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');

// 念のための個人情報フィルタ（サブエージェントで除外済みだが二重に）
const PRIVATE = /名簿|成績|点数|結果|集計|速報|面談|保護者|報告|アンケート|回答|フォーム|座席|入塾|体験|生徒|個人|氏名|連絡|住所|電話|請求|月謝|給与|勤怠|シフト|講師|答案|採点|カルテ|履歴|合否|進路|申込|契約|口座|出欠|欠席|出席|振替|ヒトコト|研修|課題図書|日報|議事録|会議|売上|予算|経理|MIZUTANI-\d/;

const SUBJECTS = [
  ['英語', /英語|English|英文法|英単語|英作文|英検|be動詞|不定詞|動名詞|現在完了|関係代名詞|受け身|受動態|比較|分詞|助動詞|Unit|Lesson|Program/i],
  ['数学', /数学|方程式|関数|比例|反比例|図形|証明|平方根|因数分解|展開|確率|データ|資料の活用|三平方|相似|円周角|連立|一次|二次|作図|空間図形|平面図形|正負の数|文字式|計算/],
  ['国語', /国語|漢字|古文|漢文|文法|読解|説明文|論説|物語|小説|随筆|詩|短歌|俳句|敬語|品詞|作文/],
  ['理科', /理科|化学|物理|生物|地学|電流|電圧|磁界|植物|動物|細胞|遺伝|天気|気象|地震|火山|地層|天体|イオン|酸|アルカリ|中和|化学変化|物質|光|音|力|運動|エネルギー|仕事|水溶液|気体|消化|呼吸|血液/],
  ['社会', /社会|地理|歴史|公民|政治|経済|憲法|世界地図|日本地理|州|都道府県|縄文|弥生|古墳|飛鳥|奈良|平安|鎌倉|室町|戦国|江戸|明治|大正|昭和|近代|現代|人権|選挙|国会|内閣|裁判/],
];
function detectSubject(path, title) {
  // フォルダ名で決まるならそれを優先（教科名がはっきり書いてあるもの）
  for (const [name] of SUBJECTS) if (path.includes(name) || (name === '社会' && /地理|歴史|公民/.test(path)) || (name === '理科' && /物理|化学|生物|地学/.test(path))) return name;
  for (const [name, re] of SUBJECTS) if (re.test(title)) return name;
  for (const [name, re] of SUBJECTS) if (re.test(path)) return name;
  return '';
}
function detectGrades(text) {
  const g = new Set();
  const t = z2h(text);
  if (/中1|中学1|1年|中一/.test(t)) g.add('中1');
  if (/中2|中学2|2年|中二/.test(t)) g.add('中2');
  if (/中3|中学3|3年|中三|受験|入試|北辰/.test(t)) g.add('中3');
  return [...g];
}
const CATS = {
  intro: /導入|基礎|基本|要点|まとめ|ポイント|入門|はじめ|やさしい|ステップ|必修|解説|教科書ガイド|確認問題/,
  weak: /弱点|補強|復習|苦手|総復習|おさらい|チェック|やり直し|解き直し/,
  practice: /演習|練習|類題|ドリル|問題集|トレーニング|ワーク|プリント|反復|計算|問題/,
  test: /テスト|小テスト|確認テスト|定期|模試|北辰|過去問|入試|実力|模擬|期末|中間|学年末|検定/,
  hard: /発展|応用|難問|難しい|ハイレベル|上位|挑戦|最難|選抜|トップ|ゴール|sirius|シリウス|プラス.?黒|黒|入試|特訓|TOP|ハイ/i,
};
function detectCategories(text) {
  const cats = Object.entries(CATS).filter(([, re]) => re.test(text)).map(([k]) => k);
  if (!cats.length) cats.push('practice');
  return cats;
}
const NOISE = /\.(pdf|docx?|pptx?|jpe?g|png|heic)$|中[123]|中学[123]年?|[123]年生?|英語|数学|国語|理科|社会|導入|基礎|基本|演習|練習|類題|プリント|テスト|問題|解答|解説|答え|コピー|スキャン|scan|_|\(\d+\)|^\d+$|\d{4}[-./]?\d{1,2}[-./]?\d{0,2}/gi;
function detectUnit(title) {
  const t = z2h(title).replace(NOISE, ' ').replace(/[【】\[\]「」『』（）()]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= 2 ? t.slice(0, 40) : '';
}

const rows = [];
let skipped = 0;
for (const f of src) {
  const path = (f.path || []).join(' > ');
  const all = z2h(path + ' ' + f.title);
  if (PRIVATE.test(all)) { skipped++; continue; }
  const subject = detectSubject(z2h(path), z2h(f.title));
  const grades = detectGrades(all);
  const categories = detectCategories(all);
  const answer = /解答|答え|解説|answer/i.test(f.title);
  const level = categories.includes('hard') ? 'advanced' : categories.includes('intro') ? 'basic' : 'standard';
  rows.push({ drive_id: f.id, title: f.title, url: f.url, subject, grades, unit: detectUnit(f.title), categories, level, path, note: answer ? '解答' : '' });
}
writeFileSync('dev/drive_materials_rows.json', JSON.stringify(rows, null, 1));
const count = (k) => { const m = {}; rows.forEach((r) => { const v = typeof k === 'function' ? k(r) : r[k]; (Array.isArray(v) ? (v.length ? v : ['(なし)']) : [v || '(なし)']).forEach((x) => { m[x] = (m[x] || 0) + 1; }); }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a}:${b}`).join('  '); };
console.log('rows', rows.length, '| privacy-skipped', skipped);
console.log('subject', count('subject'));
console.log('grades', count('grades'));
console.log('categories', count('categories'));
console.log('answers', rows.filter((r) => r.note === '解答').length);

if (process.argv.includes('--upload')) {
  const h = { apikey: 'sb_publishable_eDlgtQQ5lt9zHmmZELZ_LA_P50PFTYW', 'Content-Type': 'application/json' };
  const pass = process.env.JH_PASS || 'sensei';
  let total = 0;
  for (let i = 0; i < rows.length; i += 300) {
    const r = await fetch('https://lwrjktjccutdhticabsi.supabase.co/rest/v1/rpc/teacher_import_materials', { method: 'POST', headers: h, body: JSON.stringify({ p_pass: pass, p_rows: rows.slice(i, i + 300) }) });
    const j = await r.json(); if (!r.ok) { console.log('upload error', r.status, JSON.stringify(j)); process.exit(1); }
    total += j.imported;
  }
  console.log('uploaded', total);
}
