import test from "node:test";
import assert from "node:assert/strict";
import { STATUS, isDue, normalizePhone, optedOut } from "../src/domain.js";

test("normaliza telefones brasileiros e internacionais", () => {
  assert.equal(normalizePhone("(11) 91234-5678"), "5511912345678");
  assert.equal(normalizePhone("+1 212 555 0100"), "12125550100");
  assert.equal(normalizePhone("123"), null);
});
test("respeita a regra de vencimento", () => {
  assert.equal(isDue("2026-07-10", 6, new Date("2026-07-16T12:00:00Z")), true);
  assert.equal(isDue("2026-07-10", 7, new Date("2026-07-16T12:00:00Z")), false);
});
test("detecta recusa antes de qualquer envio", () => {
  assert.equal(optedOut({ Observações: "Cliente não autoriza contato" }), true);
  assert.equal(optedOut({ status_embardaily: STATUS.NOT_STARTED }), false);
});
