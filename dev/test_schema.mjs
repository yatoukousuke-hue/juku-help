// schema.sql を PGlite（WASM版Postgres）で実行して動作確認するスクリプト
// 実行: node dev/test_schema.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(here, '..', 'supabase', 'schema.sql'), 'utf8');

const db = new PGlite();
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('  ok  ', name);
  else { failed++; console.log('  FAIL', name, extra); }
};
const expectError = async (name, fn, msg) => {
  try { await fn(); ok(name, false, '(no error thrown)'); }
  catch (e) { ok(name, String(e.message).includes(msg), e.message); }
};

// Supabase にはあるロールを用意
await db.exec(`create role anon; create role authenticated;`);
await db.exec(sql);
console.log('schema: first run ok');
await db.exec(sql);
console.log('schema: second run ok (idempotent)');

const PASS = 'sensei';
const rpc = async (fn, args) => {
  const keys = Object.keys(args);
  const placeholders = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
  const res = await db.query(`select ${fn}(${placeholders}) as v`, keys.map(k => args[k]));
  return res.rows.map(r => r.v);
};
const rpcSet = async (fn, args) => {
  const keys = Object.keys(args);
  const placeholders = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
  const res = await db.query(`select * from ${fn}(${placeholders})`, keys.map(k => args[k]));
  return res.rows;
};

console.log('\n-- 名簿取込');
const imp = await rpc('teacher_import_students', { p_pass: PASS, p_rows: JSON.stringify([
  { student_no: '1001', name: '佐藤 花子', grade: '中2', school: '第一中' },
  { student_no: '1002', name: '鈴木 太郎', grade: '中3', school: '第二中' },
  { student_no: '', name: 'だめ', grade: '中1', school: '' },
]), p_replace: false });
ok('imported 2', imp[0].imported === 2, JSON.stringify(imp));
await expectError('bad pass rejected', () => rpc('teacher_import_students', { p_pass: 'x', p_rows: '[]', p_replace: false }), 'BAD_PASS');
const students = await rpcSet('list_students', {});
ok('list_students 2 rows w/o school', students.length === 2 && !('school' in students[0]), JSON.stringify(students));
const hanako = students.find(s => s.student_no === '1001');

console.log('\n-- 依頼作成');
const DEV1 = 'device-aaaaaaaa';
const r1 = (await rpc('create_request', {
  p_device_id: DEV1, p_student_id: hanako.id, p_student_name: null, p_grade: null,
  p_classroom: 'A教室', p_seat: '12', p_kind: 'question', p_subject: '数学',
  p_content: 'テキストp.32 問3', p_copies: null, p_urgency: 'now',
}))[0];
ok('receipt_no 1', r1.receipt_no === 1, JSON.stringify(r1));
ok('name from roster', r1.student_name === '佐藤 花子');
ok('position 1', r1.position === 1);
ok('no memo leaked', !('memo' in r1) && !('device_id' in r1));

await expectError('rate limit 15s', () => rpc('create_request', {
  p_device_id: DEV1, p_student_id: null, p_student_name: '山本', p_grade: '中1',
  p_classroom: 'B教室', p_seat: '', p_kind: 'print', p_subject: '英語',
  p_content: 'x', p_copies: 2, p_urgency: null,
}), 'TOO_FAST');

// 別端末から「その他（手入力）」
const DEV2 = 'device-bbbbbbbb';
const r2 = (await rpc('create_request', {
  p_device_id: DEV2, p_student_id: null, p_student_name: '山本 一郎', p_grade: '中1',
  p_classroom: 'B教室', p_seat: '3', p_kind: 'print', p_subject: '英語',
  p_content: '関係代名詞の復習', p_copies: 2, p_urgency: null,
}))[0];
ok('receipt_no 2', r2.receipt_no === 2);
ok('position 2', r2.position === 2);
ok('copies kept, urgency null for print', r2.copies === 2 && r2.urgency === null);

await expectError('missing name', () => rpc('create_request', {
  p_device_id: 'device-cccccccc', p_student_id: null, p_student_name: '  ', p_grade: '',
  p_classroom: 'A教室', p_seat: '', p_kind: 'print', p_subject: '英語', p_content: '', p_copies: null, p_urgency: null,
}), 'NO_NAME');
await expectError('bad kind', () => rpc('create_request', {
  p_device_id: 'device-dddddddd', p_student_id: null, p_student_name: 'x', p_grade: '',
  p_classroom: 'A教室', p_seat: '', p_kind: 'foo', p_subject: '英語', p_content: '', p_copies: null, p_urgency: null,
}), 'BAD_KIND');

console.log('\n-- 生徒側の確認');
const mine = await rpcSet('my_requests', { p_device_id: DEV1 });
ok('my_requests 1 row', mine.length === 1 && mine[0].my_requests.id === r1.id, JSON.stringify(mine));
ok('ahead=0 for first', mine[0].my_requests.ahead === 0);
const byNo = (await rpc('request_by_receipt', { p_receipt_no: 2 }))[0];
ok('receipt lookup masked name', byNo.student_name === '山＊＊' && byNo.ahead === 1, JSON.stringify(byNo));
const none = (await rpc('request_by_receipt', { p_receipt_no: 99 }))[0];
ok('receipt lookup none -> null', none === null);

console.log('\n-- 講師側');
ok('login ok', (await rpc('teacher_login', { p_pass: PASS }))[0] === true);
await expectError('login bad', () => rpc('teacher_login', { p_pass: 'nope' }), 'BAD_PASS');
let list = await rpcSet('teacher_list', { p_pass: PASS });
ok('list 2 rows oldest first', list.length === 2 && list[0].id === r1.id);
ok('list includes device_id (teacher only)', 'device_id' in list[0]);

const started = (await rpcSet('teacher_update', { p_pass: PASS, p_id: r1.id, p_action: 'start', p_teacher: '山田', p_memo: null, p_tags: null }))[0];
ok('start -> in_progress with teacher', started.status === 'in_progress' && started.teacher === '山田' && started.started_at, JSON.stringify(started));
const done = (await rpcSet('teacher_update', { p_pass: PASS, p_id: r1.id, p_action: 'done', p_teacher: '山田', p_memo: '変域でつまずき', p_tags: ['要フォロー', '類題を渡した'] }))[0];
ok('done with memo/tags', done.status === 'done' && done.memo === '変域でつまずき' && done.memo_tags.length === 2 && done.done_at, JSON.stringify(done));
await expectError('bad action', () => rpc('teacher_update', { p_pass: PASS, p_id: r1.id, p_action: 'zzz', p_teacher: null, p_memo: null, p_tags: null }), 'BAD_ACTION');
await expectError('not found', () => rpc('teacher_update', { p_pass: PASS, p_id: 99999, p_action: 'start', p_teacher: null, p_memo: null, p_tags: null }), 'NOT_FOUND');

// 直接完了（対応中を経ずに）
const done2 = (await rpcSet('teacher_update', { p_pass: PASS, p_id: r2.id, p_action: 'done', p_teacher: '田中', p_memo: '', p_tags: ['理解できた'] }))[0];
ok('direct done sets started_at & teacher', done2.started_at && done2.teacher === '田中' && done2.memo === null);

// 紐づけ
const taro = students.find(s => s.student_no === '1002');
const linked = (await rpcSet('teacher_link_student', { p_pass: PASS, p_id: r2.id, p_student_id: taro.id }))[0];
ok('linked to roster', linked.student_id === taro.id && linked.student_name === '鈴木 太郎' && linked.grade === '中3');

// 学生側の取り消し（完了済みは不可）
await expectError('cancel done request fails', () => rpc('cancel_request', { p_id: r1.id, p_device_id: DEV1 }), 'CANNOT_CANCEL');
// 新しい依頼を作って取り消す（DEV2 は15秒制限にかかるので DEV3）
const r3 = (await rpc('create_request', {
  p_device_id: 'device-eeeeeeee', p_student_id: hanako.id, p_student_name: null, p_grade: null,
  p_classroom: 'A教室', p_seat: '12', p_kind: 'print', p_subject: '理科', p_content: 'x', p_copies: 1, p_urgency: null,
}))[0];
await expectError('cancel from other device fails', () => rpc('cancel_request', { p_id: r3.id, p_device_id: 'device-zzzzzzzz' }), 'CANNOT_CANCEL');
const c = (await rpc('cancel_request', { p_id: r3.id, p_device_id: 'device-eeeeeeee' }))[0];
ok('cancel ok', c.status === 'cancelled');

console.log('\n-- 記録・CSV');
const today = (await db.query('select jst_today() as d')).rows[0].d;
const from = new Date(today); from.setDate(from.getDate() - 30);
const hist = await rpcSet('teacher_history', { p_pass: PASS, p_student_id: hanako.id, p_from: from, p_to: today });
ok('history 2 rows for hanako (1 done, 1 cancelled)', hist.length === 2 && hist[0].teacher_history.school === '第一中', JSON.stringify(hist));
const exp = await rpcSet('teacher_export', { p_pass: PASS, p_from: from, p_to: today });
ok('export 3 rows with student_no', exp.length === 3 && exp[1].teacher_export.student_no === '1002', JSON.stringify(exp.map(x => x.teacher_export.student_no)));
const ts = await rpcSet('teacher_students', { p_pass: PASS });
ok('teacher_students includes school', ts.length === 2 && ts[0].school);

// replace import: 1001 だけ → 1002 は無効に
await rpc('teacher_import_students', { p_pass: PASS, p_rows: JSON.stringify([{ student_no: '1001', name: '佐藤 花子', grade: '中2', school: '第一中' }]), p_replace: true });
const after = await rpcSet('list_students', {});
ok('replace import deactivates missing', after.length === 1 && after[0].student_no === '1001');
const tsAfter = await rpcSet('teacher_students', { p_pass: PASS });
ok('inactive still kept for teacher', tsAfter.length === 2);

console.log('\n-- 合言葉変更');
await expectError('too short', () => rpc('teacher_set_pass', { p_pass: PASS, p_new: '12' }), 'PASS_TOO_SHORT');
await rpc('teacher_set_pass', { p_pass: PASS, p_new: 'newpass' });
ok('new pass works', (await rpc('teacher_login', { p_pass: 'newpass' }))[0] === true);
await expectError('old pass fails', () => rpc('teacher_login', { p_pass: PASS }), 'BAD_PASS');

console.log('\n-- 権限（anon で直接テーブルを読めない）');
await db.exec('set role anon');
await expectError('anon cannot select requests', () => db.query('select * from requests'), 'permission denied');
await expectError('anon cannot call check_pass', () => db.query("select check_pass('x')"), 'permission denied');
const anonList = await db.query('select * from list_students()');
ok('anon can call list_students', anonList.rows.length === 1);
await db.exec('reset role');

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
