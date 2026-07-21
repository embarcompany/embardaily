import test from "node:test";
import assert from "node:assert/strict";
import { processInbound } from "../src/campaign.js";
import { STATUS } from "../src/domain.js";

function fakeSheets(row) { return { findByPhone: async () => row, update: async (_n, fields) => Object.assign(row, fields) }; }
test("depoimento avança apenas após classificação válida", async () => {
  const row = { _rowNumber: 2, status_embardaily: STATUS.TOUCH1 };
  await processInbound({ sheets: fakeSheets(row), phone: "5511999999999", text: "Não conseguiria deixar a Mel para trás.", classification: { kind: "testimonial" } });
  assert.equal(row.status_embardaily, STATUS.TESTIMONIAL);
  assert.equal(row.texto_depoimento, "Não conseguiria deixar a Mel para trás.");
});
test("opt-out interrompe o fluxo", async () => {
  const row = { _rowNumber: 2, status_embardaily: STATUS.TOUCH1 };
  await processInbound({ sheets: fakeSheets(row), phone: "5511999999999", text: "sair", classification: { kind: "opt_out" } });
  assert.equal(row.status_embardaily, STATUS.OPTED_OUT);
});
