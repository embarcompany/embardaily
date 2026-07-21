import { STATUS, TERMINAL, isDue, isoNow, normalizePhone, optedOut } from "./domain.js";
import { touch1, touch2, touch3, reminder } from "./messages.js";
import { audit } from "./audit.js";

async function send(client, row, message, template) {
  const phone = normalizePhone(row.Contato);
  if (!phone) throw new Error("Telefone ausente ou inválido");
  return template && client.sendTemplate ? client.sendTemplate(phone, template.name, template.parameters) : client.sendText(phone, message);
}

export async function processCampaign({ sheets, whatsapp, config, now = new Date() }) {
  await sheets.ensureColumns();
  const rows = await sheets.rows();
  const summary = { touch1: 0, touch2: 0, touch3: 0, reminders: 0, noResponse: 0, errors: 0 };
  for (const row of rows) {
    const status = row.status_embardaily || STATUS.NOT_STARTED;
    if (TERMINAL.has(status) || optedOut(row)) continue;
    try {
      if (status === STATUS.NOT_STARTED && normalizePhone(row.Contato) && isDue(row["Data do embarque"], config.toque1DelayDays, now)) {
        const message = touch1(row);
        await send(whatsapp, row, message, { name: process.env.META_TOQUE1_TEMPLATE || "embardaily_depoimento", parameters: [row.Cliente || "", row.Pet || "", row.Empresa || ""] });
        await sheets.update(row._rowNumber, { status_embardaily: STATUS.TOUCH1, data_toque1: isoNow(), "Contato Realizado?": true, erro_log: "" }); await audit("touch1_sent", { row: row._rowNumber }); summary.touch1++;
      } else if (status === STATUS.TESTIMONIAL) {
        await send(whatsapp, row, touch2(row, config.reviewUrl));
        await sheets.update(row._rowNumber, { status_embardaily: STATUS.TOUCH2, data_toque2: isoNow(), erro_log: "" }); await audit("touch2_sent", { row: row._rowNumber }); summary.touch2++;
      } else if (status === STATUS.REVIEW) {
        await send(whatsapp, row, touch3(row));
        await sheets.update(row._rowNumber, { status_embardaily: STATUS.TOUCH3, data_toque3: isoNow(), erro_log: "" }); await audit("touch3_sent", { row: row._rowNumber }); summary.touch3++;
      } else if ([STATUS.TOUCH1, STATUS.WAITING, STATUS.TOUCH2].includes(status) && isDue(row.data_toque1 || row.data_toque2, config.reminderDelayDays, now)) {
        const attempts = Number(row.tentativas_lembrete || 0);
        if (attempts < 1) { await send(whatsapp, row, reminder(row)); await sheets.update(row._rowNumber, { tentativas_lembrete: 1, status_embardaily: STATUS.WAITING }); await audit("reminder_sent", { row: row._rowNumber }); summary.reminders++; }
        else { await sheets.update(row._rowNumber, { status_embardaily: STATUS.NO_RESPONSE }); await audit("no_response", { row: row._rowNumber }); summary.noResponse++; }
      }
    } catch (error) { await sheets.update(row._rowNumber, { status_embardaily: STATUS.ERROR, erro_log: error.message }); await audit("send_error", { row: row._rowNumber, error: error.message }); summary.errors++; }
  }
  return summary;
}

export async function sendNextForContact({ sheets, whatsapp, config, rowNumber }) {
  await sheets.ensureColumns();
  const row = (await sheets.rows()).find((item) => String(item._rowNumber) === String(rowNumber));
  if (!row) throw new Error("Cliente não encontrado.");
  const status = row.status_embardaily || STATUS.NOT_STARTED;
  if (optedOut(row)) throw new Error("Este cliente está bloqueado para contato.");
  if (status === STATUS.NOT_STARTED) {
    await send(whatsapp, row, touch1(row));
    await sheets.update(row._rowNumber, { status_embardaily: STATUS.TOUCH1, data_toque1: isoNow(), "Contato Realizado?": true, erro_log: "" });
  } else if (status === STATUS.TESTIMONIAL) {
    await send(whatsapp, row, touch2(row, config.reviewUrl));
    await sheets.update(row._rowNumber, { status_embardaily: STATUS.TOUCH2, data_toque2: isoNow(), "Contato Realizado?": true, erro_log: "" });
  } else if (status === STATUS.REVIEW) {
    await send(whatsapp, row, touch3(row));
    await sheets.update(row._rowNumber, { status_embardaily: STATUS.TOUCH3, data_toque3: isoNow(), "Contato Realizado?": true, erro_log: "" });
  } else throw new Error("Não há mensagem manual disponível nesta etapa.");
  await audit("manual_message_sent", { row: row._rowNumber, status });
}

export async function processInbound({ sheets, whatsapp, config, phone, text, classification }) {
  const row = await sheets.findByPhone(phone);
  if (!row) { await audit("inbound_unknown", { phone }); return { handled: false }; }
  const status = row.status_embardaily || STATUS.NOT_STARTED;
  if (classification.kind === "opt_out") { await sheets.update(row._rowNumber, { status_embardaily: STATUS.OPTED_OUT, erro_log: "Opt-out recebido" }); await audit("opt_out", { row: row._rowNumber }); return { handled: true }; }
  if (classification.kind === "testimonial" && [STATUS.TOUCH1, STATUS.WAITING].includes(status)) { await sheets.update(row._rowNumber, { status_embardaily: STATUS.TESTIMONIAL, data_resposta_toque1: isoNow(), texto_depoimento: text }); await audit("testimonial_received", { row: row._rowNumber }); return { handled: true }; }
  if (classification.kind === "review_confirmed" && status === STATUS.TOUCH2) { await sheets.update(row._rowNumber, { status_embardaily: STATUS.REVIEW, avaliacao_confirmada: true }); return { handled: true }; }
  const permissions = { instagram_yes: "sim", instagram_no: "não", instagram_anonymous: "sim_sem_identificação" };
  if (permissions[classification.kind] && status === STATUS.TOUCH3) { await sheets.update(row._rowNumber, { status_embardaily: STATUS.COMPLETE, autorizacao_instagram: permissions[classification.kind] }); await audit("campaign_complete", { row: row._rowNumber }); return { handled: true }; }
  await sheets.update(row._rowNumber, { status_embardaily: STATUS.REVIEW_MANUAL, erro_log: classification.reason || "Resposta requer revisão humana" }); await audit("manual_review", { row: row._rowNumber, classification: classification.kind }); return { handled: true, manual: true };
}
