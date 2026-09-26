// 名簿スプレッドシート（dev/roster.xlsx）の 2027/2028/2029 タブから名簿 JSON を作る
// 実行: node dev/make_roster.mjs  →  dev/roster_import.json
import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

const wb = XLSX.readFile('dev/roster.xlsx');
// タブ名 → 学年, 氏名の列, 学校名の列
const TABS = [
  { sheet: '2027', grade: '中3', nameCol: 0, schoolCol: 1 },
  { sheet: '2028', grade: '中2', nameCol: 0, schoolCol: 2 },
  { sheet: '2029', grade: '中1', nameCol: 0, schoolCol: 1 },
];
const out = [];
const seen = new Set();
for (const t of TABS) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[t.sheet], { header: 1, defval: '' });
  for (const r of rows) {
    const name = String(r[t.nameCol] ?? '').trim();
    if (!name || /^\d+$/.test(name) || /^(名前|氏名|オプチャ名)/.test(name)) continue;
    const school = String(r[t.schoolCol] ?? '').trim();
    const key = `${t.grade}_${name.replace(/[\s　]/g, '')}`;
    if (seen.has(key)) { console.log('重複スキップ:', key); continue; }
    seen.add(key);
    out.push({ student_no: key, name, grade: t.grade, school });
  }
}
writeFileSync('dev/roster_import.json', JSON.stringify(out, null, 1));
const byGrade = {};
out.forEach((s) => { byGrade[s.grade] = (byGrade[s.grade] || 0) + 1; });
console.log('合計', out.length, byGrade);
