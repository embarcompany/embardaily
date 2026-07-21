import crypto from "node:crypto";
import { EMBARDAILY_COLUMNS } from "./domain.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_ROOT = "https://sheets.googleapis.com/v4/spreadsheets";

function b64url(value) { return Buffer.from(value).toString("base64url"); }

export async function serviceToken({ serviceAccountEmail, privateKey }, scope = "https://www.googleapis.com/auth/spreadsheets") {
  if (!serviceAccountEmail || !privateKey) throw new Error("Credenciais Google Sheets ausentes.");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: serviceAccountEmail, scope, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 }));
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${payload}.${signature}` }) });
  if (!response.ok) throw new Error(`Falha ao autenticar no Google: ${await response.text()}`);
  return (await response.json()).access_token;
}

function a1Col(index) { let result = ""; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result; return result; }
function sheetRange(tab, range) { return `'${tab.replace(/'/g, "''")}'!${range}`; }

export class SheetsClient {
  constructor(config) { this.config = config; this.token = null; this.headers = null; }
  async request(path, options = {}) {
    if (!this.token) { this.token = await serviceToken(this.config); this.headers = { authorization: `Bearer ${this.token}`, "content-type": "application/json" }; }
    const response = await fetch(`${SHEETS_ROOT}/${this.config.sheetId}${path}`, { ...options, headers: { ...this.headers, ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`Google Sheets ${response.status}: ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  }
  async rows() {
    const range = encodeURIComponent(sheetRange(this.config.sheetTab, "A:AZ"));
    const result = await this.request(`/values/${range}`);
    const [headers = [], ...values] = result.values || [];
    return values.map((line, index) => ({ ...Object.fromEntries(headers.map((header, col) => [header, line[col] ?? ""])), _rowNumber: index + 2 }));
  }
  async ensureColumns() {
    const rows = await this.rows();
    const headers = Object.keys(rows[0] || {}).filter((key) => key !== "_rowNumber");
    const missing = EMBARDAILY_COLUMNS.filter((column) => !headers.includes(column));
    if (!missing.length) return;
    const start = headers.length;
    const range = encodeURIComponent(sheetRange(this.config.sheetTab, `${a1Col(start)}1:${a1Col(start + missing.length - 1)}1`));
    await this.request(`/values/${range}?valueInputOption=USER_ENTERED`, { method: "PUT", body: JSON.stringify({ values: [missing] }) });
  }
  async update(rowNumber, fields) {
    const rows = await this.rows();
    const headers = Object.keys(rows[0] || {}).filter((key) => key !== "_rowNumber");
    const data = Object.entries(fields).map(([key, value]) => ({ range: sheetRange(this.config.sheetTab, `${a1Col(headers.indexOf(key))}${rowNumber}`), values: [[value ?? ""]] }));
    if (!data.length) return;
    await this.request(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) });
  }
  async findByPhone(phone) { return (await this.rows()).find((row) => String(row.Contato || "").replace(/\D/g, "") === phone); }
}
