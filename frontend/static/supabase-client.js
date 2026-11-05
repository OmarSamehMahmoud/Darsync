/* Darsync Supabase browser client.
 * Public publishable key only. RLS is the security boundary.
 */
(function () {
  'use strict';
  const config = window.DARSYNC_SUPABASE_CONFIG;
  if (!config || !window.supabase || !config.url || !config.publishableKey) {
    console.error('Darsync Supabase configuration or SDK is missing.');
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.darsyncSupabase = client;
  window.darsyncAuth = {
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile, error: profileError } = await client
        .from('profiles').select('id, username, role, permissions, created_at')
        .eq('id', data.user.id).single();
      if (profileError) {
        await client.auth.signOut();
        throw profileError;
      }
      return {
        token: data.session.access_token,
        user: { ...profile, id: profile.id, username: profile.username || email, role: profile.role || 'user' }
      };
    },
    async restore() {
      const { data: sessionData, error } = await client.auth.getSession();
      if (error) throw error;
      const session = sessionData.session;
      if (!session) return null;
      const { data: profile, error: profileError } = await client
        .from('profiles').select('id, username, role, permissions, created_at')
        .eq('id', session.user.id).single();
      if (profileError) {
        await client.auth.signOut();
        throw profileError;
      }
      return { token: session.access_token, user: profile };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
  };
})();
