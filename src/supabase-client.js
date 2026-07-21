import { config } from "./config.js";

export class SupabaseClient {
  enabled() { return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey); }
  async request(path, options = {}) {
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...options,
      headers: { apikey: config.supabaseServiceRoleKey, authorization: `Bearer ${config.supabaseServiceRoleKey}`, "content-type": "application/json", ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error(`Supabase: ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  }
  contacts() { return this.request("crm_kanban?select=*&order=date.desc.nullslast,created_at.desc"); }
  async createShipment(input) {
    const digits = input.phone.replace(/\D/g, "");
    const phoneE164 = input.phone.trim().startsWith("+") ? `+${digits}` : `+55${digits}`;
    const [customer] = await this.request("customers?on_conflict=phone_e164", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ full_name: input.client.trim(), phone_e164: phoneE164 }) });
    const names = input.pets.map((pet) => pet.name.trim()).filter(Boolean);
    const summary = input.summary?.trim() || `${input.modality || "EMBARQUE"} - ${input.client} - ${input.origin || ""}xGRUx${input.destination || ""} - P: ${input.reference || "sem referência"} 🐶: ${names.join(", ")}`;
    const [shipment] = await this.request("shipments", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ customer_id: customer.id, external_reference: input.reference || null, summary, company: input.company || "Embarpet", origin: input.origin || null, destination: input.destination || null, departure_at: input.date }) });
    for (const name of names) {
      const [pet] = await this.request("pets", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name }) });
      await this.request("shipment_pets", { method: "POST", body: JSON.stringify({ shipment_id: shipment.id, pet_id: pet.id }) });
    }
    await this.request("campaign_cases", { method: "POST", body: JSON.stringify({ shipment_id: shipment.id, initial_contact_due_at: new Date(`${input.date}T12:00:00Z`).toISOString() }) });
    return shipment;
  }
  updateStatus(id, status) { return this.request(`campaign_cases?shipment_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
}
