import { config } from "./config.js";
import { SheetsClient } from "./sheets-client.js";
import { DriveClient } from "./drive-client.js";
import { EvolutionWhatsAppClient } from "./whatsapp-client.js";

const checks = [];
async function check(name, work) { try { const value = await work(); checks.push({ name, ok: true, value }); } catch (error) { checks.push({ name, ok: false, value: error.message }); } }
await check("Google Sheets", async () => { const rows = await new SheetsClient(config).rows(); return `${rows.length} embarque(s) acessível(is)`; });
await check("Google Drive", async () => { if (!config.driveParentFolderId) throw new Error("GOOGLE_DRIVE_PARENT_FOLDER_ID ausente."); const client = new DriveClient(config); await client.request(`https://www.googleapis.com/drive/v3/files/${config.driveParentFolderId}?fields=id,name`); return "Pasta mãe acessível"; });
await check("Evolution API", async () => { const state = await new EvolutionWhatsAppClient().connectionState(); return state.instance?.state || "estado retornado"; });
for (const result of checks) console.log(`${result.ok ? "OK" : "ERRO"} | ${result.name}: ${result.value}`);
if (checks.some((result) => !result.ok)) process.exitCode = 1;
