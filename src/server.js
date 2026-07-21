import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { SupabaseClient } from "./supabase-client.js";

const publicDir = path.resolve("public");
const supabase = new SupabaseClient();

async function rawBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks); }
function multipartFile(raw, contentType) {
  const boundary = contentType.match(/boundary=([^;]+)/i)?.[1]?.replace(/^"|"$/g, "");
  if (!boundary) throw new Error("Upload inválido.");
  const part = raw.toString("latin1").split(`--${boundary}`).slice(1, -1).find(value => /name="file"/i.test(value));
  if (!part) throw new Error("Selecione um arquivo.");
  const split = part.indexOf("\r\n\r\n"); const header = part.slice(0, split);
  const filename = header.match(/filename="([^"]+)"/i)?.[1]; const contentTypeFile = header.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim();
  if (!filename || !contentTypeFile) throw new Error("Arquivo sem nome ou tipo.");
  return { filename, contentType: contentTypeFile, content: Buffer.from(part.slice(split + 4).replace(/\r\n$/, ""), "latin1") };
}
async function staticFile(res, filename, type) { try { res.writeHead(200, { "content-type": type }); res.end(await fs.readFile(path.join(publicDir, filename))); } catch { res.writeHead(404); res.end(); } }
function authorized(req) { if (!process.env.CRM_USERNAME || !process.env.CRM_PASSWORD) return true; const value = req.headers.authorization || ""; const decoded = value.startsWith("Basic ") ? Buffer.from(value.slice(6), "base64").toString("utf8") : ""; return decoded === `${process.env.CRM_USERNAME}:${process.env.CRM_PASSWORD}`; }
function dto(row) { return { row: row.id, client: row.client, pet: row.pet, phone: row.phone, company: row.company, destination: row.destination, date: row.date, notes: row.summary, folderUrl: null, contacted: Boolean(row.touch_1_at), touch1At: row.touch_1_at, replyAt: row.reply_at, reminderAttempts: Number(row.reminder_count || 0), status: row.status || "nao_iniciado", nextActionAt: row.next_action_at, nextActionLabel: row.next_action_label }; }

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/") && !authorized(req)) { res.writeHead(401, { "www-authenticate": 'Basic realm="EmbarDaily CRM"' }); return res.end("Autenticação necessária"); }
  if (req.method === "GET" && url.pathname === "/health") return res.end(JSON.stringify({ ok: true, database: supabase.enabled() ? "supabase" : "not_configured" }));
  if (req.method === "GET" && ["/", "/crm"].includes(url.pathname)) return staticFile(res, "index.html", "text/html; charset=utf-8");
  if (req.method === "GET" && ["/novo-embarque", "/embarques/novo"].includes(url.pathname)) return staticFile(res, "novo-embarque.html", "text/html; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/mensagens") return staticFile(res, "mensagens.html", "text/html; charset=utf-8");
  const assets = { "/app.js": ["app.js", "text/javascript"], "/novo-embarque.js": ["novo-embarque.js", "text/javascript"], "/mensagens.js": ["mensagens.js", "text/javascript"], "/app.css": ["app.css", "text/css"], "/dashboard.css": ["dashboard.css", "text/css"], "/form.css": ["form.css", "text/css"], "/mensagens.css": ["mensagens.css", "text/css"], "/fonts.css": ["fonts.css", "text/css"] };
  if (req.method === "GET" && assets[url.pathname]) return staticFile(res, `${assets[url.pathname][0]}`, `${assets[url.pathname][1]}; charset=utf-8`);
  if (!supabase.enabled()) { res.writeHead(503, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "Supabase não configurado. Preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na VPS." })); }
  try {
    if (req.method === "GET" && url.pathname === "/api/contacts") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify((await supabase.contacts()).map(dto))); }
    if (req.method === "POST" && url.pathname === "/api/shipments") { const input = JSON.parse((await rawBody(req)).toString("utf8")); if (!input.client || !input.phone || !input.date || !input.pets?.length) throw new Error("Preencha tutor, telefone, data e ao menos um pet."); res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ row: (await supabase.createShipment(input)).id })); }
    const edit = url.pathname.match(/^\/api\/contacts\/([a-zA-Z0-9-]+)$/);
    if (req.method === "PATCH" && edit) { const { status } = JSON.parse((await rawBody(req)).toString("utf8")); await supabase.updateStatus(edit[1], status); res.writeHead(204); return res.end(); }
    const upload = url.pathname.match(/^\/api\/contacts\/([a-zA-Z0-9-]+)\/upload$/);
    if (req.method === "POST" && upload) { const raw = await rawBody(req); if (raw.length > 100 * 1024 * 1024) throw new Error("Arquivo maior que 100 MB."); const file = multipartFile(raw, req.headers["content-type"] || ""); if (!/^image\/|^video\//.test(file.contentType)) throw new Error("Envie apenas foto ou vídeo."); const asset = await supabase.uploadMedia(upload[1], file); res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(asset)); }
    res.writeHead(404); res.end();
  } catch (error) { res.writeHead(422, { "content-type": "application/json" }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); }
}).listen(config.port, () => console.log(`EmbarDaily (Supabase) listening on :${config.port}`));
