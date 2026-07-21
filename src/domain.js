export const STATUS = Object.freeze({
  NOT_STARTED: "não_iniciado", TOUCH1: "toque1_enviado", WAITING: "aguardando_resposta",
  TESTIMONIAL: "depoimento_recebido", TOUCH2: "toque2_enviado", REVIEW: "avaliacao_pedida",
  TOUCH3: "toque3_enviado", COMPLETE: "concluido", NO_RESPONSE: "sem_resposta",
  ERROR: "erro_envio", REVIEW_MANUAL: "revisao_manual", OPTED_OUT: "opt_out",
});

export const EMBARDAILY_COLUMNS = ["status_embardaily", "data_toque1", "data_resposta_toque1", "texto_depoimento", "data_toque2", "avaliacao_confirmada", "data_toque3", "autorizacao_instagram", "tentativas_lembrete", "erro_log", "resumo_embarque"];
export const TERMINAL = new Set([STATUS.COMPLETE, STATUS.NO_RESPONSE, STATUS.OPTED_OUT]);

export function normalizePhone(value) {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const explicitInternational = raw.startsWith("+") || digits.startsWith("00");
  const complete = digits.startsWith("00") ? digits.slice(2) : digits;
  if (explicitInternational) return complete.length >= 11 && complete.length <= 15 ? complete : null;
  if (complete.length === 10 || complete.length === 11) return `55${complete}`;
  return complete.length >= 11 && complete.length <= 15 ? complete : null;
}

export function optedOut(row) {
  const note = `${row.Observações ?? ""} ${row.status_embardaily ?? ""}`.toLowerCase();
  return /(não autoriz|nao autoriz|opt[ -]?out|não contat|nao contat|sair)/.test(note);
}

export function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
export function isDue(date, days, now = new Date()) { return Boolean(date) && addDays(date, days) <= now; }
export function isoNow() { return new Date().toISOString(); }
