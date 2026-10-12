import { readFileSync } from 'node:fs';
  const KANJI_NUM = { '一': '1', '二': '2', '三': '3' };
  const UNIT_ALIAS = [[/ユニット/g, 'unit'], [/連立(?!方程式)/g, '連立方程式'], [/酸アルカリ|酸・アルカリ|酸とアルカリ/g, '酸アルカリ中和'], [/ヒトのからだ|人の体|人体/g, '動物のからだ'], [/科学変化/g, '化学変化'], [/かなづかい/g, '仮名遣い'], [/世界の諸地域/g, '世界地理'], [/日本の諸地域/g, '日本地理'],
    [/2次関数|y=ax\^?2|y=ax²|関数y=ax|2乗に比例|二乗に比例/g, '2乗に比例関数'], [/([ァ-ヶー]{2,})州/g, '$1'], [/故事生語|故事成語/g, '故事成語']];
  const matchNorm = (s) => { let t = String(s || '').normalize('NFKC').replace(/[\s　]/g, '').replace(/[０-９Ａ-Ｚａ-ｚ＝＾]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)).toLowerCase().replace(/([一二三])(次|元)/g, (m, a, b) => KANJI_NUM[a] + b); for (const [re, to] of UNIT_ALIAS) t = t.replace(re, to); return t; };
  const STOP_TOK = new Set(['利用', '計算', '問題', 'プリント', '必修', '基本', '応用', '練習', '演習', '復習', 'テスト', 'まで', 'から', 'ワーク', '教科書', '範囲', '全部', 'まとめ', '数学', '英語', '国語', '理科', '社会', 'unit', 'program', 'lesson', 'part']);
  // これだけで当たっても「単元が合う」とは言えない大きな言葉
  const BROAD_TOK = new Set(['歴史', '地理', '公民', '世界地理', '日本地理', '文法', '古典', '物質', '化学', '生物', '物理', '地学', '関数', '方程式', '図形', '読解', '長文', '単語']);
  // 単元名を語に分ける（空白・読点で分けてから、「の・と・や」でも分ける）。「Unit 4」「ユニット4の2」は unit4 にする
  const unitTokens = (s) => {
    const parts = String(s || '').split(/[\s　、,・\/／()（）\-〜~～＝=]+/).flatMap((p) => matchNorm(p).split(/[のとや]+/));
    const toks = parts.filter((t) => t.length >= 2 && !STOP_TOK.has(t) && !/^p?\d+$/.test(t));
    const units = [...matchNorm(s).matchAll(/unit(\d+)/g)].map((m) => 'unit' + m[1]);
    return [...new Set(toks.concat(units))];
  };
  // unit5 が unit51 に当たらないように（数字の続きは別のユニット）
  const tokIn = (hay, t) => (/^unit\d+$/.test(t) ? new RegExp(t + '(?![0-9])').test(hay) : hay.includes(t));
  // 教材ごとの照合用文字列は1回だけ作る（1000件×カード枚数を毎回計算しないため）

const mats = JSON.parse(readFileSync('dev/drive_materials_rows.json', 'utf8')).filter((m) => !m.hidden && m.note !== '解答' && m.note !== '資料');
const hayOf = (m) => matchNorm(m.unit) + '|' + matchNorm(m.title) + '|' + matchNorm(m.path);
mats.forEach((m) => { m._hay = hayOf(m); });
const h = { apikey: 'sb_publishable_eDlgtQQ5lt9zHmmZELZ_LA_P50PFTYW', 'Content-Type': 'application/json' };
const reqs = (await (await fetch('https://lwrjktjccutdhticabsi.supabase.co/rest/v1/rpc/teacher_export', { method: 'POST', headers: h, body: JSON.stringify({ p_pass: 'sensei', p_from: '2026-09-01', p_to: '2026-12-31' }) })).json()).filter((r) => r.kind === 'print' && r.unit_name && r.subject !== 'その他');
const P2C = { point: 'intro', weak: 'weak', practice: 'practice', test: 'test' };
const SUBJ = ['英語', '数学', '国語', '理科', '社会'], GR = ['中1', '中2', '中3'], CATS = ['intro', 'weak', 'practice', 'test', 'hard'];
// 1) 需要: 目的×難易度
const dem = {}; reqs.forEach((r) => { const k = r.purpose + '/' + r.difficulty; dem[k] = (dem[k] || 0) + 1; });
console.log('DEMAND purpose/difficulty:', Object.entries(dem).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join('  '));
// 2) 供給: 教科×学年×用途（学年なしは全学年に数える）
console.log('\nSUPPLY (教材数) subject grade: intro/weak/practice/test/hard');
for (const s of SUBJ) for (const g of GR) {
  const ms = mats.filter((m) => m.subject === s && (!m.grades.length || m.grades.includes(g)));
  console.log(`${s} ${g}: ` + CATS.map((c) => ms.filter((m) => m.categories.includes(c)).length).join('/'));
}
// 3) 依頼ごと: 単元が合う教材があるか、さらに目的の用途まで合うか
const res = { none: [], unitOnly: [], full: [] };
for (const r of reqs) {
  const unitN = matchNorm(r.unit_name), toks = unitTokens(r.unit_name);
  const hits = mats.filter((m) => (!m.subject || m.subject === r.subject) && (!m.grades.length || m.grades.includes(r.grade)) &&
    ((unitN && m._hay.includes(unitN)) || toks.some((t) => !BROAD_TOK.has(t) && tokIn(m._hay, t))));
  const want = P2C[r.purpose]; const wantHard = r.difficulty === 'advanced';
  const ok = hits.filter((m) => m.categories.includes(want) && (!wantHard || m.categories.includes('hard') || want === 'test'));
  (hits.length ? (ok.length ? res.full : res.unitOnly) : res.none).push(r);
}
console.log(`\nREQUESTS ${reqs.length}: 単元も用途も合う ${res.full.length} / 単元は合うが用途が合わない ${res.unitOnly.length} / 単元が合わない ${res.none.length}`);
const bySP = (arr) => { const m = {}; arr.forEach((r) => { const k = `${r.subject}・${{ point: '導入', weak: '弱点補強', practice: '類題演習', test: 'テスト形式' }[r.purpose]}${r.difficulty === 'advanced' ? '(応用)' : ''}`; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join('  '); };
console.log('単元は合うが用途が合わない:', bySP(res.unitOnly));
console.log('単元が合わない:', bySP(res.none));
console.log('単元が合わない例:', res.none.map((r) => `${r.grade}${r.subject}「${r.unit_name}」`).slice(0, 40).join(' | '));
