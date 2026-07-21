import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { SheetsClient } from "./sheets-client.js";
import { DriveClient } from "./drive-client.js";
import { createWhatsAppClient } from "./whatsapp-client.js";
import { processCampaign, processInbound, sendNextForContact } from "./campaign.js";
import { classifyInbound } from "./classifier.js";
import { normalizePhone } from "./domain.js";
import { demoContacts } from "./demo-data.js";

const sheets = new SheetsClient(config); const drive = new DriveClient(config); const whatsapp = createWhatsAppClient(config.provider);
const publicDir = path.resolve("public");
function dailyDelay() { const n = new Date(), next = new Date(n); next.setHours(9, 0, 0, 0); if (next <= n) next.setDate(next.getDate() + 1); return next - n; }
async function runJob() { try { console.log("Campaign", await processCampaign({ sheets, whatsapp, config })); } catch (error) { console.error("Campaign failed", error.message); } finally { setTimeout(runJob, dailyDelay()); } }
setTimeout(runJob, dailyDelay());

function contacted(row) { return [true, "true", "sim", "1"].includes(String(row["Contato Realizado?"] ?? "").toLowerCase()) || row["Contato Realizado?"] === true; }
function contactDto(row) { return { row: row._rowNumber, client: row.Cliente, pet: row.Pet, phone: row.Contato, company: row.Empresa, destination: row.Destino, date: row["Data do embarque"], notes: row.Observações, testimonial: row.texto_depoimento, folderUrl: row["Pasta no Drive"], contacted: contacted(row), status: row.status_embardaily || "não_iniciado" }; }
function evolutionMessage(body) { const data = body.data || body; const key = data.key || {}; const content = data.message || {}; return { phone: normalizePhone((key.remoteJid || data.sender || "").split("@")[0]), text: content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption, fromMe: key.fromMe }; }
async function rawBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks); }
async function jsonBody(req) { return (await rawBody(req)).toString("utf8"); }
function multipartFile(raw, contentType) {
  const boundary = contentType.match(/boundary=([^;]+)/i)?.[1]?.replace(/^"|"$/g, ""); if (!boundary) throw new Error("Upload inválido: boundary ausente.");
  const parts = raw.toString("latin1").split(`--${boundary}`).slice(1, -1);
  const part = parts.find((item) => /name="file"/i.test(item)); if (!part) throw new Error("Selecione um arquivo.");
  const split = part.indexOf("\r\n\r\n"); const header = part.slice(0, split); const filename = header.match(/filename="([^"]+)"/i)?.[1]; const mimeType = header.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim();
  if (!filename || !mimeType) throw new Error("Arquivo sem nome ou tipo.");
  const data = Buffer.from(part.slice(split + 4).replace(/\r\n$/, ""), "latin1"); return { filename, mimeType, content: data };
}
async function staticFile(res, filename, type) { try { res.writeHead(200, { "content-type": type }); res.end(await fs.readFile(path.join(publicDir, filename))); } catch { res.writeHead(404); res.end(); } }
function isDashboardRequest(url) { return url.pathname === "/" || url.pathname === "/app.js" || url.pathname === "/app.css" || url.pathname.startsWith("/api/"); }
function authorized(req) { if (!process.env.CRM_USERNAME || !process.env.CRM_PASSWORD) return true; const value = req.headers.authorization || ""; const decoded = value.startsWith("Basic ") ? Buffer.from(value.slice(6), "base64").toString("utf8") : ""; return decoded === `${process.env.CRM_USERNAME}:${process.env.CRM_PASSWORD}`; }

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (isDashboardRequest(url) && !authorized(req)) { res.writeHead(401, { "www-authenticate": 'Basic realm="EmbarDaily CRM"' }); return res.end("Autenticação necessária"); }
  if (req.method === "GET" && url.pathname === "/health") return res.end(JSON.stringify({ ok: true }));
  if (req.method === "GET" && url.pathname === "/") return staticFile(res, "index.html", "text/html; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/app.js") return staticFile(res, "app.js", "text/javascript; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/novo-embarque") return staticFile(res, "novo-embarque.html", "text/html; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/novo-embarque.js") return staticFile(res, "novo-embarque.js", "text/javascript; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/form.css") return staticFile(res, "form.css", "text/css; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/app.css") return staticFile(res, "app.css", "text/css; charset=utf-8");
  if (req.method === "GET" && url.pathname === "/api/contacts") { if (!config.sheetId) { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(demoContacts)); } try { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify((await sheets.rows()).map(contactDto))); } catch (error) { res.writeHead(500); return res.end(JSON.stringify({ error: error.message })); } }
  if (req.method === "POST" && url.pathname === "/api/shipments") { try { await sheets.ensureColumns(); const input = JSON.parse(await jsonBody(req)); if (!input.client || !input.phone || !input.date || !input.pets?.length) throw new Error("Preencha tutor, telefone, data e ao menos um pet."); const pets = input.pets.map((pet) => pet.name).join(", "); const breeds = input.pets.map((pet) => pet.breed).filter(Boolean).join("; "); const dateLabel = new Date(`${input.date}T12:00:00`).toLocaleDateString("pt-BR"); const generatedSummary = `${input.modality || "EMBARQUE"} - ${input.client} - ${input.origin || ""}xGRUx${input.destination || ""}${dateLabel} - P: ${input.reference || "sem referência"} 🐶: ${pets}`; const row = await sheets.append({ Cliente: input.client, Contato: input.phone, Pet: pets, "Espécie / Raça": breeds, Origem: input.origin || "", Destino: input.destination || "", Modalidade: input.modality || "", "Data do embarque": input.date, Empresa: input.company || "Embarpet", "Postado?": "Não", "Contato Realizado?": false, Observações: [input.notes, input.reference ? `Processo: ${input.reference}` : ""].filter(Boolean).join(" | "), status_embardaily: "não_iniciado", resumo_embarque: input.summary?.trim() || generatedSummary }); res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(contactDto(row))); } catch (error) { res.writeHead(422); return res.end(error.message); } }
  const edit = url.pathname.match(/^\/api\/contacts\/(\d+)$/);
  if (req.method === "PATCH" && edit) { try { const { status } = JSON.parse(await jsonBody(req)); await sheets.update(edit[1], { status_embardaily: status }); res.writeHead(204); return res.end(); } catch (error) { res.writeHead(500); return res.end(error.message); } }
  const send = url.pathname.match(/^\/api\/contacts\/(\d+)\/send$/);
  if (req.method === "POST" && send) { try { await sendNextForContact({ sheets, whatsapp, config, rowNumber: send[1] }); res.writeHead(204); return res.end(); } catch (error) { res.writeHead(422); return res.end(error.message); } }
  const folder = url.pathname.match(/^\/api\/contacts\/(\d+)\/folder$/);
  if (req.method === "POST" && folder) { try { const row = (await sheets.rows()).find((item) => String(item._rowNumber) === folder[1]); if (!row) throw new Error("Cliente não encontrado."); const id = await drive.ensureFolder(row, sheets); res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ folderUrl: `https://drive.google.com/drive/folders/${id}` })); } catch (error) { res.writeHead(422); return res.end(error.message); } }
  const upload = url.pathname.match(/^\/api\/contacts\/(\d+)\/upload$/);
  if (req.method === "POST" && upload) { try { const raw = await rawBody(req); if (raw.length > 100 * 1024 * 1024) throw new Error("Arquivo maior que 100 MB."); const file = multipartFile(raw, req.headers["content-type"] || ""); if (!/^image\/|^video\//.test(file.mimeType)) throw new Error("Envie apenas foto ou vídeo."); const row = (await sheets.rows()).find((item) => String(item._rowNumber) === upload[1]); if (!row) throw new Error("Cliente não encontrado."); const parent = await drive.ensureFolder(row, sheets); const result = await drive.upload({ folderId: parent, ...file }); res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(result)); } catch (error) { res.writeHead(422); return res.end(error.message); } }
  if (req.method !== "POST" || url.pathname !== "/webhook/whatsapp") { res.writeHead(404); return res.end(); }
  try { const body = JSON.parse(await jsonBody(req)); const message = evolutionMessage(body); if (message.phone && message.text && !message.fromMe) await processInbound({ sheets, whatsapp, config, phone: message.phone, text: message.text, classification: await classifyInbound(message.text) }); res.writeHead(200); res.end("ok"); } catch (error) { console.error(error); res.writeHead(500); res.end(); }
}).listen(config.port, () => console.log(`EmbarDaily listening on :${config.port}`));
