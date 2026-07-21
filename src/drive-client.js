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
  async createFolder(name) {
    const parents = this.config.driveParentFolderId ? [this.config.driveParentFolderId] : undefined;
    return this.request(DRIVE_FILES, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents }) });
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
    const folder = await this.createFolder(`${row.Cliente || "Cliente"} - ${row.Pet || "Pet"}`);
    await sheets.update(row._rowNumber, { "Pasta no Drive": `https://drive.google.com/drive/folders/${folder.id}` });
    return folder.id;
  }
}
