-- =====================================================================
--  プリント依頼・質問ヘルプ  データベース定義（Supabase 用）
--  使い方: Supabase の SQL Editor にこのファイルの中身を全部貼り付けて Run
--  何度実行しても壊れないように書いてあります（再実行OK）
-- =====================================================================

-- ---------- 1. 表 ----------

create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

-- 講師用の合言葉（初期値）。講師画面の設定から変更できます。
insert into public.app_settings (key, value)
values ('teacher_pass', 'sensei')
on conflict (key) do nothing;

create table if not exists public.students (
  id         bigserial primary key,
  student_no text not null unique,
  name       text not null,
  grade      text not null,
  school     text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  day          date not null,
  receipt_no   int  not null,
  student_id   bigint references public.students(id),
  student_name text not null,
  grade        text not null default '',
  classroom    text not null,
  seat         text not null default '',
  kind         text not null check (kind in ('print','question')),
  subject      text not null,
  content      text not null default '',
  copies       int,
  urgency      text check (urgency in ('now','later')),
  status       text not null default 'waiting'
               check (status in ('waiting','in_progress','done','cancelled')),
  teacher      text,
  started_at   timestamptz,
  done_at      timestamptz,
  memo         text,
  memo_tags    text[] not null default '{}',
  device_id    text not null,
  linked_at    timestamptz
);

-- プリントの目的・量・難易度・単元・ページ・事前チェック（あとから追加した列。再実行しても安全）
alter table public.requests add column if not exists purpose    text;
alter table public.requests add column if not exists amount     text;
alter table public.requests add column if not exists difficulty text;
alter table public.requests add column if not exists unit_name  text not null default '';
alter table public.requests add column if not exists page_range text not null default '';
alter table public.requests add column if not exists checks     jsonb not null default '{}'::jsonb;
alter table public.requests add column if not exists school     text not null default '';

create index if not exists requests_day_status_idx  on public.requests (day, status);
create index if not exists requests_device_idx      on public.requests (device_id, created_at);
create index if not exists requests_student_idx     on public.requests (student_id, day);

-- 生徒ごとの目標点（講師が設定。{"英語":80,"数学":75,"5科":400} のような形）
alter table public.students add column if not exists targets jsonb not null default '{}'::jsonb;

-- 定期テストの点数（講師だけが見られる。生徒画面には出さない）
create table if not exists public.student_scores (
  id         bigserial primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  period     text not null,              -- 例: 2026.1（年度.回）
  label      text not null default '',   -- 例: 2026年度 1学期中間
  grade_at   int,                        -- そのときの学年
  scores     jsonb not null default '{}'::jsonb,  -- {"英語":80,"数学":75,...}
  rank       int,
  total      int,
  updated_at timestamptz not null default now(),
  unique (student_id, period)
);
alter table public.student_scores enable row level security;
revoke all on public.student_scores from anon, authenticated;

-- 印刷用の教材（Google ドライブのファイル名とリンクだけ。中身は持たない。講師だけが見られる）
-- categories: intro=苦手な子の導入 / weak=弱点補強 / practice=類題演習 / test=テスト形式 / hard=難しい問題
create table if not exists public.print_materials (
  id         bigserial primary key,
  drive_id   text unique,                        -- ドライブのファイルID（手で足した教材は null）
  title      text not null,
  url        text not null,
  subject    text not null default '',
  grades     text[] not null default '{}',       -- {"中2"} など。空なら学年を問わない
  unit       text not null default '',
  categories text[] not null default '{}',
  level      text check (level in ('basic','standard','advanced')),
  path       text not null default '',           -- フォルダの場所（例: 教材 > 数学 > 中2）
  note       text not null default '',
  hidden     boolean not null default false,     -- 候補に出さない
  locked     boolean not null default false,     -- 先生が手で直した（取り込み直しで上書きしない）
  source     text not null default 'drive',
  updated_at timestamptz not null default now()
);
alter table public.print_materials enable row level security;
revoke all on public.print_materials from anon, authenticated;

-- 定期テストの予想問題のストック（講師だけ）。過去問から「よく出る形」を取り出し、それを元に作った問題
-- kind: predicted=予想問題（印刷に使う） / pattern=過去問の出題パターンのメモ（印刷しない）
create table if not exists public.exam_questions (
  id           bigserial primary key,
  kind         text not null default 'predicted' check (kind in ('predicted','pattern')),
  subject      text not null,
  grade        text not null,
  schools      text[] not null default '{}',     -- 出題が多い学校（空なら共通）
  unit         text not null,                    -- 単元（例: 一次関数）
  topic        text not null default '',         -- 出題パターン（例: 2点を通る直線の式）
  frequency    int  not null default 1,          -- 過去問で出た回数
  level        text check (level in ('basic','standard','advanced')),
  qtype        text not null default '',         -- 計算/選択/記述/穴埋め/作図/並べ替え など
  question     text not null,
  answer       text not null default '',
  points       int,
  figure_svg   text not null default '',         -- 図（SVG）。図が要る問題は図を付ける
  source_label text not null default '',         -- 元にした過去問（例: 2023 2学期中間 水谷 中2）
  batch        text not null default '',         -- 取り込みのまとまり（作り直しで差し替える単位）
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists exam_questions_unit_idx on public.exam_questions (subject, grade, unit);
alter table public.exam_questions enable row level security;
revoke all on public.exam_questions from anon, authenticated;

-- ---------- 2. 直接アクセス禁止（すべて下の関数経由にする） ----------

alter table public.app_settings enable row level security;
alter table public.students     enable row level security;
alter table public.requests     enable row level security;

revoke all on public.app_settings from anon, authenticated;
revoke all on public.students     from anon, authenticated;
revoke all on public.requests     from anon, authenticated;

-- ---------- 3. 共通の部品 ----------

create or replace function public.jst_today() returns date
language sql stable as $$
  select (now() at time zone 'Asia/Tokyo')::date
$$;

create or replace function public.check_pass(p_pass text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pass is null
     or p_pass <> (select value from app_settings where key = 'teacher_pass') then
    perform pg_sleep(1);   -- 総当たり対策: 失敗時は1秒待たせる
    raise exception 'BAD_PASS';
  end if;
end $$;

-- 生徒画面に返す形（講師メモなどは含めない）
create or replace function public.request_public_json(r public.requests) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', r.id,
    'receipt_no', r.receipt_no,
    'day', r.day,
    'student_name', r.student_name,
    'school', r.school,
    'classroom', r.classroom,
    'seat', r.seat,
    'kind', r.kind,
    'subject', r.subject,
    'content', r.content,
    'copies', r.copies,
    'purpose', r.purpose,
    'amount', r.amount,
    'difficulty', r.difficulty,
    'unit_name', r.unit_name,
    'page_range', r.page_range,
    'urgency', r.urgency,
    'status', r.status,
    'teacher', case when r.status = 'in_progress' then r.teacher else null end,
    'created_at', r.created_at,
    'started_at', r.started_at,
    'done_at', r.done_at,
    'ahead', (select count(*) from public.requests w
               where w.status = 'waiting' and w.created_at < r.created_at
                 and r.status = 'waiting')
  )
$$;

-- ---------- 4. 生徒側の関数（ログイン不要） ----------

-- 名簿（生徒画面用: 学校名は本人確認と自動入力のために返す）
drop function if exists public.list_students();
create or replace function public.list_students()
returns table (id bigint, student_no text, name text, grade text, school text)
language sql security definer set search_path = public stable as $$
  select id, student_no, name, grade, school
  from students where active order by grade, student_no, name
$$;

-- 依頼を送る（古い版の関数が残っていれば消す）
drop function if exists public.create_request(text,bigint,text,text,text,text,text,text,text,int,text);
drop function if exists public.create_request(text,bigint,text,text,text,text,text,text,text,int,text,text,text,text,text,text,jsonb);
create or replace function public.create_request(
  p_device_id    text,
  p_student_id   bigint,
  p_student_name text,
  p_grade        text,
  p_classroom    text,
  p_seat         text,
  p_kind         text,
  p_subject      text,
  p_content      text,
  p_copies       int,
  p_urgency      text,
  p_purpose      text default null,
  p_amount       text default null,
  p_difficulty   text default null,
  p_unit_name    text default '',
  p_page_range   text default '',
  p_checks       jsonb default '{}'::jsonb,
  p_school       text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := coalesce(p_student_name, '');
  v_grade  text := coalesce(p_grade, '');
  v_school text := coalesce(trim(p_school), '');
  v_row    requests%rowtype;
  v_no     int;
  v_pos    int;
begin
  if p_device_id is null or length(p_device_id) < 8 then
    raise exception 'BAD_DEVICE';
  end if;

  -- いたずら対策: 同じ端末から15秒以内の連続送信、1時間30件超は拒否
  if exists (select 1 from requests
             where device_id = p_device_id
               and created_at > now() - interval '15 seconds') then
    raise exception 'TOO_FAST';
  end if;
  if (select count(*) from requests
      where device_id = p_device_id
        and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'TOO_MANY';
  end if;

  -- 名簿の生徒なら名前・学年は名簿から取る
  if p_student_id is not null then
    select name, grade, case when v_school = '' then school else v_school end
      into v_name, v_grade, v_school from students where id = p_student_id;
    if not found then
      raise exception 'NO_STUDENT';
    end if;
  end if;
  if length(v_school) > 30 then raise exception 'TOO_LONG'; end if;

  if length(trim(v_name)) = 0 then raise exception 'NO_NAME'; end if;
  if p_classroom is null or length(p_classroom) = 0 then raise exception 'NO_CLASSROOM'; end if;
  if p_kind not in ('print','question') then raise exception 'BAD_KIND'; end if;
  if p_subject is null or length(p_subject) = 0 then raise exception 'NO_SUBJECT'; end if;
  if length(coalesce(p_content,'')) > 200 then raise exception 'CONTENT_TOO_LONG'; end if;
  if length(v_name) > 40 or length(coalesce(p_seat,'')) > 10 then raise exception 'TOO_LONG'; end if;
  if length(coalesce(p_unit_name,'')) > 60 or length(coalesce(p_page_range,'')) > 40 then raise exception 'TOO_LONG'; end if;
  if p_kind = 'print' and (p_purpose is null or p_purpose not in ('point','practice','weak','test')) then raise exception 'NO_PURPOSE'; end if;
  if p_amount is not null and p_amount not in ('S','M','L') then raise exception 'BAD_AMOUNT'; end if;
  if p_difficulty is not null and p_difficulty not in ('basic','standard','advanced') then raise exception 'BAD_DIFFICULTY'; end if;
  if p_checks is not null and jsonb_typeof(p_checks) <> 'object' then raise exception 'BAD_CHECKS'; end if;

  -- 受付番号（その日の通し番号）: 同時送信でも重複しないようロック
  perform pg_advisory_xact_lock(424242);
  select coalesce(max(receipt_no), 0) + 1 into v_no
  from requests where day = jst_today();

  insert into requests (day, receipt_no, student_id, student_name, grade,
                        classroom, seat, kind, subject, content, copies, urgency, device_id,
                        purpose, amount, difficulty, unit_name, page_range, checks, school)
  values (jst_today(), v_no, p_student_id, trim(v_name), v_grade,
          p_classroom, coalesce(trim(p_seat),''), p_kind, p_subject,
          coalesce(trim(p_content),''),
          case when p_kind = 'print' then p_copies else null end,
          case when p_kind = 'question' then coalesce(p_urgency,'later') else null end,
          p_device_id,
          case when p_kind = 'print' then p_purpose else null end,
          case when p_kind = 'print' then p_amount else null end,
          case when p_kind = 'print' then p_difficulty else null end,
          coalesce(trim(p_unit_name),''), coalesce(trim(p_page_range),''),
          coalesce(p_checks, '{}'::jsonb), v_school)
  returning * into v_row;

  select count(*) into v_pos from requests where status = 'waiting';

  return request_public_json(v_row) || jsonb_build_object('position', v_pos);
end $$;

-- この端末から送った依頼（直近24時間）
create or replace function public.my_requests(p_device_id text)
returns setof jsonb
language sql security definer set search_path = public stable as $$
  select request_public_json(r)
  from requests r
  where r.device_id = p_device_id
    and r.created_at > now() - interval '24 hours'
  order by r.created_at desc
$$;

-- 受付番号で今日の依頼を確認（名前は一部伏せる）
create or replace function public.request_by_receipt(p_receipt_no int)
returns jsonb
language sql security definer set search_path = public stable as $$
  select request_public_json(r)
         || jsonb_build_object('student_name', left(r.student_name, 1) || '＊＊')
  from requests r
  where r.day = jst_today() and r.receipt_no = p_receipt_no
  limit 1
$$;

-- 取り消し（同じ端末から・待ち状態のときだけ）
create or replace function public.cancel_request(p_id bigint, p_device_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row requests%rowtype;
begin
  update requests set status = 'cancelled', done_at = now()
  where id = p_id and device_id = p_device_id and status = 'waiting'
  returning * into v_row;
  if not found then raise exception 'CANNOT_CANCEL'; end if;
  return request_public_json(v_row);
end $$;

-- ---------- 5. 講師側の関数（合言葉が必要） ----------

create or replace function public.teacher_login(p_pass text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return true;
end $$;

-- 今日の一覧: 待ち・対応中は日付をまたいでも残す。完了・取消は今日の分だけ
create or replace function public.teacher_list(p_pass text)
returns setof public.requests
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return query
    select * from requests r
    where r.status in ('waiting','in_progress')
       or (r.day = jst_today() and r.status in ('done','cancelled'))
    order by r.created_at;
end $$;

-- 状態の変更: start(対応中) / done(完了) / reopen(待ちに戻す) / cancel(取消)
create or replace function public.teacher_update(
  p_pass    text,
  p_id      bigint,
  p_action  text,
  p_teacher text,
  p_memo    text,
  p_tags    text[]
) returns public.requests
language plpgsql security definer set search_path = public as $$
declare v_row requests%rowtype;
begin
  perform check_pass(p_pass);
  if p_action = 'start' then
    update requests set status = 'in_progress', teacher = nullif(trim(p_teacher),''),
                        started_at = coalesce(started_at, now())
    where id = p_id and status in ('waiting','in_progress') returning * into v_row;
  elsif p_action = 'done' then
    update requests set status = 'done',
                        teacher = coalesce(nullif(trim(p_teacher),''), teacher),
                        started_at = coalesce(started_at, now()),
                        done_at = now(),
                        memo = nullif(trim(coalesce(p_memo,'')),''),
                        memo_tags = coalesce(p_tags, '{}')
    where id = p_id and status in ('waiting','in_progress','done') returning * into v_row;
  elsif p_action = 'reopen' then
    update requests set status = 'waiting', teacher = null, started_at = null, done_at = null
    where id = p_id returning * into v_row;
  elsif p_action = 'cancel' then
    update requests set status = 'cancelled', done_at = now()
    where id = p_id and status in ('waiting','in_progress') returning * into v_row;
  else
    raise exception 'BAD_ACTION';
  end if;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  return v_row;
end $$;

-- 「その他（手入力）」の依頼を名簿の生徒に紐づける
create or replace function public.teacher_link_student(p_pass text, p_id bigint, p_student_id bigint)
returns public.requests
language plpgsql security definer set search_path = public as $$
declare v_row requests%rowtype; v_s students%rowtype;
begin
  perform check_pass(p_pass);
  select * into v_s from students where id = p_student_id;
  if not found then raise exception 'NO_STUDENT'; end if;
  update requests set student_id = v_s.id, student_name = v_s.name, grade = v_s.grade, linked_at = now(),
                      school = case when school = '' then v_s.school else school end
  where id = p_id returning * into v_row;
  if not found then raise exception 'NOT_FOUND'; end if;
  return v_row;
end $$;

-- 生徒別の記録（期間指定）
create or replace function public.teacher_history(p_pass text, p_student_id bigint, p_from date, p_to date)
returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return query
    select to_jsonb(r) || jsonb_build_object('student_no', s.student_no, 'school', s.school)
    from requests r left join students s on s.id = r.student_id
    where r.student_id = p_student_id and r.day between p_from and p_to
    order by r.created_at;
end $$;

-- CSV 用: 期間内の全依頼
create or replace function public.teacher_export(p_pass text, p_from date, p_to date)
returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return query
    select to_jsonb(r) || jsonb_build_object('student_no', s.student_no, 'school', s.school)
    from requests r left join students s on s.id = r.student_id
    where r.day between p_from and p_to
    order by r.created_at;
end $$;

-- 名簿の全件（講師用: 学校名・無効も含む）
create or replace function public.teacher_students(p_pass text)
returns setof public.students
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return query select * from students order by active desc, grade, student_no, name;
end $$;

-- 名簿の取り込み: [{"student_no":"1001","name":"佐藤 花子","grade":"中2","school":"○○中"}, ...]
-- p_replace = true のとき、リストに無い生徒は「無効」にする（削除はしない）
create or replace function public.teacher_import_students(p_pass text, p_rows jsonb, p_replace boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_r jsonb;
begin
  perform check_pass(p_pass);
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'BAD_ROWS'; end if;
  if p_replace then
    update students set active = false, updated_at = now()
    where student_no not in (select coalesce(x->>'student_no','') from jsonb_array_elements(p_rows) x);
  end if;
  for v_r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(v_r->>'student_no','') = '' or coalesce(v_r->>'name','') = '' then continue; end if;
    insert into students (student_no, name, grade, school, active)
    values (trim(v_r->>'student_no'), trim(v_r->>'name'), coalesce(trim(v_r->>'grade'),''), coalesce(trim(v_r->>'school'),''), true)
    on conflict (student_no) do update
      set name = excluded.name, grade = excluded.grade, school = excluded.school,
          active = true, updated_at = now();
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('imported', v_n);
end $$;

-- 点数の取り込み: [{"student_no":"中2_田中健","period":"2026.1","label":"...","grade_at":2,"scores":{...},"rank":3,"total":420}, ...]
create or replace function public.teacher_import_scores(p_pass text, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_skip int := 0; v_r jsonb; v_sid bigint;
begin
  perform check_pass(p_pass);
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'BAD_ROWS'; end if;
  for v_r in select * from jsonb_array_elements(p_rows) loop
    select id into v_sid from students where student_no = v_r->>'student_no';
    if v_sid is null or coalesce(v_r->>'period','') = '' then v_skip := v_skip + 1; continue; end if;
    insert into student_scores (student_id, period, label, grade_at, scores, rank, total)
    values (v_sid, v_r->>'period', coalesce(v_r->>'label',''), (v_r->>'grade_at')::int,
            coalesce(v_r->'scores','{}'::jsonb), (v_r->>'rank')::int, (v_r->>'total')::int)
    on conflict (student_id, period) do update
      set label = excluded.label, grade_at = excluded.grade_at, scores = excluded.scores,
          rank = excluded.rank, total = excluded.total, updated_at = now();
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('imported', v_n, 'skipped', v_skip);
end $$;

-- 在籍生徒の点数を全部（講師画面が起動時に読む）
create or replace function public.teacher_scores_all(p_pass text)
returns setof public.student_scores
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return query select sc.* from student_scores sc join students s on s.id = sc.student_id
               where s.active order by sc.student_id, sc.period;
end $$;

-- 目標点の設定
create or replace function public.teacher_set_targets(p_pass text, p_student_id bigint, p_targets jsonb)
returns public.students
language plpgsql security definer set search_path = public as $$
declare v_s students%rowtype;
begin
  perform check_pass(p_pass);
  if p_targets is null or jsonb_typeof(p_targets) <> 'object' then raise exception 'BAD_TARGETS'; end if;
  update students set targets = p_targets, updated_at = now() where id = p_student_id returning * into v_s;
  if not found then raise exception 'NO_STUDENT'; end if;
  return v_s;
end $$;

-- 直近 N 日のプリント依頼（「さっきのプリントやった？」の確認用）
create or replace function public.teacher_recent_prints(p_pass text, p_days int)
returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return query
    select jsonb_build_object('id', r.id, 'student_id', r.student_id, 'student_name', r.student_name, 'grade', r.grade,
             'subject', r.subject, 'unit_name', r.unit_name, 'page_range', r.page_range, 'purpose', r.purpose,
             'difficulty', r.difficulty, 'amount', r.amount, 'status', r.status, 'day', r.day,
             'created_at', r.created_at, 'done_at', r.done_at, 'teacher', r.teacher, 'memo', r.memo, 'memo_tags', r.memo_tags)
    from requests r
    where r.kind = 'print' and r.status <> 'cancelled'
      and r.day >= jst_today() - greatest(coalesce(p_days, 14), 1)
    order by r.created_at desc;
end $$;

-- 生徒を無効にする／戻す（退塾など。記録は残る）
create or replace function public.teacher_set_student_active(p_pass text, p_student_id bigint, p_active boolean)
returns public.students
language plpgsql security definer set search_path = public as $$
declare v_s students%rowtype;
begin
  perform check_pass(p_pass);
  update students set active = coalesce(p_active, true), updated_at = now() where id = p_student_id returning * into v_s;
  if not found then raise exception 'NO_STUDENT'; end if;
  return v_s;
end $$;

-- 印刷用教材の一覧（講師だけ）。1,000件を超えても全部返すよう、1つの JSON 配列で返す（API の行数上限を受けない）
drop function if exists public.teacher_materials(text);
create or replace function public.teacher_materials(p_pass text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'drive_id', m.drive_id, 'title', m.title, 'url', m.url, 'subject', m.subject,
           'grades', m.grades, 'unit', m.unit, 'categories', m.categories, 'level', m.level, 'path', m.path, 'note', m.note,
           'hidden', m.hidden, 'locked', m.locked, 'source', m.source) order by m.subject, m.title) from print_materials m), '[]'::jsonb);
end $$;

-- 取り込み（ドライブから作った一覧）: drive_id で上書き。先生が直した行（locked）は分類を上書きしない
create or replace function public.teacher_import_materials(p_pass text, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_r jsonb;
begin
  perform check_pass(p_pass);
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'BAD_ROWS'; end if;
  for v_r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(v_r->>'drive_id','') = '' or coalesce(v_r->>'title','') = '' or coalesce(v_r->>'url','') = '' then continue; end if;
    insert into print_materials (drive_id, title, url, subject, grades, unit, categories, level, path, note, source)
    values (v_r->>'drive_id', v_r->>'title', v_r->>'url', coalesce(v_r->>'subject',''),
            coalesce(array(select jsonb_array_elements_text(v_r->'grades')), '{}'),
            coalesce(v_r->>'unit',''),
            coalesce(array(select jsonb_array_elements_text(v_r->'categories')), '{}'),
            nullif(v_r->>'level',''), coalesce(v_r->>'path',''), coalesce(v_r->>'note',''), 'drive')
    on conflict (drive_id) do update set
      title = excluded.title, url = excluded.url, path = excluded.path, updated_at = now(),
      subject    = case when print_materials.locked then print_materials.subject    else excluded.subject end,
      grades     = case when print_materials.locked then print_materials.grades     else excluded.grades end,
      unit       = case when print_materials.locked then print_materials.unit       else excluded.unit end,
      categories = case when print_materials.locked then print_materials.categories else excluded.categories end,
      level      = case when print_materials.locked then print_materials.level      else excluded.level end;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('imported', v_n);
end $$;

-- 1件を直す／手で足す（p_id が null なら追加）。直した行は locked になる
create or replace function public.teacher_save_material(p_pass text, p_id bigint, p_fields jsonb)
returns public.print_materials
language plpgsql security definer set search_path = public as $$
declare v_m print_materials%rowtype;
begin
  perform check_pass(p_pass);
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then raise exception 'BAD_FIELDS'; end if;
  if p_id is null then
    if coalesce(p_fields->>'title','') = '' or coalesce(p_fields->>'url','') = '' then raise exception 'BAD_FIELDS'; end if;
    insert into print_materials (title, url, subject, grades, unit, categories, level, note, source, locked)
    values (p_fields->>'title', p_fields->>'url', coalesce(p_fields->>'subject',''),
            coalesce(array(select jsonb_array_elements_text(p_fields->'grades')), '{}'), coalesce(p_fields->>'unit',''),
            coalesce(array(select jsonb_array_elements_text(p_fields->'categories')), '{}'), nullif(p_fields->>'level',''),
            coalesce(p_fields->>'note',''), 'manual', true)
    returning * into v_m;
    return v_m;
  end if;
  update print_materials set
    title      = coalesce(p_fields->>'title', title),
    url        = coalesce(p_fields->>'url', url),
    subject    = coalesce(p_fields->>'subject', subject),
    grades     = case when p_fields ? 'grades' then coalesce(array(select jsonb_array_elements_text(p_fields->'grades')), '{}') else grades end,
    unit       = coalesce(p_fields->>'unit', unit),
    categories = case when p_fields ? 'categories' then coalesce(array(select jsonb_array_elements_text(p_fields->'categories')), '{}') else categories end,
    level      = case when p_fields ? 'level' then nullif(p_fields->>'level','') else level end,
    note       = coalesce(p_fields->>'note', note),
    hidden     = coalesce((p_fields->>'hidden')::boolean, hidden),
    locked     = true, updated_at = now()
  where id = p_id returning * into v_m;
  if not found then raise exception 'NOT_FOUND'; end if;
  return v_m;
end $$;

-- 予想問題のストック一覧（講師だけ。1つの JSON で返す）
create or replace function public.teacher_exam_questions(p_pass text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  return coalesce((select jsonb_agg(to_jsonb(q) - 'created_at' order by q.subject, q.grade, q.unit, q.frequency desc, q.id) from exam_questions q), '[]'::jsonb);
end $$;

-- 取り込み: 同じ batch の行をいったん消して入れ直す（作り直しに対応）。hidden は引き継がない
create or replace function public.teacher_import_exam_questions(p_pass text, p_batch text, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; v_r jsonb;
begin
  perform check_pass(p_pass);
  if coalesce(p_batch,'') = '' then raise exception 'BAD_BATCH'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'BAD_ROWS'; end if;
  delete from exam_questions where batch = p_batch;
  for v_r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(v_r->>'subject','') = '' or coalesce(v_r->>'grade','') = '' or coalesce(v_r->>'unit','') = '' or coalesce(v_r->>'question','') = '' then continue; end if;
    insert into exam_questions (kind, subject, grade, schools, unit, topic, frequency, level, qtype, question, answer, points, figure_svg, source_label, batch)
    values (coalesce(nullif(v_r->>'kind',''),'predicted'), v_r->>'subject', v_r->>'grade',
            coalesce(array(select jsonb_array_elements_text(v_r->'schools')), '{}'), v_r->>'unit', coalesce(v_r->>'topic',''),
            coalesce((v_r->>'frequency')::int, 1), nullif(v_r->>'level',''), coalesce(v_r->>'qtype',''), v_r->>'question',
            coalesce(v_r->>'answer',''), (v_r->>'points')::int, coalesce(v_r->>'figure_svg',''), coalesce(v_r->>'source_label',''), p_batch);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('imported', v_n);
end $$;

-- 1問を直す・隠す
create or replace function public.teacher_save_exam_question(p_pass text, p_id bigint, p_fields jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_q exam_questions%rowtype;
begin
  perform check_pass(p_pass);
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then raise exception 'BAD_FIELDS'; end if;
  update exam_questions set
    question = coalesce(p_fields->>'question', question),
    answer   = coalesce(p_fields->>'answer', answer),
    unit     = coalesce(p_fields->>'unit', unit),
    level    = case when p_fields ? 'level' then nullif(p_fields->>'level','') else level end,
    hidden   = coalesce((p_fields->>'hidden')::boolean, hidden)
  where id = p_id returning * into v_q;
  if not found then raise exception 'NOT_FOUND'; end if;
  return to_jsonb(v_q) - 'created_at';
end $$;

-- 合言葉の変更
create or replace function public.teacher_set_pass(p_pass text, p_new text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform check_pass(p_pass);
  if p_new is null or length(trim(p_new)) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  update app_settings set value = trim(p_new) where key = 'teacher_pass';
  return true;
end $$;

-- ---------- 6. 実行権限 ----------

grant usage on schema public to anon, authenticated;
grant execute on function
  public.list_students(), public.create_request(text,bigint,text,text,text,text,text,text,text,int,text,text,text,text,text,text,jsonb,text),
  public.my_requests(text), public.request_by_receipt(int), public.cancel_request(bigint,text),
  public.teacher_login(text), public.teacher_list(text),
  public.teacher_update(text,bigint,text,text,text,text[]),
  public.teacher_link_student(text,bigint,bigint),
  public.teacher_history(text,bigint,date,date), public.teacher_export(text,date,date),
  public.teacher_students(text), public.teacher_import_students(text,jsonb,boolean),
  public.teacher_import_scores(text,jsonb), public.teacher_scores_all(text),
  public.teacher_set_targets(text,bigint,jsonb), public.teacher_recent_prints(text,int),
  public.teacher_set_student_active(text,bigint,boolean),
  public.teacher_materials(text), public.teacher_import_materials(text,jsonb), public.teacher_save_material(text,bigint,jsonb),
  public.teacher_exam_questions(text), public.teacher_import_exam_questions(text,text,jsonb), public.teacher_save_exam_question(text,bigint,jsonb),
  public.teacher_set_pass(text,text)
to anon, authenticated;

-- 内部用の関数は外から呼べないようにする
revoke execute on function public.check_pass(text) from anon, authenticated, public;
revoke execute on function public.request_public_json(public.requests) from anon, authenticated, public;

-- Supabase の API に新しい関数を認識させる
notify pgrst, 'reload schema';
