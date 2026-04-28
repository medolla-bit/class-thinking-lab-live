create extension if not exists pgcrypto;

create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  level text not null check (level in ('Upper Elementary', 'High School')),
  noun1 text not null,
  noun2 text not null,
  class_poem text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists session_students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references class_sessions(id) on delete cascade,
  name text not null,
  nudge_count integer not null default 0,
  final_piece text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists student_thoughts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references session_students(id) on delete cascade,
  round integer not null check (round between 1 and 3),
  text text not null,
  coach_response text not null default '',
  created_at timestamptz not null default now(),
  unique (student_id, round)
);

create index if not exists class_sessions_code_idx on class_sessions(code);
create index if not exists session_students_session_id_idx on session_students(session_id);
create index if not exists student_thoughts_student_id_idx on student_thoughts(student_id);
