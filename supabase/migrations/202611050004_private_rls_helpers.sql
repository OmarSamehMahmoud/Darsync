-- Keep SECURITY DEFINER helpers out of the exposed PostgREST API schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.is_darsync_admin() SET SCHEMA private;
ALTER FUNCTION public.is_darsync_super_admin() SET SCHEMA private;

REVOKE EXECUTE ON FUNCTION private.is_darsync_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_darsync_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_darsync_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_darsync_super_admin() TO authenticated, service_role;
