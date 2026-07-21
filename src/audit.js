import fs from "node:fs/promises";
import path from "node:path";
export async function audit(event, payload = {}, logPath = process.env.AUDIT_LOG_PATH || "./data/embardaily-audit.jsonl") {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...payload })}\n`);
}
