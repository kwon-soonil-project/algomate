-- Secure owner-only study management operations.

create unique index if not exists study_members_one_owner_per_study
  on public.study_members(study_id)
  where role = 'owner';

create or replace function public.transfer_study_owner(p_study_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role
  from public.study_members
  where study_id = p_study_id and user_id = auth.uid()
  for update;

  if caller_role is distinct from 'owner' then
    raise exception '방장만 방장을 위임할 수 있습니다.';
  end if;
  if p_new_owner_id = auth.uid() then
    raise exception '이미 방장입니다.';
  end if;

  select role into target_role
  from public.study_members
  where study_id = p_study_id and user_id = p_new_owner_id
  for update;

  if target_role is null then
    raise exception '해당 팀원을 찾을 수 없습니다.';
  end if;

  update public.study_members
  set role = 'admin'
  where study_id = p_study_id and user_id = auth.uid();

  update public.study_members
  set role = 'owner'
  where study_id = p_study_id and user_id = p_new_owner_id;

  update public.studies
  set created_by = p_new_owner_id
  where id = p_study_id;
end;
$$;

create or replace function public.remove_study_member(p_study_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  target_user_id uuid;
  target_role text;
begin
  select role into caller_role
  from public.study_members
  where study_id = p_study_id and user_id = auth.uid();

  select user_id, role into target_user_id, target_role
  from public.study_members
  where id = p_member_id and study_id = p_study_id;

  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception '팀원을 관리할 권한이 없습니다.';
  end if;
  if target_user_id is null then
    raise exception '해당 팀원을 찾을 수 없습니다.';
  end if;
  if target_user_id = auth.uid() then
    raise exception '자기 자신은 강퇴할 수 없습니다.';
  end if;
  if target_role = 'owner' then
    raise exception '방장은 강퇴할 수 없습니다.';
  end if;
  if caller_role = 'admin' and target_role <> 'member' then
    raise exception '운영진은 일반 멤버만 강퇴할 수 있습니다.';
  end if;

  delete from public.study_members where id = p_member_id and study_id = p_study_id;
end;
$$;

create or replace function public.delete_owned_study(p_study_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.study_members
    where study_id = p_study_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception '방장만 스터디를 삭제할 수 있습니다.';
  end if;

  delete from public.studies where id = p_study_id;
end;
$$;

revoke all on function public.transfer_study_owner(uuid, uuid) from public;
revoke all on function public.remove_study_member(uuid, uuid) from public;
revoke all on function public.delete_owned_study(uuid) from public;
grant execute on function public.transfer_study_owner(uuid, uuid) to authenticated;
grant execute on function public.remove_study_member(uuid, uuid) to authenticated;
grant execute on function public.delete_owned_study(uuid) to authenticated;
