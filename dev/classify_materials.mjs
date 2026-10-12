// ドライブの教材一覧（dev/drive_materials.json：ファイル名・フォルダ名・リンクだけ）を
// 教科・学年・単元・用途（導入/弱点補強/類題演習/テスト形式/難問）に分類して dev/drive_materials_rows.json に書く。
// 中身は読まない。個人情報らしいものはここでも念のため除外する。
// 実行: node dev/classify_materials.mjs [--upload]   （--upload で本番 DB に取り込む）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// 1回目と2回目（あれば）の一覧を合わせる（同じファイルは1つに）
const src = [];
const seen = new Set();
for (const f of ['dev/drive_materials.json', 'dev/drive_materials_pass2.json']) {
  if (!existsSync(f)) continue;
  for (const x of JSON.parse(readFileSync(f, 'utf8'))) { if (!x.id || seen.has(x.id)) continue; seen.add(x.id); src.push(x); }
}
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
const UNIT_GRADE = {
  数学: [['中3', /2次方程式|二次方程式|平方根|因数分解|展開|相似|円周角|三平方|標本|2乗に比例|二乗に比例|y=ax/], ['中2', /連立|1次関数|一次関数|合同|証明|確率|箱ひげ|三角形|四角形|平行線/], ['中1', /正負|正の数|負の数|文字式|1次方程式|一次方程式|比例|反比例|平面図形|空間図形|作図|おうぎ形|投影図|資料の活用|度数/]],
  理科: [['中3', /イオン|電池|酸|アルカリ|中和|細胞分裂|生殖|遺伝|進化|天体|月|金星|運動|仕事|エネルギー|力の合成|浮力/], ['中2', /化学変化|酸化|還元|原子|分子|化学反応式|電流|電圧|磁界|電磁誘導|静電気|天気|気象|前線|湿度|動物のからだ|消化|呼吸|血液|細胞|光合成|植物のからだ/], ['中1', /物質|気体|水溶液|状態変化|密度|光|音|力|ばね|圧力|火山|地震|地層|植物の分類|動物の分類|脊椎/]],
  社会: [['中3', /公民|憲法|人権|選挙|国会|内閣|裁判|経済|財政|国際/]],
};
function guessGradeByUnit(subject, text) {
  for (const [g, re] of (UNIT_GRADE[subject] || [])) if (re.test(text)) return [g];
  return [];
}
// 用途の判定（フォルダの性格 → ファイル名の順に見る）
// intro=苦手な子の導入 / weak=弱点補強 / practice=類題演習 / test=テスト形式 / hard=難しい問題
function detectCategories(path, title) {
  const t = path + ' ' + title;
  const c = new Set();
  if (/北辰/.test(t)) c.add('test');
  if (/講習|合宿|講義|板書|QRノート|授業プリント|通常授業/.test(t)) { c.add('intro'); c.add('practice'); }
  if (/ベーシック|基礎編|準備講座|はじめて/.test(t)) c.add('intro');
  if (/補強プリント|弱点補強|補強テキスト|大問一|計算の達人/.test(t)) c.add('weak');
  if (/検定テスト|学年末検定|メモリーツリー/.test(t)) c.add('test');
  if (/上位への|上位層|アルティメット|ハイ数学|ハイ英語|ハイ|難関|応用編/.test(t)) c.add('hard');
  if (/学校のワーク|指導要領ワーク|フォレスタ/.test(t)) c.add('practice');
  if (/過去問|入試問題|県立入試|公立入試|入試リハ|予想問題|追検査|受験問題/.test(t)) { c.add('test'); if (/学校選択|（選択）|\(選択\)|選択問題/.test(title)) c.add('hard'); }
  if (/Eテスト|確認テスト|単元テスト|単元確認|小テスト|チェックテスト|単語テスト|熟語テスト|プレ中間|プレ期末|はじめての定期テスト|テスト$|テスト\./.test(t)) c.add('test');
  if (/Eテスト|確認テスト|単元確認|単元テスト/.test(t)) c.add('weak');
  if (/璧問|壁問|定期テスト対策/.test(t)) { c.add('test'); c.add('practice'); }
  if (/必修|まとめ|要点|ポイント|基礎|基本|導入|入門|ガイド|合格テキスト|文法テキスト|ブロッコリー|書き方|勉強法/.test(t)) c.add('intro');
  if (/復習|総復習|補強|弱点|苦手|必修スタディ|おさらい|やり直し|品詞分解|ブロッコリー|反復/.test(t)) c.add('weak');
  if (/演習|練習|類題|ドリル|問題集|トレーニング|ワーク|プリント|並べ替え|練成|特訓|問題編|長文|英単語|熟語|品詞分解/.test(t)) c.add('practice');
  if (/発展|応用|難問|ハイレベル|上位|挑戦|最難|思考力|筑坂|お茶の水|駿台|星野|学校選択|入試小問|入試完成|sirius|シリウス|ゴール/i.test(t)) c.add('hard');
  if (!c.size) c.add('practice');
  return [...c];
}
const NOISE = /\.(pdf|docx?|pptx?|jpe?g|png|heic)$|中[123]|中学[123]年?|[123]年生?|英語|数学|国語|理科|社会|導入|基礎|基本|演習|練習|類題|プリント|テスト|問題|解答|解説|答え|コピー|スキャン|scan|_|\(\d+\)|^\d+$|\d{4}[-./]?\d{1,2}[-./]?\d{0,2}/gi;
function detectUnit(title) {
  const t = z2h(title).replace(NOISE, ' ').replace(/[【】\[\]「」『』（）()]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length >= 2 ? t.slice(0, 40) : '';
}

// 名簿の生徒名（手元だけのファイル）を含むファイル名は除外
let rosterNames = [];
try { rosterNames = JSON.parse(readFileSync('dev/roster_import.json', 'utf8')).map((s) => String(s.name).replace(/[\s　]/g, '')).filter((n) => n.length >= 2); } catch (_) {}
const hasStudentName = (t) => { const n = t.replace(/[\s　]/g, ''); return rosterNames.some((x) => n.includes(x)); };
// 生徒に配るものではない資料（正答率表・偏差値表・手引き・答案用紙など）は候補に出さない
const NOT_PRINT = /正答率|偏差値|度数分布|成績表|手引|分析|講評|集計|平均点|得点分布/;
const UNUSED = /使わない|使用しない|旧版|古い版|ボツ/;

const rows = [];
let skipped = 0, nameSkipped = 0;
for (const f of src) {
  const path = (f.path || []).join(' > ');
  const all = z2h(path + ' ' + f.title);
  if (PRIVATE.test(all)) { skipped++; continue; }
  if (hasStudentName(path + f.title)) { nameSkipped++; continue; }
  const subject = detectSubject(z2h(path), z2h(f.title));
  let grades = detectGrades(all);
  if (!grades.length) grades = guessGradeByUnit(subject, z2h(f.title + ' ' + path));
  const categories = detectCategories(z2h(path), z2h(f.title));
  const answer = /解答|答え|こたえ|answer|マークシート/i.test(f.title);
  const editable = /編集用|編集可能|原本/.test(f.title);
  const level = categories.includes('hard') ? 'advanced' : (categories.includes('intro') && !categories.includes('test')) ? 'basic' : 'standard';
  const notPrint = NOT_PRINT.test(f.title) || UNUSED.test(path + ' ' + f.title);
  rows.push({ drive_id: f.id, title: f.title, url: f.url, subject, grades, unit: detectUnit(f.title), categories, level, path, note: notPrint ? '資料' : answer ? '解答' : editable ? '編集用' : '', hidden: notPrint });
}
writeFileSync('dev/drive_materials_rows.json', JSON.stringify(rows, null, 1));
const count = (k) => { const m = {}; rows.forEach((r) => { const v = typeof k === 'function' ? k(r) : r[k]; (Array.isArray(v) ? (v.length ? v : ['(なし)']) : [v || '(なし)']).forEach((x) => { m[x] = (m[x] || 0) + 1; }); }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a}:${b}`).join('  '); };
console.log('rows', rows.length, '| privacy-skipped', skipped, '| student-name-skipped', nameSkipped, '| not-for-print (hidden)', rows.filter((r) => r.hidden).length);
console.log('subject', count('subject'));
console.log('grades', count('grades'));
console.log('categories', count('categories'));
console.log('answers', rows.filter((r) => r.note === '解答').length);

if (process.argv.includes('--upload')) {
  const h = { apikey: 'sb_publishable_eDlgtQQ5lt9zHmmZELZ_LA_P50PFTYW', 'Content-Type': 'application/json' };
  const pass = process.env.JH_PASS || 'sensei';
  let total = 0;
  const up = rows.filter((r) => !r.hidden);
  for (let i = 0; i < up.length; i += 300) {
    const r = await fetch('https://lwrjktjccutdhticabsi.supabase.co/rest/v1/rpc/teacher_import_materials', { method: 'POST', headers: h, body: JSON.stringify({ p_pass: pass, p_rows: up.slice(i, i + 300) }) });
    const j = await r.json(); if (!r.ok) { console.log('upload error', r.status, JSON.stringify(j)); process.exit(1); }
    total += j.imported;
  }
  console.log('uploaded', total);
}
