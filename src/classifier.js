export async function classifyInbound(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (/^(sair|pare|cancelar|não quero|nao quero)\b/.test(normalized)) return { kind: "opt_out" };
  if (!process.env.ANTHROPIC_API_KEY) return { kind: "manual_review", reason: "ANTHROPIC_API_KEY não configurada" };
  const prompt = `Classifique a resposta de um tutor na campanha pós-embarque de pet. Retorne APENAS JSON: {"kind":"testimonial|review_confirmed|instagram_yes|instagram_no|instagram_anonymous|manual_review","reason":"curto"}. Depoimento é relato pessoal explicando por que levar o pet foi importante. Texto: ${JSON.stringify(text)}`;
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514", max_tokens: 150, messages: [{ role: "user", content: prompt }] }) });
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  const raw = (await response.json()).content?.[0]?.text || "{}";
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { return { kind: "manual_review", reason: "Resposta de IA inválida" }; }
}
