alter table public.studies add column if not exists github_repo_url text;
alter table public.studies add column if not exists github_branch text;
alter table public.studies add column if not exists github_root_path text not null default '';
alter table public.studies add column if not exists github_synced_at timestamptz;

alter table public.problems add column if not exists source_key text;
create unique index if not exists problems_week_source_key_unique
  on public.problems(week_id, source_key)
  where source_key is not null;

create table if not exists public.github_solutions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  author_label text not null check (char_length(author_label) between 1 and 120),
  language text not null,
  code text not null default '' check (octet_length(code) <= 500000),
  file_path text not null,
  html_url text not null check (html_url ~ '^https://github.com/'),
  blob_sha text not null,
  synced_at timestamptz not null default now(),
  unique (problem_id, file_path)
);

create index if not exists github_solutions_problem_id_idx on public.github_solutions(problem_id);
alter table public.github_solutions enable row level security;

create policy "github_solutions_read_teammates" on public.github_solutions for select to authenticated
using (exists (
  select 1 from public.problems p
  join public.study_weeks w on w.id = p.week_id
  where p.id = problem_id and public.is_study_member(w.study_id)
));

create policy "github_solutions_insert_admins" on public.github_solutions for insert to authenticated
with check (exists (
  select 1 from public.problems p
  join public.study_weeks w on w.id = p.week_id
  where p.id = problem_id and public.is_study_admin(w.study_id)
));

create policy "github_solutions_update_admins" on public.github_solutions for update to authenticated
using (exists (
  select 1 from public.problems p
  join public.study_weeks w on w.id = p.week_id
  where p.id = problem_id and public.is_study_admin(w.study_id)
))
with check (exists (
  select 1 from public.problems p
  join public.study_weeks w on w.id = p.week_id
  where p.id = problem_id and public.is_study_admin(w.study_id)
));

create policy "github_solutions_delete_admins" on public.github_solutions for delete to authenticated
using (exists (
  select 1 from public.problems p
  join public.study_weeks w on w.id = p.week_id
  where p.id = problem_id and public.is_study_admin(w.study_id)
));
