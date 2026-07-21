import { json, serviceClient } from "../_shared/supabase.ts";

const initialMessage = (name: string) =>
  `Oi, ${name}! Tudo bem? Aqui é da Embarpet. Como foi a chegada e adaptação por aí? 💛`;

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (expectedSecret && request.headers.get("x-embardaily-secret") !== expectedSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = serviceClient();
  const { data: cases, error: claimError } = await supabase.rpc("claim_due_initial_contacts", { batch_size: 50 });
  if (claimError) return json({ error: claimError.message }, 500);

  const apiUrl = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
  const instance = Deno.env.get("EVOLUTION_INSTANCE_NAME") ?? "";
  const apiKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";
  if (!apiUrl || !instance || !apiKey) return json({ error: "Evolution secrets not configured" }, 503);

  let sent = 0;
  const failures: string[] = [];
  for (const campaignCase of cases ?? []) {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, customer:customers(id, full_name, phone_e164, opt_out_at)")
      .eq("id", campaignCase.shipment_id)
      .single();
    const customer = shipment?.customer as { id: string; full_name: string; phone_e164: string; opt_out_at: string | null } | null;
    if (!shipment || !customer || customer.opt_out_at) continue;

    const content = initialMessage(customer.full_name.split(" ")[0]);
    try {
      const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: customer.phone_e164.replace(/^\+/, ""), text: content }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`);
      const messageId = payload?.key?.id ?? payload?.messageId ?? null;
      await supabase.from("messages").insert({
        campaign_case_id: campaignCase.id, customer_id: customer.id, direction: "outbound", status: "sent",
        template_code: "toque_1", content, evolution_message_id: messageId, raw_payload: payload,
      });
      await supabase.from("campaign_cases").update({
        status: "toque_1_enviado", initial_contact_sent_at: new Date().toISOString(), locked_at: null,
        next_action_at: new Date(Date.now() + 4 * 86400000).toISOString(), next_action_label: "Conferir resposta e decidir próximo toque",
      }).eq("id", campaignCase.id);
      await supabase.from("activities").insert({ campaign_case_id: campaignCase.id, shipment_id: shipment.id, kind: "initial_contact_sent", details: { provider: "evolution" } });
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${campaignCase.id}: ${message}`);
      await supabase.from("campaign_cases").update({ locked_at: null, last_error: message }).eq("id", campaignCase.id);
    }
  }
  return json({ claimed: cases?.length ?? 0, sent, failures });
});
