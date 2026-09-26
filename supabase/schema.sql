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

create index if not exists requests_day_status_idx  on public.requests (day, status);
create index if not exists requests_device_idx      on public.requests (device_id, created_at);
create index if not exists requests_student_idx     on public.requests (student_id, day);

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

-- 名簿（学校名は返さない）
create or replace function public.list_students()
returns table (id bigint, student_no text, name text, grade text)
language sql security definer set search_path = public stable as $$
  select id, student_no, name, grade
  from students where active order by grade, student_no, name
$$;

-- 依頼を送る（古い版の関数が残っていれば消す）
drop function if exists public.create_request(text,bigint,text,text,text,text,text,text,text,int,text);
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
  p_checks       jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := coalesce(p_student_name, '');
  v_grade  text := coalesce(p_grade, '');
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
    select name, grade into v_name, v_grade from students where id = p_student_id;
    if not found then
      raise exception 'NO_STUDENT';
    end if;
  end if;

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
                        purpose, amount, difficulty, unit_name, page_range, checks)
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
          coalesce(p_checks, '{}'::jsonb))
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
  update requests set student_id = v_s.id, student_name = v_s.name, grade = v_s.grade, linked_at = now()
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
  public.list_students(), public.create_request(text,bigint,text,text,text,text,text,text,text,int,text,text,text,text,text,text,jsonb),
  public.my_requests(text), public.request_by_receipt(int), public.cancel_request(bigint,text),
  public.teacher_login(text), public.teacher_list(text),
  public.teacher_update(text,bigint,text,text,text,text[]),
  public.teacher_link_student(text,bigint,bigint),
  public.teacher_history(text,bigint,date,date), public.teacher_export(text,date,date),
  public.teacher_students(text), public.teacher_import_students(text,jsonb,boolean),
  public.teacher_set_pass(text,text)
to anon, authenticated;

-- 内部用の関数は外から呼べないようにする
revoke execute on function public.check_pass(text) from anon, authenticated, public;
revoke execute on function public.request_public_json(public.requests) from anon, authenticated, public;

-- Supabase の API に新しい関数を認識させる
notify pgrst, 'reload schema';
