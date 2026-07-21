import { json, serviceClient } from "../_shared/supabase.ts";

const headers = ["id_embarque", "referencia", "resumo_embarque", "responsavel", "whatsapp", "email", "origem", "destino", "data_embarque", "data_chegada", "status_campanha", "contato_inicial_em", "respondeu_em", "proxima_acao_em", "proxima_acao", "pasta_drive", "opt_out_em"];

async function googleAccessToken() {
  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") ?? "";
  const privateKey = (Deno.env.get("GOOGLE_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("Google service account secrets not configured");
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const b64url = (input: Uint8Array | string) => btoa(typeof input === "string" ? input : String.fromCharCode(...input)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${claim}`)));
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64url(signature)}` }) });
  if (!response.ok) throw new Error(`Google token error: ${await response.text()}`);
  return (await response.json()).access_token as string;
}

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (expectedSecret && request.headers.get("x-embardaily-secret") !== expectedSecret) return json({ error: "unauthorized" }, 401);
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  const tab = Deno.env.get("GOOGLE_SHEET_TAB") ?? "Embarques";
  if (!sheetId) return json({ error: "GOOGLE_SHEET_ID not configured" }, 503);
  const supabase = serviceClient();
  const { data: run } = await supabase.from("google_sheet_sync_runs").insert({}).select("id").single();
  try {
    const [{ data: rows, error }, token] = await Promise.all([supabase.from("google_sheet_export").select("*").order("data_embarque", { ascending: false }), googleAccessToken()]);
    if (error) throw error;
    const values = [headers, ...(rows ?? []).map(row => headers.map(header => row[header] ?? ""))];
    const range = encodeURIComponent(`${tab}!A1`);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`, { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ majorDimension: "ROWS", values }) });
    if (!response.ok) throw new Error(`Sheets write error: ${await response.text()}`);
    await supabase.from("google_sheet_sync_runs").update({ status: "success", rows_exported: rows?.length ?? 0, finished_at: new Date().toISOString() }).eq("id", run?.id);
    return json({ success: true, rows_exported: rows?.length ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run?.id) await supabase.from("google_sheet_sync_runs").update({ status: "failed", error: message, finished_at: new Date().toISOString() }).eq("id", run.id);
    return json({ error: message }, 500);
  }
});
