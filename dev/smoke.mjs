// ブラウザを使わずに画面の動作確認をする（jsdom でお試しモードを動かす）
// 実行: node dev/smoke.mjs
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const read = (f) => readFileSync(path.join(appDir, f), 'utf8');
let failed = 0;
const ok = (name, cond, extra = '') => { if (cond) console.log('  ok  ', name); else { failed++; console.log('  FAIL', name, extra); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 共有 localStorage（生徒画面と講師画面で同じデータを見る）
const shared = new Map();
const storage = {
  getItem: (k) => (shared.has(k) ? shared.get(k) : null), setItem: (k, v) => shared.set(k, String(v)),
  removeItem: (k) => shared.delete(k), clear: () => shared.clear(), key: (i) => Array.from(shared.keys())[i], get length() { return shared.size; },
};

function load(file) {
  let html = read(file);
  // 外部スクリプトをインライン化。config は Supabase 未設定（お試しモード）に差し替える
  html = html.replace(/<script src="config.js"><\/script>/, () => `<script>${read('config.js').replace(/SUPABASE_URL: "[^"]*"/, 'SUPABASE_URL: ""')}</script>`)
             .replace(/<script src="materials.js"><\/script>/, () => `<script>${read('materials.js')}</script>`)
             .replace(/<script src="lib\/supabase.js"><\/script>/, '')
             .replace(/<script src="common.js"><\/script>/, () => `<script>${read('common.js')}</script>`)
             .replace(/<script src="lib\/qrcode.js"><\/script>/, () => `<script>${read('lib/qrcode.js')}</script>`);
  const dom = new JSDOM(html, { url: 'http://localhost/' + file, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) { Object.defineProperty(w, 'localStorage', { value: storage }); w.scrollTo = () => {}; w.HTMLElement.prototype.focus = () => {}; } });
  const w = dom.window;
  w.addEventListener('error', (e) => { failed++; console.log('  FAIL window error in', file, e.message || e.error); });
  const $ = (s) => w.document.querySelector(s);
  const text = () => w.document.body.textContent.replace(/\s+/g, ' ');
  const click = (label, root) => { const b = Array.from((root || w.document).querySelectorAll('button')).find((x) => x.textContent.trim().startsWith(label)); if (!b) throw new Error('no button: ' + label); b.click(); };
  const setVal = (sel, v) => { const el = $(sel); if (!el) throw new Error('no input ' + sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { w, $, text, click, setVal, dom };
}

console.log('--- 生徒画面: 自分の端末 / プリント（チェックあり）');
storage.setItem('jh_device_id', 'd-first-device-xxxx');
let s = load('index.html');
await sleep(300);
ok('モード選択が出る', s.text().includes('この端末は？'));
s.click('📱 自分の端末'); await sleep(50);
ok('ホームにボタン2つ', s.text().includes('プリントがほしい') && s.text().includes('質問したい'));
s.click('📄 プリントがほしい'); await sleep(50);
ok('席番号が出ない', !s.$('#seatInput'));
s.click('中2'); await sleep(50);
ok('中2の名前が出る', s.$('#nameChips').textContent.includes('佐藤 花子') && !s.$('#nameChips').textContent.includes('高橋 美咲'), s.$('#nameChips').textContent);
s.setVal('#nameSearch', 'たなか'); await sleep(50);
ok('ひらがな検索は見つからない', s.text().includes('見つかりません'));
s.setVal('#nameSearch', '田中'); await sleep(50);
ok('名前検索で田中が出る', s.$('#nameChips').textContent.includes('田中 健'));
s.click('田中 健', s.$('#nameChips')); await sleep(50);
ok('本人確定', s.text().includes('田中 健') && s.text().includes('変更'));
ok('学校のステップがあり名簿から自動選択', s.text().includes('中学校') && s.$('#schoolChips .chip.selected') && s.$('#schoolChips .chip.selected').textContent === '水谷');
s.click('その他', s.$('#schoolChips')); await sleep(50);
ok('その他で入力欄', !!s.$('#schoolOther'));
s.click('水谷', s.$('#schoolChips')); await sleep(50);
s.click('3階大教室'); s.click('数学'); await sleep(50);
s.click('類題演習用'); await sleep(50);
ok('事前チェックが出る', s.text().includes('ワークはやった？') && s.text().includes('範囲表は確認した？'));
// 送信を試す → チェック未回答で止まる
s.click('送信する'); await sleep(50);
ok('未回答では送れない', s.text().includes('3つに答えて'));
const rows = () => Array.from(s.w.document.querySelectorAll('.checkrow'));
rows()[0].querySelectorAll('button')[0].click(); await sleep(30); // ワーク: やった
rows()[1].querySelectorAll('button')[1].click(); await sleep(30); // テスト形式: まだ
rows()[2].querySelectorAll('button')[0].click(); await sleep(30); // 範囲表: やった
ok('「まだ」があると理由欄が出る', s.$('#reasonInput') && s.text().includes('テスト形式'));
ok('数学は「教科書のページ」ラベル', s.text().includes('教科書のページ（必須）'));
s.setVal('#unitInput', '一次関数');
s.click('標準'); s.click('ふつう'); await sleep(50);
s.setVal('#reasonInput', '明日テスト');
s.click('送信する'); await sleep(100);
ok('ページ未入力では送れない', s.$('#toast').textContent.includes('教科書のページを入力'), s.$('#toast').textContent);
s.setVal('#pageInput', 'ワーク p.32〜35'); s.setVal('#reasonInput', '');
s.click('送信する'); await sleep(100);
ok('理由なしでは送れない', s.text().includes('理由を書いて'));
s.setVal('#reasonInput', '明日テスト');
s.click('送信する'); await sleep(500);
ok('受付番号が出る', s.text().includes('受け付けました') && s.text().includes('受付番号'), s.text().slice(0, 200));
ok('受付画面に単元・難易度', s.text().includes('一次関数') && s.text().includes('標準・ふつう'));
s.click('ホームにもどる'); await sleep(400);
ok('自分の依頼に表示', s.text().includes('#1') && s.text().includes('類題演習用'));

console.log('--- 生徒画面: 質問（シンキング確認）');
s.click('✋ 質問したい'); await sleep(50);
ok('シンキングの質問が最初に出る', s.text().includes('シンキングした？'));
ok('答えるまで他の入力は隠れる', s.$('#restOfForm').classList.contains('hidden'));
s.click('まだ'); await sleep(50);
ok('「まだ」で注意が出る', s.text().includes('まずは自分で5分'));
s.click('考えてくる'); await sleep(300);
ok('ホームに戻る', s.text().includes('プリントがほしい'));
s.click('✋ 質問したい'); await sleep(50);
s.click('✅ した'); await sleep(50);
ok('「した」で入力が出る', !s.$('#restOfForm').classList.contains('hidden'));
s.click('3階大教室'); s.click('英語'); await sleep(30);
s.setVal('#unitInput', '関係代名詞'); s.setVal('#pageInput', 'p.40 問2');
s.click('🔴 早めに来てほしい'); await sleep(30);
s.click('送信する'); await sleep(300);
ok('15秒制限にかかる', s.$('#toast') && s.$('#toast').textContent.includes('15秒'));
// 制限回避のためデバイスIDを変えて再送（localStorage の生の値。deviceId() は JSON ではなく生文字列を読む）
storage.setItem('jh_device_id', 'd-second-device-xxxx');
s = load('index.html'); await sleep(300);
s.click('✋ 質問したい'); await sleep(50); s.click('✅ した'); await sleep(50);
s.click('変更'); await sleep(30); s.click('中1'); await sleep(30); s.click('高橋 美咲', s.$('#nameChips')); await sleep(30);
s.click('個別部屋'); s.click('英語'); await sleep(30);
ok('英語は「教科書のユニット」ラベル', s.text().includes('教科書のユニット（必須）'));
s.setVal('#unitInput', '関係代名詞');
s.click('🔴 早めに来てほしい'); await sleep(30);
s.click('送信する'); await sleep(100);
ok('質問もユニット未入力では送れない', s.$('#toast').textContent.includes('教科書のユニットを入力'), s.$('#toast').textContent);
s.setVal('#pageInput', 'Unit 4 p.40 問2');
s.click('送信する'); await sleep(400);
ok('質問が送れた', s.text().includes('受け付けました') && s.text().includes('関係代名詞'), s.text().slice(0, 300));

// 3件目: 同じ単元（中2 数学 一次関数）のプリントを別の生徒から
storage.setItem('jh_device_id', 'd-third-device-xxxx');
s = load('index.html'); await sleep(300);
s.click('📄 プリントがほしい'); await sleep(50);
s.click('変更'); await sleep(30); s.click('中2'); await sleep(30); s.click('佐藤 花子', s.$('#nameChips')); await sleep(30);
s.click('2階中教室'); s.click('数学'); await sleep(30);
s.click('苦手だからポイント確認から'); await sleep(30);
ok('ポイント確認は事前チェックなし', !s.$('#checkRows'));
ok('手順番号が順番どおり', /1\s*だれ？[\s\S]*2\s*中学校[\s\S]*3\s*どこ？[\s\S]*4\s*教科[\s\S]*5\s*プリントの目的[\s\S]*6\s*単元・範囲/.test(s.text()), s.text().slice(0, 300));
s.setVal('#unitInput', '一次関数 '); s.setVal('#pageInput', 'p.30〜33');
s.click('基礎'); s.click('少なめ'); await sleep(30);
s.click('送信する'); await sleep(400);
ok('3件目が送れた', s.text().includes('受け付けました'), s.text().slice(0, 200));

console.log('--- 講師画面');
storage.removeItem('jh_tpass');
let t = load('teacher.html'); await sleep(300);
ok('ログイン画面', t.text().includes('合言葉'));
t.setVal('#pass', 'sensei'); t.setVal('#tname', '山田'); t.click('入る'); await sleep(600);
ok('一覧に3件', t.w.document.querySelectorAll('.req').length === 3, t.text().slice(0, 300));
// 点数・目標を入れて、カードの「パッと見」を確認
{
  const api = t.w.JH.api;
  const st = await api.teacherStudents('sensei');
  const tanaka = st.find((x) => x.name === '田中 健'); const sato = st.find((x) => x.name === '佐藤 花子');
  const imp = await api.teacherImportScores('sensei', [
    { student_no: tanaka.student_no, period: '2026.1', label: '2026年度 1学期中間', grade_at: 2, scores: { 英語: 70, 数学: 42, 国語: 60, 理科: 55, 社会: 50 }, rank: 30, total: 277 },
    { student_no: tanaka.student_no, period: '2025.5', label: '2025年度 学年末', grade_at: 1, scores: { 数学: 48 }, rank: null, total: null },
    { student_no: sato.student_no, period: '2026.1', label: '2026年度 1学期中間', grade_at: 2, scores: { 数学: 92 }, rank: 2, total: 460 },
  ]);
  ok('点数の取り込み（お試し）', imp.imported === 3);
  await api.teacherSetTargets('sensei', sato.id, { 数学: 95, '5科': 470 });
}
await sleep(1200);
// loadContext は起動時に1回。テストでは再ログインで読み直す
storage.setItem('jh_tpass', JSON.stringify('sensei'));
t = load('teacher.html'); await sleep(900);
{
  const c1 = t.$('#req-1'), c3 = t.$('#req-3');
  ok('田中（数学42点）→ 1行版に点数と基礎', c1.querySelector('.assist.mini') && c1.querySelector('.assist.mini').textContent.includes('42点') && c1.querySelector('.assist.mini').textContent.includes('基礎'), c1.querySelector('.assist.mini') && c1.querySelector('.assist.mini').textContent);
  ok('田中にテキスト候補（1行版）', c1.querySelector('.assist.mini').textContent.includes('📚'));
  ok('佐藤（92点・目標95・依頼は基礎）→ 応用＋注意（1行版）', c3.querySelector('.assist.mini').textContent.includes('応用') && c3.querySelector('.assist.mini').textContent.includes('⚠') && c3.querySelector('.assist.mini').classList.contains('warn'), c3.querySelector('.assist.mini').textContent);
  ok('質問カードにはブロックなし', !t.$('#req-2').querySelector('.assist'));
  t.click('詳細', c1); await sleep(100);
  const full = t.$('#req-1').querySelector('.assist:not(.mini)');
  ok('詳細を開くと点数の全文（前回点・候補名）', full && full.textContent.includes('直近 数学42点') && full.textContent.includes('前回48') && /フォレスタ ドリル|Keyワーク|iワーク テキスト|必修テキスト/.test(full.textContent), full && full.textContent);
  const dt = t.$('#req-1').querySelector('table.detail').textContent;
  ok('詳細に点数履歴・目標・テキスト候補・直近プリント', dt.includes('2026年度 1学期中間') && dt.includes('目標点') && dt.includes('テキスト候補') && dt.includes('直近のプリント'), dt.slice(0, 400));
  t.click('目標を設定', t.$('#req-1')); await sleep(100);
  const tm = t.$('.modal');
  ok('目標モーダル', tm && tm.textContent.includes('目標点：田中 健'));
  tm.querySelector('[data-tk="数学"]').value = '70';
  t.click('保存', tm); await sleep(300);
  ok('目標保存後にカードへ反映', t.$('#req-1').querySelector('.assist').textContent.includes('目標70'), t.$('#req-1').querySelector('.assist').textContent);
  t.click('閉じる', t.$('#req-1')); await sleep(50);
}
ok('学年・教科・並び順のフィルタがある', t.$('#fGrade') && t.$('#fSubject') && t.$('#fSort'));
ok('同じ単元バッジ（田中と佐藤の一次関数）', t.$('#req-1').textContent.includes('同じ単元 あと1人') && t.$('#req-3').textContent.includes('同じ単元 あと1人'));
ok('まとめバーにグループ（学校込み）', t.$('#groupBar').textContent.includes('中2・水谷 数学「一次関数」') && t.$('#groupBar').textContent.includes('2人'), t.$('#groupBar').textContent);
// グループチップで絞り込み → プリントだけ・学年→教科→単元順
t.$('#groupBar .groupchip').click(); await sleep(100);
ok('絞り込みで2件（質問は除外・学校も）', t.w.document.querySelectorAll('.req').length === 2 && t.$('#fGrade').value === '中2' && t.$('#fSubject').value === '数学' && t.$('#fSchool').value === '水谷' && t.$('#fSort').value === 'group');
t.click('📄 表示中のプリント2件をまとめて指示書'); await sleep(100);
const ms = t.$('#slipText');
ok('まとめて指示書に2人分', ms && ms.textContent.includes('2件') && ms.textContent.includes('田中 健') && ms.textContent.includes('佐藤 花子') && ms.textContent.split('----------------').length === 2, ms && ms.textContent.slice(0, 300));
t.click('閉じる', t.$('.modal')); await sleep(50);
// フィルタ解除
t.$('#fGrade').value = ''; t.$('#fGrade').dispatchEvent(new t.w.Event('change'));
t.$('#fSubject').value = ''; t.$('#fSubject').dispatchEvent(new t.w.Event('change'));
t.$('#fSchool').value = ''; t.$('#fSchool').dispatchEvent(new t.w.Event('change'));
t.$('#fKind').value = ''; t.$('#fKind').dispatchEvent(new t.w.Event('change')); await sleep(50);
ok('解除で3件に戻る', t.w.document.querySelectorAll('.req').length === 3);
const card1 = t.$('#req-1');
ok('カードに目的・単元・難易度・量', card1.textContent.includes('類題演習用') && card1.textContent.includes('一次関数') && card1.textContent.includes('標準・ふつう'));
ok('初期表示は小さな印だけ（理由は隠れる）', card1.textContent.includes('確認まだ1') && !card1.textContent.includes('理由: 明日テスト'));
ok('科目と単元・範囲が大きく出る', card1.querySelector('.l2.big .subj').textContent === '数学' && card1.querySelector('.l2.big .unit').textContent === '一次関数' && card1.querySelector('.l2.big .range').textContent.includes('p.32'));
ok('席番号が出ない', !card1.textContent.includes('席'));
ok('詳細は最初は閉じている', !card1.querySelector('table.detail'));
t.click('詳細', card1); await sleep(100);
const c1 = t.$('#req-1');
ok('詳細テーブルが開く', !!c1.querySelector('table.detail'));
const dt = c1.querySelector('table.detail').textContent;
ok('詳細に事前チェックの回答', dt.includes('ワークはやった？') && dt.includes('やった') && dt.includes('まだ') && dt.includes('明日テスト'), dt);
ok('詳細を開くと理由つきのフラグも出る', c1.textContent.includes('テスト形式未') && c1.textContent.includes('理由: 明日テスト'));
ok('詳細に単元・ページ・難易度・量・学校', dt.includes('一次関数') && dt.includes('ワーク p.32〜35') && dt.includes('標準・ふつう') && dt.includes('水谷'), dt);
ok('カード1行目に学年・学校', c1.querySelector('.who').textContent.includes('中2・水谷'));
ok('学校の絞り込みがある', !!t.$('#fSchool'));
t.click('閉じる', c1); await sleep(100);
ok('詳細が閉じる', !t.$('#req-1').querySelector('table.detail'));
t.$('#req-2').querySelector('.l2').click(); await sleep(100);
const d2 = t.$('#req-2').querySelector('table.detail');
ok('2行目タップで質問の詳細（急ぎ度・シンキング）', d2 && d2.textContent.includes('早めに来てほしい') && d2.textContent.includes('シンキング'), d2 && d2.textContent);
t.$('#req-2').querySelector('.l2').click(); await sleep(50);
const card2 = t.$('#req-2');
ok('質問カードに早めにバッジ', card2.classList.contains('urgent') && card2.textContent.includes('早めに'));
ok('接続表示', t.$('#conn').textContent.includes('更新'));
// 早めにタイルで絞り込み
t.$('#tileUrgent').click(); await sleep(100);
ok('緊急だけに絞られる', t.w.document.querySelectorAll('.req').length === 1 && t.$('#req-2'));
t.$('#tileUrgent').click(); await sleep(100);
ok('絞り込み解除', t.w.document.querySelectorAll('.req').length === 3);
// 対応する → 完了（メモ）
t.click('対応する', t.$('#req-1')); await sleep(500);
ok('対応中へ', !t.$('#req-1'));
t.click('対応中'); await sleep(100);
ok('対応中でも受付からの経過時間', t.$('#req-1') && /受付から \d+分（対応 \d+分）/.test(t.$('#req-1').textContent), t.$('#req-1') && t.$('#req-1').querySelector('.time').textContent);
t.click('待ち'); await sleep(100);
// 生徒側（1件目を送った端末）に「先生が向かっています」
storage.setItem('jh_device_id', 'd-first-device-xxxx');
const s1 = load('index.html'); await sleep(400);
ok('生徒側に「向かっています」と担当名', s1.text().includes('山田先生が向かっています'), s1.text().slice(0, 300));
t.click('対応中'); await sleep(100);
t.click('完了にする', t.$('#req-1')); await sleep(100);
const modal = t.$('.modal');
ok('完了モーダル', modal && modal.textContent.includes('要フォロー'));
t.click('キャンセル', modal); await sleep(50);
t.click('待ち'); await sleep(100);
// 指示書（待ちタブには #2 の質問だけなので、完了タブの #1 で確認）
t.click('待ち'); await sleep(100);
ok('質問カードに指示書ボタンは出ない', t.$('#req-2') && !t.$('#req-2').textContent.includes('指示書'));
t.click('対応中'); await sleep(100);
t.click('📄 指示書', t.$('#req-1')); await sleep(100);
const slip = t.$('#slipText');
ok('指示書モーダル', !!slip, t.text().slice(0, 200));
ok('指示書に依頼内容と文面', slip.textContent.includes('田中 健') && slip.textContent.includes('（水谷）') && slip.textContent.includes('一次関数') && slip.textContent.includes('ワーク p.32〜35') && slip.textContent.includes('類題演習用') && slip.textContent.includes('標準') && slip.textContent.includes('テスト形式:未') && slip.textContent.includes('明日テスト') && slip.textContent.includes('作ってください'), slip.textContent);
t.click('閉じる', t.$('.modal')); await sleep(50);
t.click('完了にする', t.$('#req-1')); await sleep(100);
const modal2 = t.$('.modal');
ok('完了モーダルにも全内容', modal2.querySelector('table.detail') && modal2.textContent.includes('明日テスト'));
t.click('要フォロー', modal2); t.click('類題を渡した', modal2);
modal2.querySelector('#memoText').value = '変域でつまずき';
t.click('完了にする', modal2); await sleep(500);
ok('モーダルが閉じる', !t.$('.modal'));
t.click('完了'); await sleep(300);
const ho1 = t.$('.handover .ho[data-id="1"]');
ok('完了タブ: 誰に何を渡したか＋メモ', ho1 && ho1.textContent.includes('田中 健') && ho1.textContent.includes('数学') && ho1.textContent.includes('一次関数') && ho1.textContent.includes('山田') && ho1.textContent.includes('変域でつまずき') && ho1.textContent.includes('要フォロー'), t.$('#doneList') && t.$('#doneList').textContent.slice(0, 300));
ok('完了タブの集計行', t.$('#doneList').textContent.includes('完了 1 件') && t.$('#doneList').textContent.includes('山田 1'));
t.click('◀ 前日'); await sleep(300);
ok('前日は完了なし', t.$('#doneList').textContent.includes('この日の完了はありません'), t.$('#doneList').textContent.slice(0, 200));
t.click('今日'); await sleep(300);
ok('今日に戻る', !!t.$('.handover .ho[data-id="1"]'));
// 2段階の取消
t.click('待ち'); await sleep(100);
t.click('取消', t.$('#req-2')); await sleep(50);
ok('取消は2段階', t.$('#req-2') && t.$('#req-2').textContent.includes('本当に取消'), (t.$('#req-2') || {textContent: 'no card: ' + t.$('#list').textContent.slice(0, 200)}).textContent);
// 前回のプリント表示: 田中がもう1枚頼む（別端末扱い）
storage.setItem('jh_device_id', 'd-fourth-device-xxxx');
{
  const s4 = load('index.html'); await sleep(300);
  s4.click('📄 プリントがほしい'); await sleep(50);
  s4.click('変更'); await sleep(30); s4.click('中2'); await sleep(30); s4.click('田中 健', s4.$('#nameChips')); await sleep(30);
  s4.click('3階大教室'); s4.click('数学'); await sleep(30);
  s4.click('苦手だからポイント確認から'); await sleep(30);
  s4.setVal('#unitInput', '一次関数'); s4.setVal('#pageInput', 'p.36');
  s4.click('基礎'); s4.click('少なめ'); await sleep(30);
  s4.click('送信する'); await sleep(400);
  ok('田中の2枚目が送れた', s4.text().includes('受け付けました'));
}
storage.setItem('jh_tpass', JSON.stringify('sensei'));
t = load('teacher.html'); await sleep(900);
{
  const c4 = t.$('#req-4');
  ok('前回のプリントと「さっきのやった？」（1行版）', c4 && c4.querySelector('.assist.mini') && c4.querySelector('.assist.mini').textContent.includes('今日2枚目') && c4.querySelector('.assist.mini').textContent.includes('さっきのやった？'), c4 && c4.querySelector('.assist.mini') && c4.querySelector('.assist.mini').textContent);
  t.click('📄 指示書', c4); await sleep(100);
  ok('指示書におすすめレベルとテキスト', t.$('#slipText').textContent.includes('おすすめレベル：標準') && t.$('#slipText').textContent.includes('テキスト候補：'), t.$('#slipText').textContent.slice(-300));
  t.click('閉じる', t.$('.modal')); await sleep(50);
}
// 記録
t.click('記録'); await sleep(400);
t.setVal('#rSearch', '田中'); await sleep(50);
ok('名前検索でヒット', t.$('#rHits').textContent.includes('田中 健'));
t.$('#rHits button').click(); await sleep(400);
ok('ヒットを押すと記録が出る', t.$('#rResult').textContent.includes('田中 健'), t.$('#rResult').textContent.slice(0, 200));
t.click('先月'); t.click('今月'); await sleep(30);
t.click('表示'); await sleep(400);
ok('集計に目的内訳', t.text().includes('プリント') && t.text().includes('類題演習用'), t.$('#rResult').textContent.slice(0, 300));
ok('記録タブに点数表', t.$('#rResult').textContent.includes('定期テストの点数') && t.$('#rResult').textContent.includes('2026年度 1学期中間'));
t.click('📋 保護者報告'); await sleep(50);
const rep = t.$('#reportText').textContent;
ok('報告文に単元と目的', rep.includes('一次関数') && rep.includes('類題演習用') && rep.includes('変域でつまずき'), rep);
// 設定: 名簿取込（学年+氏名/学校）
t.click('設定'); await sleep(400);
t.$('#rosterGrade').value = '中3';
t.setVal('#rosterText', '氏名\t学校名\n新井 太郎\t第五中\n伊藤 さくら\t第一中');
ok('プレビュー2人', t.$('#rosterPreview').textContent.includes('2人'));
t.click('取り込む'); await sleep(50); t.click('2人を取り込む'); await sleep(500);
ok('名簿に追加', t.text().includes('新井 太郎'));
const db = JSON.parse(storage.getItem('jh_local_db_v1'));
ok('student_no は 学年_氏名', db.students.some((x) => x.student_no === '中3_新井太郎'));
ok('既存の伊藤さくらは上書き（重複なし）', db.students.filter((x) => x.name === '伊藤 さくら').length === 1);
t.setVal('#rosterFilter', '新井'); await sleep(50);
const visible = Array.from(t.w.document.querySelectorAll('#rosterTable tr[data-name]')).filter((tr) => tr.style.display !== 'none');
ok('名簿の絞り込み', visible.length === 1 && visible[0].textContent.includes('新井 太郎'));
t.click('無効にする', visible[0]); await sleep(50); t.click('本当に無効にする', t.$('#rosterTable')); await sleep(500);
const arai = Array.from(t.w.document.querySelectorAll('#rosterTable tr[data-name]')).find((tr) => tr.dataset.name === '新井 太郎');
ok('無効になった', arai && arai.classList.contains('inactive') && arai.textContent.includes('戻す'));
ok('生徒側の名簿から消える', !(await t.w.JH.api.listStudents()).some((x) => x.name === '新井 太郎'));
t.click('戻す', arai); await sleep(500);
ok('戻すと有効', (await t.w.JH.api.listStudents()).some((x) => x.name === '新井 太郎'));

console.log('--- QR ページ');
const q = load('qr.html'); await sleep(200);
ok('QR画像が出る', !!q.$('#qr img'));

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
