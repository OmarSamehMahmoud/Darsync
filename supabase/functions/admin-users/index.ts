import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ detail: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ detail: "Sign in is required." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ detail: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, 503);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ detail: "Session expired. Sign in again." }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.from("profiles").select("role").eq("id", authData.user.id).single();
  if (callerError || caller?.role !== "super_admin") return json({ detail: "Only the super administrator can manage accounts." }, 403);
  let body: any;
  try { body = await req.json(); } catch { return json({ detail: "Invalid request body." }, 400); }
  const action = String(body.action || "");
  if (action === "list") {
    const { data, error } = await admin.from("profiles").select("id,username,role,permissions,created_at").order("created_at", { ascending: false });
    if (error) return json({ detail: error.message }, 500);
    return json({ items: data || [] });
  }
  if (action === "create") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = body.role === "admin" ? "admin" : "user";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ detail: "Enter a valid email address." }, 400);
    if (password.length < 8) return json({ detail: "Password must contain at least 8 characters." }, 400);
    const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 10 });
    if (listError) return json({ detail: listError.message }, 500);
    if ((users.users || []).length >= 5) return json({ detail: "The Darsync account limit is five users." }, 409);
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { username: email.split("@")[0] },
    });
    if (error) return json({ detail: error.message }, 400);
    const { error: roleError } = await admin.from("profiles").update({
      role, permissions: role === "admin"
        ? { update_rag: true, add_rag: true, remove_rag: true }
        : { update_rag: false, add_rag: false, remove_rag: false },
    }).eq("id", data.user.id);
    if (roleError) return json({ detail: roleError.message }, 500);
    return json({ ok: true, id: data.user.id, email, role });
  }
  if (action === "delete") {
    const id = String(body.user_id || "");
    if (!id || id === authData.user.id) return json({ detail: "Invalid user ID." }, 400);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ detail: error.message }, 400);
    return json({ ok: true });
  }
  if (action === "role" || action === "permissions") {
    const id = String(body.user_id || "");
    if (!id || id === authData.user.id) return json({ detail: "You cannot modify your own account here." }, 400);
    const update = action === "role"
      ? (() => {
          const role = ["user", "admin", "super_admin"].includes(body.role) ? body.role : "user";
          const canManageLibrary = role === "admin" || role === "super_admin";
          return {
            role,
            permissions: {
              update_rag: canManageLibrary,
              add_rag: canManageLibrary,
              remove_rag: canManageLibrary,
            },
          };
        })()
      : { permissions: {
          update_rag: !!body.permissions?.update_rag,
          add_rag: !!body.permissions?.add_rag,
          remove_rag: !!body.permissions?.remove_rag,
        } };
    const { error } = await admin.from("profiles").update(update).eq("id", id);
    if (error) return json({ detail: error.message }, 400);
    return json({ ok: true });
  }
  return json({ detail: "Unknown account-management action." }, 400);
});
