-- 덕영 공간 배치 시뮬레이터 — 온라인 저장소 (포트폴리오와 같은 Supabase 프로젝트에 표 하나만 추가)
-- Supabase → SQL Editor → New query 에 전부 붙여 넣고 Run. 여러 번 실행해도 괜찮음.
-- 포트폴리오의 다른 표·로그인에는 영향 없음.

create table if not exists public.space_docs (
  col        text not null check (col in ('live', 'layouts', 'notes')),   -- 공동 편집 / 온라인 저장 / 의견
  id         text not null check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  data       jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
create index if not exists space_docs_updated_at on public.space_docs (updated_at);

-- 고친 시각은 서버가 정함 (기기마다 시계가 달라도 순서가 맞게)
create or replace function public.space_docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists space_docs_touch on public.space_docs;
create trigger space_docs_touch before insert or update on public.space_docs
  for each row execute function public.space_docs_touch();

-- 사이트 주소를 아는 사람은 누구나 보고 고칠 수 있음 (삭제는 '지움 표시'로만, 한 문서 200KB까지)
alter table public.space_docs enable row level security;
drop policy if exists "space_docs read" on public.space_docs;
drop policy if exists "space_docs insert" on public.space_docs;
drop policy if exists "space_docs update" on public.space_docs;
create policy "space_docs read" on public.space_docs for select to anon, authenticated using (true);
create policy "space_docs insert" on public.space_docs for insert to anon, authenticated
  with check (octet_length(coalesce(data::text, '')) < 200000);
create policy "space_docs update" on public.space_docs for update to anon, authenticated
  using (true) with check (octet_length(coalesce(data::text, '')) < 200000);
grant select, insert, update on public.space_docs to anon, authenticated;
