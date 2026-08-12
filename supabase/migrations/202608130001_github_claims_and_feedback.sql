-- GitHub solution ownership claims, bulk review, automatic approval, and feedback.

alter table public.studies
  add column if not exists github_auto_approve_claims boolean not null default false;

alter table public.github_solutions
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claim_status text check (claim_status in ('pending', 'approved', 'rejected')),
  add column if not exists claim_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists claim_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claim_requested_at timestamptz,
  add column if not exists claim_reviewed_at timestamptz;

create index if not exists github_solutions_claim_status_idx
  on public.github_solutions(claim_status)
  where claim_status = 'pending';

create table if not exists public.github_solution_comments (
  id uuid primary key default gen_random_uuid(),
  github_solution_id uuid not null references public.github_solutions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  kind text not null default 'feedback' check (kind in ('feedback', 'question')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists github_solution_comments_solution_id_idx
  on public.github_solution_comments(github_solution_id);

create trigger github_solution_comments_set_updated_at
  before update on public.github_solution_comments
  for each row execute function public.set_updated_at();

alter table public.github_solution_comments enable row level security;

create policy "github_solution_comments_read_members" on public.github_solution_comments for select to authenticated
using (exists (
  select 1 from public.github_solutions gs
  join public.problems p on p.id = gs.problem_id
  join public.study_weeks w on w.id = p.week_id
  where gs.id = github_solution_id and public.is_study_member(w.study_id)
));

create policy "github_solution_comments_insert_members" on public.github_solution_comments for insert to authenticated
with check (user_id = auth.uid() and exists (
  select 1 from public.github_solutions gs
  join public.problems p on p.id = gs.problem_id
  join public.study_weeks w on w.id = p.week_id
  where gs.id = github_solution_id and public.is_study_member(w.study_id)
));

create policy "github_solution_comments_update_self" on public.github_solution_comments for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "github_solution_comments_delete_self" on public.github_solution_comments for delete to authenticated
using (user_id = auth.uid());

create or replace function public.request_github_solution_claim(p_solution_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_study_id uuid;
  auto_approve boolean;
  current_status text;
  current_requester uuid;
  current_owner uuid;
  next_status text;
begin
  select w.study_id, s.github_auto_approve_claims, gs.claim_status, gs.claim_requested_by, gs.claimed_by
  into target_study_id, auto_approve, current_status, current_requester, current_owner
  from public.github_solutions gs
  join public.problems p on p.id = gs.problem_id
  join public.study_weeks w on w.id = p.week_id
  join public.studies s on s.id = w.study_id
  where gs.id = p_solution_id
  for update of gs;

  if target_study_id is null then raise exception 'GitHub 풀이를 찾을 수 없습니다.'; end if;
  if not public.is_study_member(target_study_id) then raise exception '스터디 멤버만 소유권을 요청할 수 있습니다.'; end if;
  if current_status = 'approved' and current_owner is distinct from auth.uid() then raise exception '이미 다른 팀원의 풀이로 승인되었습니다.'; end if;
  if current_status = 'approved' and current_owner = auth.uid() then return 'approved'; end if;
  if current_status = 'pending' and current_requester is distinct from auth.uid() then raise exception '다른 팀원의 승인 요청이 대기 중입니다.'; end if;

  next_status := case when auto_approve then 'approved' else 'pending' end;
  update public.github_solutions
  set claim_status = next_status,
      claim_requested_by = auth.uid(),
      claim_requested_at = now(),
      claimed_by = case when auto_approve then auth.uid() else null end,
      claim_reviewed_by = case when auto_approve then auth.uid() else null end,
      claim_reviewed_at = case when auto_approve then now() else null end
  where id = p_solution_id;
  return next_status;
end;
$$;

create or replace function public.review_github_solution_claims(p_solution_ids uuid[], p_approve boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if coalesce(cardinality(p_solution_ids), 0) = 0 then return 0; end if;

  if exists (
    select 1 from unnest(p_solution_ids) requested_id
    left join public.github_solutions gs on gs.id = requested_id
    left join public.problems p on p.id = gs.problem_id
    left join public.study_weeks w on w.id = p.week_id
    where gs.id is null or not public.is_study_admin(w.study_id)
  ) then
    raise exception '승인할 권한이 없는 요청이 포함되어 있습니다.';
  end if;

  update public.github_solutions
  set claim_status = case when p_approve then 'approved' else 'rejected' end,
      claimed_by = case when p_approve then claim_requested_by else null end,
      claim_reviewed_by = auth.uid(),
      claim_reviewed_at = now()
  where id = any(p_solution_ids) and claim_status = 'pending';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.set_github_claim_auto_approve(p_study_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_study_admin(p_study_id) then raise exception '설정을 변경할 권한이 없습니다.'; end if;
  update public.studies set github_auto_approve_claims = p_enabled where id = p_study_id;
end;
$$;

revoke all on function public.request_github_solution_claim(uuid) from public;
revoke all on function public.review_github_solution_claims(uuid[], boolean) from public;
revoke all on function public.set_github_claim_auto_approve(uuid, boolean) from public;
grant execute on function public.request_github_solution_claim(uuid) to authenticated;
grant execute on function public.review_github_solution_claims(uuid[], boolean) to authenticated;
grant execute on function public.set_github_claim_auto_approve(uuid, boolean) to authenticated;

alter publication supabase_realtime add table public.github_solutions;
alter publication supabase_realtime add table public.github_solution_comments;
