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

-- Ensure the study index supports bounded page retrieval by course and file.
create index if not exists idx_study_pages_scope_file_page
  on public.study_pages(country, category, subcategory, test, file_id, page);
