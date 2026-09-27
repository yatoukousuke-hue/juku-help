// テスト結果スプレッドシート（dev/scores.xlsx）から水谷校舎の生徒の点数を抜き出して JSON にする
// 実行: node dev/make_scores.mjs  →  dev/scores_import.json（GitHub には置かない）
import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'node:fs';

const wb = XLSX.readFile('dev/scores.xlsx');
const CAMPUS = '水谷';
const norm = (s) => String(s || '').replace(/[\s　]/g, '').replace(/髙/g, '高').replace(/﨑/g, '崎').replace(/齊/g, '斉').replace(/齋/g, '斎');
const num = (v) => { const n = Number(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) && String(v).trim() !== '' && String(v) !== '-' ? n : null; };
// シート名 "2026.2" → 年度 2026・第2回。回の意味: 1=1学期中間 2=1学期期末 3=2学期中間 4=2学期期末 5=学年末
const KIND = { 1: '1学期中間', 2: '1学期期末', 3: '2学期中間', 4: '2学期期末', 5: '学年末' };

const rows = [];
for (const name of wb.SheetNames) {
  if (!/^\d{4}\.\d$/.test(name)) continue;
  const [fy, k] = name.split('.');
  const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  const h = data.findIndex((r) => r[0] === '氏名');
  if (h < 0) continue;
  const head = data[h];
  // 「今回」ブロックの先頭（列15付近）を見出しから特定
  const iNow = head.findIndex((c, i) => i > 6 && c === '英語');
  if (iNow < 0) continue;
  for (const r of data.slice(h + 1)) {
    if (!r[0]) continue;
    const campus = norm(r[1]);
    const sc = { 英語: num(r[iNow]), 数学: num(r[iNow + 1]), 国語: num(r[iNow + 2]), 理科: num(r[iNow + 3]), 社会: num(r[iNow + 4]) };
    if (Object.values(sc).every((v) => v == null)) continue;
    rows.push({ campus, name: String(r[0]).trim(), name_key: norm(r[0]), school: String(r[3] || '').trim(), grade_at: num(r[4]),
      period: name, label: `${fy}年度 ${KIND[k] || '第' + k + '回'}`, scores: sc, rank: num(r[iNow + 5]), total: num(r[iNow + 6]) });
  }
}
// 名簿との突き合わせ
const roster = JSON.parse(readFileSync('dev/roster_import.json', 'utf8'));
const byKey = new Map(roster.map((s) => [norm(s.name), s]));
let matched = 0; const unmatched = new Set();
const best = new Map();   // student_no|period → row（水谷校舎の行を優先）
for (const r of rows) {
  const s = byKey.get(r.name_key);
  if (!s) { if (r.campus === CAMPUS) unmatched.add(r.name); continue; }
  const key = s.student_no + '|' + r.period;
  const cur = best.get(key);
  if (!cur || (r.campus === CAMPUS && cur.campus !== CAMPUS)) best.set(key, { ...r, student_no: s.student_no });
}
const out = [...best.values()].map((r) => { matched++; return { student_no: r.student_no, campus: r.campus, period: r.period, label: r.label, grade_at: r.grade_at, scores: r.scores, rank: r.rank, total: r.total }; });
const otherCampus = out.filter((o) => o.campus !== CAMPUS);
console.log('rows matched via other campus:', otherCampus.length, [...new Set(otherCampus.map((o) => o.campus))].join(','));
writeFileSync('dev/scores_import.json', JSON.stringify(out, null, 1));
const perStudent = {}; out.forEach((o) => { perStudent[o.student_no] = (perStudent[o.student_no] || 0) + 1; });
console.log('score rows (水谷校舎):', rows.length, '| matched to roster:', matched, '| students with scores:', Object.keys(perStudent).length, '/', roster.length);
console.log('periods:', [...new Set(out.map((o) => o.period))].sort().join(' '));
console.log('unmatched names (not in roster, e.g. graduates):', unmatched.size);
const missing = roster.filter((s) => !perStudent[s.student_no]).map((s) => s.name);
console.log('roster students without scores:', missing.length, missing.join('、'));
