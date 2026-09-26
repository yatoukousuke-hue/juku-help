/* 共通部品: データ接続（Supabase / お試しモード）・表示用ヘルパー */
(function () {
  'use strict';
  const C = window.APP_CONFIG;

  // ---------- 小物 ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTime = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '');
  const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayYmd = () => ymd(new Date());
  const minutesSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const elapsedText = (iso) => { const m = minutesSince(iso); return m < 60 ? `${m}分` : `${Math.floor(m / 60)}時間${m % 60}分`; };
  const KIND_LABEL = { print: 'プリント', question: '質問' };
  const KIND_ICON = { print: '📄', question: '✋' };
  const STATUS_LABEL = { waiting: '待ち', in_progress: '対応中', done: '完了', cancelled: '取消' };
  const URGENCY_LABEL = Object.assign({ now: '早めに来てほしい', later: 'あとででOK' }, C.URGENCY_LABELS || {});
  const toMap = (list) => (list || []).reduce((m, x) => { m[x.key] = x.label; return m; }, {});
  const PURPOSE_LABEL = toMap(C.PRINT_PURPOSES);
  const AMOUNT_LABEL = toMap(C.PRINT_AMOUNTS);
  const DIFF_LABEL = toMap(C.PRINT_DIFFICULTIES);
  const CHECK_LABEL = toMap(C.PRINT_CHECKS);
  // 事前チェックで「まだ」だった項目の一覧（講師画面の注意表示用）
  const unmetChecks = (r) => {
    if (r.kind !== 'print' || !r.checks || typeof r.checks !== 'object') return [];
    const p = (C.PRINT_PURPOSES || []).find((x) => x.key === r.purpose);
    if (!p || !p.needsCheck) return [];
    return (C.PRINT_CHECKS || []).filter((c) => r.checks[c.key] === false).map((c) => c.label.replace(/[はを]?(やった|確認した)？$/, ''));
  };

  const ERROR_TEXT = {
    TOO_FAST: '送信の間隔が短すぎます。15秒ほど待ってからもう一度送ってください。',
    TOO_MANY: 'この端末からの送信が多すぎます。講師に直接声をかけてください。',
    BAD_PASS: '合言葉がちがいます。',
    CANNOT_CANCEL: 'この依頼は取り消せません（すでに対応中か完了しています）。',
    NO_NAME: '名前を選んでください。',
    NO_CLASSROOM: '教室を選んでください。',
    NO_SUBJECT: '教科を選んでください。',
    CONTENT_TOO_LONG: '内容が長すぎます（200文字まで）。',
    TOO_LONG: '入力が長すぎます。',
    NO_STUDENT: '名簿にその生徒がいません。',
    NO_PURPOSE: 'プリントの目的を選んでください。',
    NOT_FOUND: '対象の依頼が見つかりません（すでに変更されたかもしれません）。',
    PASS_TOO_SHORT: '合言葉は4文字以上にしてください。',
    BAD_DEVICE: '端末の識別に失敗しました。ページを再読み込みしてください。',
  };
  function errorText(e) {
    const m = (e && (e.message || e.error_description || e.error)) || String(e || '');
    for (const k of Object.keys(ERROR_TEXT)) if (m.includes(k)) return ERROR_TEXT[k];
    if (/fetch|network|Failed|load/i.test(m)) return '通信できませんでした。電波の状態を確認して、もう一度お試しください。';
    return 'エラー: ' + m;
  }

  // トースト表示
  function toast(msg, kind) {
    let box = $('#toast');
    if (!box) { box = document.createElement('div'); box.id = 'toast'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'error' ? 5000 : 2500);
  }

  // 端末の識別子（個人情報ではない。いたずら対策と「自分の依頼」の判定に使う）
  function deviceId() {
    let id = null;
    try { id = localStorage.getItem('jh_device_id'); } catch (_) {}
    if (!id) {
      id = 'd-' + (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)));
      try { localStorage.setItem('jh_device_id', id); } catch (_) {}
    }
    return id;
  }
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (_) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };

  // ---------- データ接続 ----------
  const useSupabase = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);

  // --- Supabase 版 ---
  function supabaseApi() {
    const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const call = async (fn, args) => {
      const { data, error } = await sb.rpc(fn, args || {});
      if (error) throw new Error(error.message || JSON.stringify(error));
      return data;
    };
    return {
      mode: 'supabase',
      listStudents: () => call('list_students'),
      createRequest: (p) => call('create_request', {
        p_device_id: p.device_id, p_student_id: p.student_id ?? null, p_student_name: p.student_name ?? null,
        p_grade: p.grade ?? null, p_classroom: p.classroom, p_seat: p.seat ?? '', p_kind: p.kind,
        p_subject: p.subject, p_content: p.content ?? '', p_copies: p.copies ?? null, p_urgency: p.urgency ?? null,
        p_purpose: p.purpose ?? null, p_amount: p.amount ?? null, p_difficulty: p.difficulty ?? null,
        p_unit_name: p.unit_name ?? '', p_page_range: p.page_range ?? '', p_checks: p.checks ?? {},
      }),
      myRequests: (dev) => call('my_requests', { p_device_id: dev }),
      requestByReceipt: (no) => call('request_by_receipt', { p_receipt_no: no }),
      cancelRequest: (id, dev) => call('cancel_request', { p_id: id, p_device_id: dev }),
      teacherLogin: (pass) => call('teacher_login', { p_pass: pass }),
      teacherList: (pass) => call('teacher_list', { p_pass: pass }),
      teacherUpdate: (pass, id, action, teacher, memo, tags) => call('teacher_update', { p_pass: pass, p_id: id, p_action: action, p_teacher: teacher ?? null, p_memo: memo ?? null, p_tags: tags ?? null }),
      teacherLinkStudent: (pass, id, sid) => call('teacher_link_student', { p_pass: pass, p_id: id, p_student_id: sid }),
      teacherHistory: (pass, sid, from, to) => call('teacher_history', { p_pass: pass, p_student_id: sid, p_from: from, p_to: to }),
      teacherExport: (pass, from, to) => call('teacher_export', { p_pass: pass, p_from: from, p_to: to }),
      teacherStudents: (pass) => call('teacher_students', { p_pass: pass }),
      teacherImportStudents: (pass, rows, replace) => call('teacher_import_students', { p_pass: pass, p_rows: rows, p_replace: !!replace }),
      teacherSetPass: (pass, nw) => call('teacher_set_pass', { p_pass: pass, p_new: nw }),
    };
  }

  // --- お試しモード（このブラウザの localStorage に保存。SQL と同じルールで動く） ---
  function localApi() {
    const KEY = 'jh_local_db_v1';
    const load = () => store.get(KEY, null) || seed();
    const save = (db) => store.set(KEY, db);
    function seed() {
      const db = { pass: 'sensei', seq: 0, sseq: 0, students: [], requests: [] };
      [['佐藤 花子', '中2', '第一中'], ['鈴木 太郎', '中3', '第二中'], ['高橋 美咲', '中1', '第一中'],
       ['田中 健', '中2', '第三中'], ['伊藤 さくら', '中3', '第一中'], ['渡辺 大輝', '中1', '第二中']]
        .forEach(([name, grade, school]) => db.students.push({ id: ++db.sseq, student_no: `${grade}_${name.replace(/[\s　]/g, '')}`, name, grade, school, active: true }));
      save(db); return db;
    }
    const nowIso = () => new Date().toISOString();
    const jstToday = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); };
    const checkPass = (db, p) => { if (!p || p !== db.pass) throw new Error('BAD_PASS'); };
    const pub = (db, r) => ({
      id: r.id, receipt_no: r.receipt_no, day: r.day, student_name: r.student_name, classroom: r.classroom, seat: r.seat,
      kind: r.kind, subject: r.subject, content: r.content, copies: r.copies, urgency: r.urgency, status: r.status,
      purpose: r.purpose, amount: r.amount, difficulty: r.difficulty, unit_name: r.unit_name, page_range: r.page_range,
      teacher: r.status === 'in_progress' ? r.teacher : null,
      created_at: r.created_at, started_at: r.started_at, done_at: r.done_at,
      ahead: r.status === 'waiting' ? db.requests.filter((w) => w.status === 'waiting' && w.created_at < r.created_at).length : 0,
    });
    const delay = (v) => new Promise((res) => setTimeout(() => res(v), 120));
    return {
      mode: 'local',
      listStudents: async () => delay(load().students.filter((s) => s.active).map(({ id, student_no, name, grade }) => ({ id, student_no, name, grade }))
        .sort((a, b) => a.grade.localeCompare(b.grade) || a.student_no.localeCompare(b.student_no))),
      createRequest: async (p) => {
        const db = load();
        const t = Date.now();
        if (db.requests.some((r) => r.device_id === p.device_id && t - new Date(r.created_at).getTime() < 15000)) throw new Error('TOO_FAST');
        if (db.requests.filter((r) => r.device_id === p.device_id && t - new Date(r.created_at).getTime() < 3600e3).length >= 30) throw new Error('TOO_MANY');
        let name = (p.student_name || '').trim(), grade = p.grade || '', sid = p.student_id ?? null;
        if (sid != null) { const s = db.students.find((x) => x.id === sid); if (!s) throw new Error('NO_STUDENT'); name = s.name; grade = s.grade; }
        if (!name) throw new Error('NO_NAME');
        if (!p.classroom) throw new Error('NO_CLASSROOM');
        if (!['print', 'question'].includes(p.kind)) throw new Error('BAD_KIND');
        if (!p.subject) throw new Error('NO_SUBJECT');
        if ((p.content || '').length > 200) throw new Error('CONTENT_TOO_LONG');
        if (p.kind === 'print' && !['point', 'practice', 'weak', 'test'].includes(p.purpose)) throw new Error('NO_PURPOSE');
        const day = jstToday();
        const no = db.requests.filter((r) => r.day === day).reduce((m, r) => Math.max(m, r.receipt_no), 0) + 1;
        const r = {
          id: ++db.seq, created_at: nowIso(), day, receipt_no: no, student_id: sid, student_name: name, grade,
          classroom: p.classroom, seat: (p.seat || '').trim(), kind: p.kind, subject: p.subject, content: (p.content || '').trim(),
          copies: p.kind === 'print' ? (p.copies ?? null) : null, urgency: p.kind === 'question' ? (p.urgency || 'later') : null,
          purpose: p.kind === 'print' ? p.purpose : null, amount: p.kind === 'print' ? (p.amount ?? null) : null,
          difficulty: p.kind === 'print' ? (p.difficulty ?? null) : null,
          unit_name: (p.unit_name || '').trim(), page_range: (p.page_range || '').trim(), checks: p.checks || {},
          status: 'waiting', teacher: null, started_at: null, done_at: null, memo: null, memo_tags: [], device_id: p.device_id, linked_at: null,
        };
        db.requests.push(r); save(db);
        return delay({ ...pub(db, r), position: db.requests.filter((x) => x.status === 'waiting').length });
      },
      myRequests: async (dev) => { const db = load(); const t = Date.now(); return delay(db.requests.filter((r) => r.device_id === dev && t - new Date(r.created_at).getTime() < 24 * 3600e3).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => pub(db, r))); },
      requestByReceipt: async (no) => { const db = load(); const r = db.requests.find((x) => x.day === jstToday() && x.receipt_no === no); return delay(r ? { ...pub(db, r), student_name: r.student_name.slice(0, 1) + '＊＊' } : null); },
      cancelRequest: async (id, dev) => { const db = load(); const r = db.requests.find((x) => x.id === id && x.device_id === dev && x.status === 'waiting'); if (!r) throw new Error('CANNOT_CANCEL'); r.status = 'cancelled'; r.done_at = nowIso(); save(db); return delay(pub(db, r)); },
      teacherLogin: async (pass) => { checkPass(load(), pass); return delay(true); },
      teacherList: async (pass) => { const db = load(); checkPass(db, pass); const day = jstToday(); return delay(db.requests.filter((r) => ['waiting', 'in_progress'].includes(r.status) || (r.day === day)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r) => ({ ...r }))); },
      teacherUpdate: async (pass, id, action, teacher, memo, tags) => {
        const db = load(); checkPass(db, pass); const r = db.requests.find((x) => x.id === id); if (!r) throw new Error('NOT_FOUND');
        const tn = (teacher || '').trim() || null;
        if (action === 'start') { if (!['waiting', 'in_progress'].includes(r.status)) throw new Error('NOT_FOUND'); r.status = 'in_progress'; r.teacher = tn; r.started_at = r.started_at || nowIso(); }
        else if (action === 'done') { if (r.status === 'cancelled') throw new Error('NOT_FOUND'); r.status = 'done'; r.teacher = tn || r.teacher; r.started_at = r.started_at || nowIso(); r.done_at = nowIso(); r.memo = (memo || '').trim() || null; r.memo_tags = tags || []; }
        else if (action === 'reopen') { r.status = 'waiting'; r.teacher = null; r.started_at = null; r.done_at = null; }
        else if (action === 'cancel') { if (!['waiting', 'in_progress'].includes(r.status)) throw new Error('NOT_FOUND'); r.status = 'cancelled'; r.done_at = nowIso(); }
        else throw new Error('BAD_ACTION');
        save(db); return delay({ ...r });
      },
      teacherLinkStudent: async (pass, id, sid) => { const db = load(); checkPass(db, pass); const s = db.students.find((x) => x.id === sid); if (!s) throw new Error('NO_STUDENT'); const r = db.requests.find((x) => x.id === id); if (!r) throw new Error('NOT_FOUND'); r.student_id = s.id; r.student_name = s.name; r.grade = s.grade; r.linked_at = nowIso(); save(db); return delay({ ...r }); },
      teacherHistory: async (pass, sid, from, to) => { const db = load(); checkPass(db, pass); return delay(db.requests.filter((r) => r.student_id === sid && r.day >= from && r.day <= to).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r) => { const s = db.students.find((x) => x.id === r.student_id); return { ...r, student_no: s?.student_no, school: s?.school }; })); },
      teacherExport: async (pass, from, to) => { const db = load(); checkPass(db, pass); return delay(db.requests.filter((r) => r.day >= from && r.day <= to).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r) => { const s = db.students.find((x) => x.id === r.student_id); return { ...r, student_no: s?.student_no ?? null, school: s?.school ?? null }; })); },
      teacherStudents: async (pass) => { const db = load(); checkPass(db, pass); return delay(db.students.slice().sort((a, b) => (b.active - a.active) || a.grade.localeCompare(b.grade) || a.student_no.localeCompare(b.student_no))); },
      teacherImportStudents: async (pass, rows, replace) => {
        const db = load(); checkPass(db, pass); let n = 0;
        if (replace) { const nos = new Set(rows.map((r) => r.student_no)); db.students.forEach((s) => { if (!nos.has(s.student_no)) s.active = false; }); }
        for (const r of rows) {
          if (!r.student_no || !r.name) continue;
          const ex = db.students.find((s) => s.student_no === r.student_no);
          if (ex) Object.assign(ex, { name: r.name, grade: r.grade || '', school: r.school || '', active: true });
          else db.students.push({ id: ++db.sseq, student_no: r.student_no, name: r.name, grade: r.grade || '', school: r.school || '', active: true });
          n++;
        }
        save(db); return delay({ imported: n });
      },
      teacherSetPass: async (pass, nw) => { const db = load(); checkPass(db, pass); if (!nw || nw.trim().length < 4) throw new Error('PASS_TOO_SHORT'); db.pass = nw.trim(); save(db); return delay(true); },
    };
  }

  const api = useSupabase ? supabaseApi() : localApi();

  // お試しモードの案内バナー
  function demoBanner() {
    if (api.mode !== 'local') return;
    const b = document.createElement('div');
    b.className = 'demo-banner';
    b.innerHTML = 'お試しモード：データはこのブラウザの中だけに保存されます（config.js に Supabase を設定すると本番になります）';
    document.body.prepend(b);
  }

  // ---------- Service Worker（ホーム画面追加用） ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
  }

  window.JH = { $, $$, esc, fmtTime, fmtDate, fmtDateTime, ymd, todayYmd, minutesSince, elapsedText, KIND_LABEL, KIND_ICON, STATUS_LABEL, URGENCY_LABEL, PURPOSE_LABEL, AMOUNT_LABEL, DIFF_LABEL, CHECK_LABEL, unmetChecks, errorText, toast, deviceId, store, api, demoBanner };
})();
