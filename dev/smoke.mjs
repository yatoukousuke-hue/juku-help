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
s.setVal('#unitInput', '一次関数'); s.setVal('#pageInput', 'ワーク p.32〜35');
s.click('標準'); s.click('ふつう'); await sleep(50);
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
s.setVal('#unitInput', '関係代名詞'); s.setVal('#pageInput', 'p.40 問2');
s.click('🔴 早めに来てほしい'); await sleep(30);
s.click('送信する'); await sleep(400);
ok('質問が送れた', s.text().includes('受け付けました') && s.text().includes('関係代名詞'), s.text().slice(0, 300));

console.log('--- 講師画面');
storage.removeItem('jh_tpass');
let t = load('teacher.html'); await sleep(300);
ok('ログイン画面', t.text().includes('合言葉'));
t.setVal('#pass', 'sensei'); t.setVal('#tname', '山田'); t.click('入る'); await sleep(600);
ok('一覧に2件', t.w.document.querySelectorAll('.req').length === 2, t.text().slice(0, 300));
const card1 = t.$('#req-1');
ok('カードに目的・単元・難易度・量', card1.textContent.includes('類題演習用') && card1.textContent.includes('一次関数') && card1.textContent.includes('標準・ふつう'));
ok('未実施フラグと理由', card1.textContent.includes('テスト形式未') && card1.textContent.includes('理由: 明日テスト'));
ok('席番号が出ない', !card1.textContent.includes('席'));
ok('詳細は最初は閉じている', !card1.querySelector('table.detail'));
t.click('詳細', card1); await sleep(100);
const c1 = t.$('#req-1');
ok('詳細テーブルが開く', !!c1.querySelector('table.detail'));
const dt = c1.querySelector('table.detail').textContent;
ok('詳細に事前チェックの回答', dt.includes('ワークはやった？') && dt.includes('やった') && dt.includes('まだ') && dt.includes('明日テスト'), dt);
ok('詳細に単元・ページ・難易度・量・学校', dt.includes('一次関数') && dt.includes('ワーク p.32〜35') && dt.includes('標準・ふつう') && dt.includes('第三中'), dt);
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
ok('絞り込み解除', t.w.document.querySelectorAll('.req').length === 2);
// 対応する → 完了（メモ）
t.click('対応する', t.$('#req-1')); await sleep(500);
ok('対応中へ', !t.$('#req-1'));
// 生徒側（1件目を送った端末）に「先生が向かっています」
storage.setItem('jh_device_id', 'd-first-device-xxxx');
const s1 = load('index.html'); await sleep(400);
ok('生徒側に「向かっています」と担当名', s1.text().includes('山田先生が向かっています'), s1.text().slice(0, 300));
t.click('対応中'); await sleep(100);
t.click('完了にする', t.$('#req-1')); await sleep(100);
const modal = t.$('.modal');
ok('完了モーダル', modal && modal.textContent.includes('要フォロー'));
ok('完了モーダルにも全内容', modal.querySelector('table.detail') && modal.textContent.includes('明日テスト'));
t.click('要フォロー', modal); t.click('類題を渡した', modal);
modal.querySelector('#memoText').value = '変域でつまずき';
t.click('完了にする', modal); await sleep(500);
ok('モーダルが閉じる', !t.$('.modal'));
t.click('完了'); await sleep(100);
ok('完了タブにメモ', t.$('#req-1') && t.$('#req-1').textContent.includes('変域でつまずき') && t.$('#req-1').textContent.includes('要フォロー'));
// 2段階の取消
t.click('待ち'); await sleep(100);
t.click('取消', t.$('#req-2')); await sleep(50);
ok('取消は2段階', t.$('#req-2') && t.$('#req-2').textContent.includes('本当に取消'));
// 記録
t.click('記録'); await sleep(400);
const sel = t.$('#rSid'); sel.value = Array.from(sel.options).find((o) => o.textContent.includes('田中')).value;
t.click('先月'); t.click('今月'); await sleep(30);
t.click('表示'); await sleep(400);
ok('集計に目的内訳', t.text().includes('プリント') && t.text().includes('類題演習用'), t.$('#rResult').textContent.slice(0, 300));
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

console.log('--- QR ページ');
const q = load('qr.html'); await sleep(200);
ok('QR画像が出る', !!q.$('#qr img'));

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
