import fs from "node:fs";

export function loadEnv(path = ".env") {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnv();

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  sheetId: process.env.GOOGLE_SHEET_ID,
  sheetTab: process.env.GOOGLE_SHEET_TAB || "Embarques",
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  driveParentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "",
  toque1DelayDays: Number(process.env.TOQUE1_DELAY_DAYS || 6),
  reminderDelayDays: Number(process.env.REMINDER_DELAY_DAYS || 4),
  reviewUrl: process.env.GOOGLE_REVIEW_URL || "",
  provider: process.env.WHATSAPP_PROVIDER || "evolution",
  port: Number(process.env.PORT || 3000),
  appBaseUrl: process.env.APP_BASE_URL?.replace(/\/$/, ""),
  auditLogPath: process.env.AUDIT_LOG_PATH || "./data/embardaily-audit.jsonl",
};
