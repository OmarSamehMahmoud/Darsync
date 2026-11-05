-- Darsync hosted migration patch.
-- Safe to run after 202611050001_initial_schema.sql. This also repairs the
-- earlier draft's dollar-quote typo if that draft was already applied.

create or replace function public.is_darsync_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
  );
$$;

drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_super_admin_update" on public.profiles;
create policy "profiles_super_admin_update" on public.profiles
for update to authenticated
using ((select public.is_darsync_super_admin()))
with check ((select public.is_darsync_super_admin()));

-- Avoid profile-creation failures when two different email addresses share
-- the same local part (e.g. name@example.com and name@school.edu).
create or replace function public.create_darsync_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  base_username text;
begin
  base_username := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(new.email, new.phone, new.id::text), '@', 1)
  );
  requested_username := base_username;
  if exists (select 1 from public.profiles p where p.username = requested_username) then
    requested_username := left(base_username, 48) || '-' || left(new.id::text, 8);
  end if;
  insert into public.profiles (id, username, role)
  values (new.id, requested_username, 'user');
  return new;
end;
$$;

-- Ensure the study index supports bounded page retrieval by course and file.
create index if not exists idx_study_pages_scope_file_page
  on public.study_pages(country, category, subcategory, test, file_id, page);
