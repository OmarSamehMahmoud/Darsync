-- Darsync security hardening and foreign-key indexes
-- Trigger and event-trigger functions are not RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.create_darsync_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_darsync_account_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- These helpers are required by authenticated RLS policies, but must not be callable anonymously.
REVOKE EXECUTE ON FUNCTION public.is_darsync_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_darsync_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_darsync_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_darsync_super_admin() TO authenticated, service_role;

-- Cover foreign keys flagged by the Supabase performance advisor.
CREATE INDEX IF NOT EXISTS idx_corrections_created_by ON public.corrections(created_by);
CREATE INDEX IF NOT EXISTS idx_study_files_uploaded_by ON public.study_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_study_index_jobs_file_id ON public.study_index_jobs(file_id);
