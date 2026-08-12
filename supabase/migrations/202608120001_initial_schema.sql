-- AlgoMate MVP schema
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null default '스터디원',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 160),
  invite_code text not null unique check (char_length(invite_code) between 6 and 8),
  color text not null default 'violet' check (color in ('violet', 'mint', 'amber', 'rose')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_members (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (study_id, user_id)
);

create table public.study_weeks (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  due_date timestamptz not null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, week_number)
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.study_weeks(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  url text not null check (url ~ '^https?://'),
  platform text not null,
  difficulty text not null default '',
  required boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  language text not null default 'python',
  code text not null default '' check (octet_length(code) <= 500000),
  explanation text not null default '' check (char_length(explanation) <= 5000),
  complexity text not null default '' check (char_length(complexity) <= 200),
  status text not null default 'in_progress' check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (problem_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  kind text not null default 'feedback' check (kind in ('feedback', 'question')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index study_members_user_id_idx on public.study_members(user_id);
create index study_weeks_study_id_idx on public.study_weeks(study_id);
create index problems_week_id_idx on public.problems(week_id);
create index submissions_problem_id_idx on public.submissions(problem_id);
create index submissions_user_id_idx on public.submissions(user_id);
create index comments_submission_id_idx on public.comments(submission_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger studies_set_updated_at before update on public.studies for each row execute function public.set_updated_at();
create trigger weeks_set_updated_at before update on public.study_weeks for each row execute function public.set_updated_at();
create trigger problems_set_updated_at before update on public.problems for each row execute function public.set_updated_at();
create trigger submissions_set_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, '스터디원'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_study_member(p_study_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_members
    where study_id = p_study_id and user_id = p_user_id
  );
$$;

create or replace function public.is_study_admin(p_study_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_members
    where study_id = p_study_id and user_id = p_user_id and role in ('owner', 'admin')
  );
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.studies where invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_study_with_owner(p_name text, p_description text default '', p_color text default 'violet')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_study_id uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if char_length(trim(p_name)) not between 1 and 40 then raise exception '스터디 이름을 확인해 주세요.'; end if;

  insert into public.studies (name, description, invite_code, color, created_by)
  values (trim(p_name), left(coalesce(p_description, ''), 160), public.generate_invite_code(), p_color, auth.uid())
  returning id into new_study_id;

  insert into public.study_members (study_id, user_id, role)
  values (new_study_id, auth.uid(), 'owner');
  return new_study_id;
end;
$$;

create or replace function public.join_study_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select id into target_id from public.studies where invite_code = upper(trim(p_code));
  if target_id is null then raise exception '유효하지 않은 초대 코드입니다.'; end if;
  insert into public.study_members (study_id, user_id, role)
  values (target_id, auth.uid(), 'member')
  on conflict (study_id, user_id) do nothing;
  return target_id;
end;
$$;

revoke all on function public.create_study_with_owner(text, text, text) from public;
revoke all on function public.join_study_by_code(text) from public;
grant execute on function public.create_study_with_owner(text, text, text) to authenticated;
grant execute on function public.join_study_by_code(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.studies enable row level security;
alter table public.study_members enable row level security;
alter table public.study_weeks enable row level security;
alter table public.problems enable row level security;
alter table public.submissions enable row level security;
alter table public.comments enable row level security;

create policy "profiles_read_teammates" on public.profiles for select to authenticated
using (
  id = auth.uid() or exists (
    select 1 from public.study_members mine
    join public.study_members theirs on theirs.study_id = mine.study_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "studies_read_members" on public.studies for select to authenticated using (public.is_study_member(id));
create policy "studies_update_admins" on public.studies for update to authenticated using (public.is_study_admin(id)) with check (public.is_study_admin(id));
create policy "studies_delete_owners" on public.studies for delete to authenticated using (created_by = auth.uid());

create policy "members_read_members" on public.study_members for select to authenticated using (public.is_study_member(study_id));
create policy "members_update_admins" on public.study_members for update to authenticated using (public.is_study_admin(study_id)) with check (public.is_study_admin(study_id));
create policy "members_delete_self_or_admin" on public.study_members for delete to authenticated using (user_id = auth.uid() or public.is_study_admin(study_id));

create policy "weeks_read_members" on public.study_weeks for select to authenticated using (public.is_study_member(study_id));
create policy "weeks_insert_admins" on public.study_weeks for insert to authenticated with check (public.is_study_admin(study_id) and created_by = auth.uid());
create policy "weeks_update_admins" on public.study_weeks for update to authenticated using (public.is_study_admin(study_id)) with check (public.is_study_admin(study_id));
create policy "weeks_delete_admins" on public.study_weeks for delete to authenticated using (public.is_study_admin(study_id));

create policy "problems_read_members" on public.problems for select to authenticated
using (exists (select 1 from public.study_weeks w where w.id = week_id and public.is_study_member(w.study_id)));
create policy "problems_insert_admins" on public.problems for insert to authenticated
with check (created_by = auth.uid() and exists (select 1 from public.study_weeks w where w.id = week_id and public.is_study_admin(w.study_id)));
create policy "problems_update_admins" on public.problems for update to authenticated
using (exists (select 1 from public.study_weeks w where w.id = week_id and public.is_study_admin(w.study_id)));
create policy "problems_delete_admins" on public.problems for delete to authenticated
using (exists (select 1 from public.study_weeks w where w.id = week_id and public.is_study_admin(w.study_id)));

create policy "submissions_read_teammates" on public.submissions for select to authenticated
using (exists (
  select 1 from public.problems p join public.study_weeks w on w.id = p.week_id
  where p.id = problem_id and public.is_study_member(w.study_id)
));
create policy "submissions_insert_self" on public.submissions for insert to authenticated
with check (user_id = auth.uid() and exists (
  select 1 from public.problems p join public.study_weeks w on w.id = p.week_id
  where p.id = problem_id and public.is_study_member(w.study_id)
));
create policy "submissions_update_self" on public.submissions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "submissions_delete_self" on public.submissions for delete to authenticated using (user_id = auth.uid());

create policy "comments_read_teammates" on public.comments for select to authenticated
using (exists (
  select 1 from public.submissions s join public.problems p on p.id = s.problem_id join public.study_weeks w on w.id = p.week_id
  where s.id = submission_id and public.is_study_member(w.study_id)
));
create policy "comments_insert_teammates" on public.comments for insert to authenticated
with check (user_id = auth.uid() and exists (
  select 1 from public.submissions s join public.problems p on p.id = s.problem_id join public.study_weeks w on w.id = p.week_id
  where s.id = submission_id and public.is_study_member(w.study_id)
));
create policy "comments_update_self" on public.comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "comments_delete_self" on public.comments for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.comments;
