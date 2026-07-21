import { serviceToken } from "./sheets-client.js";

const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";

function folderId(value) { const match = String(value || "").match(/folders\/([a-zA-Z0-9_-]+)/); return match?.[1] || null; }
export class DriveClient {
  constructor(config) { this.config = config; this.token = null; }
  async request(url, options = {}) {
    if (!this.token) this.token = await serviceToken(this.config, "https://www.googleapis.com/auth/drive");
    const response = await fetch(url, { ...options, headers: { authorization: `Bearer ${this.token}`, ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`Google Drive ${response.status}: ${await response.text()}`);
    return response.json();
  }
  async createFolder(name, parent = null) {
    const parents = parent ? [parent] : this.config.driveParentFolderId ? [this.config.driveParentFolderId] : undefined;
    return this.request(DRIVE_FILES, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents }) });
  }
  async findFolder(name, parent) {
    const escaped = name.replace(/'/g, "\\'"); const query = encodeURIComponent(`name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and '${parent}' in parents and trashed = false`);
    const result = await this.request(`${DRIVE_FILES}?q=${query}&fields=files(id,name)&pageSize=1`); return result.files?.[0] || null;
  }
  monthName(value) {
    let date = new Date(value);
    if (/^\d+(\.\d+)?$/.test(String(value))) date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
    if (Number.isNaN(date.getTime())) { const match = String(value).match(/(\d{2})\/(\d{2})\/(\d{4})/); if (match) date = new Date(`${match[3]}-${match[2]}-${match[1]}T12:00:00Z`); }
    if (Number.isNaN(date.getTime())) return "Sem mês definido";
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")} - ${date.toLocaleString("pt-BR", { month: "long", timeZone: "UTC" })} ${date.getUTCFullYear()}`;
  }
  async upload({ folderId: parent, filename, mimeType, content }) {
    const boundary = `embardaily-${Date.now()}`;
    const metadata = JSON.stringify({ name: filename, parents: [parent] });
    const intro = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`);
    const end = Buffer.from(`\r\n--${boundary}--\r\n`);
    return this.request(`${DRIVE_UPLOAD}&fields=id,name,webViewLink,mimeType`, { method: "POST", headers: { "content-type": `multipart/related; boundary=${boundary}` }, body: Buffer.concat([intro, content, end]) });
  }
  async ensureFolder(row, sheets) {
    const existing = folderId(row["Pasta no Drive"]);
    if (existing) return existing;
    if (!this.config.driveParentFolderId) throw new Error("Defina GOOGLE_DRIVE_PARENT_FOLDER_ID para organizar os arquivos no Drive.");
    const month = this.monthName(row["Data do embarque"]); const monthFolder = await this.findFolder(month, this.config.driveParentFolderId) || await this.createFolder(month, this.config.driveParentFolderId);
    const name = row.resumo_embarque || `${row.Cliente || "Cliente"} - ${row.Pet || "Pet"}`;
    const folder = await this.createFolder(name, monthFolder.id);
    await sheets.update(row._rowNumber, { "Pasta no Drive": `https://drive.google.com/drive/folders/${folder.id}` });
    return folder.id;
  }
}
