const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = Deno.env.get("NVIDIA_API_KEY");
  const apiUrl = (Deno.env.get("NVIDIA_API_URL") || "https://integrate.api.nvidia.com/v1/chat/completions").replace(/\/$/, "");
  const model = Deno.env.get("NVIDIA_CHAT_MODEL") || "minimaxai/minimax-m3.1-flash";
  if (!key) return json({ online: false, provider: "NVIDIA NIM", chat_model: model, error: "NVIDIA_API_KEY is not configured." });
  const modelsUrl = apiUrl.replace(/\/chat\/completions$/, "/models");
  try {
    const response = await fetch(modelsUrl, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
    if (!response.ok) return json({ online: false, provider: "NVIDIA NIM", chat_model: model, error: `NVIDIA returned HTTP ${response.status}` });
    return json({ online: true, provider: "NVIDIA NIM", chat_model: model });
  } catch (error) {
    return json({ online: false, provider: "NVIDIA NIM", chat_model: model, error: error instanceof Error ? error.message : String(error) });
  }
});
