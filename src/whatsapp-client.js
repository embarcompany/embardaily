import crypto from "node:crypto";

export class MetaWhatsAppClient {
  constructor(env = process.env) { this.env = env; }
  async sendTemplate(phone, name, parameters) {
    return this.send(phone, { messaging_product: "whatsapp", to: phone, type: "template", template: { name, language: { code: this.env.META_TEMPLATE_LANGUAGE || "pt_BR" }, components: [{ type: "body", parameters: parameters.map((text) => ({ type: "text", text })) }] } });
  }
  async sendText(phone, text) { return this.send(phone, { messaging_product: "whatsapp", to: phone, type: "text", text: { preview_url: false, body: text } }); }
  async send(phone, payload) {
    if (!this.env.META_ACCESS_TOKEN || !this.env.META_PHONE_NUMBER_ID) throw new Error("Credenciais Meta WhatsApp ausentes.");
    const response = await fetch(`https://graph.facebook.com/v22.0/${this.env.META_PHONE_NUMBER_ID}/messages`, { method: "POST", headers: { authorization: `Bearer ${this.env.META_ACCESS_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`Meta WhatsApp ${response.status}: ${await response.text()}`);
    return response.json();
  }
}

export class EvolutionWhatsAppClient {
  constructor(env = process.env) { this.env = env; }
  async sendText(phone, text) {
    const url = this.env.EVOLUTION_API_URL?.replace(/\/$/, "");
    const { EVOLUTION_INSTANCE_NAME: instance, EVOLUTION_API_KEY: key } = this.env;
    if (!url || !instance || !key) throw new Error("Credenciais Evolution API ausentes.");
    const response = await fetch(`${url}/message/sendText/${encodeURIComponent(instance)}`, { method: "POST", headers: { "content-type": "application/json", apikey: key }, body: JSON.stringify({ number: phone, textMessage: { text }, linkPreview: false }) });
    if (!response.ok) throw new Error(`Evolution API ${response.status}: ${await response.text()}`);
    return response.json();
  }
}

export function createWhatsAppClient(provider) { return provider === "meta" ? new MetaWhatsAppClient() : new EvolutionWhatsAppClient(); }
export function validMetaSignature(raw, signature, secret) {
  if (!secret) return true;
  if (!signature) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
