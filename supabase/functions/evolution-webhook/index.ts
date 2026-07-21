import { json, serviceClient } from "../_shared/supabase.ts";

function phoneFromJid(jid?: string) {
  const digits = (jid ?? "").split("@")[0].replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET");
  if (expectedSecret && request.headers.get("x-evolution-secret") !== expectedSecret) return json({ error: "unauthorized" }, 401);
  const payload = await request.json().catch(() => null);
  if (!payload) return json({ error: "invalid JSON" }, 400);

  const event = payload.event ?? payload.type ?? "unknown";
  const data = payload.data ?? payload;
  const key = data.key ?? {};
  const isInbound = key.fromMe === false || key.fromMe === undefined;
  const phone = phoneFromJid(key.remoteJid ?? data.remoteJid ?? data.sender);
  if (!phone || !isInbound) return json({ accepted: true, ignored: true });

  const content = data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? data.text ?? "[Mídia ou mensagem sem texto]";
  const supabase = serviceClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("phone_e164", phone).maybeSingle();
  if (!customer) return json({ accepted: true, matched: false });
  const { data: shipment } = await supabase.from("shipments").select("id, campaign_cases(id)").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const campaignCase = shipment?.campaign_cases?.[0];
  await supabase.from("messages").upsert({
    customer_id: customer.id, campaign_case_id: campaignCase?.id ?? null, direction: "inbound", status: "received",
    content, evolution_message_id: key.id ?? null, raw_payload: payload,
  }, { onConflict: "evolution_message_id", ignoreDuplicates: true });
  if (campaignCase?.id) {
    await supabase.from("campaign_cases").update({ status: "revisao_manual", replied_at: new Date().toISOString(), next_action_at: new Date().toISOString(), next_action_label: "Ler resposta e escolher mensagem pronta" }).eq("id", campaignCase.id);
    await supabase.from("activities").insert({ campaign_case_id: campaignCase.id, shipment_id: shipment?.id, kind: "inbound_message_received", details: { event } });
  }
  return json({ accepted: true, matched: true });
});
