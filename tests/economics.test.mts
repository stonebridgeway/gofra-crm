import assert from "node:assert/strict";
import test from "node:test";

import {
  ECONOMICS_LABELS,
  QUOTE_STATUSES,
  getDealEconomics,
  getQuoteMargin,
  getQuoteMarginPercent,
  type Quote,
} from "../app/crm/domain.ts";

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  id: "КП-СД-0001-1",
  dealId: "СД-0001",
  version: 1,
  status: "Отправлено",
  revenue: 498000,
  cost: 327000,
  logistics: 40000,
  volume: "24 тыс. шт.",
  validUntil: "2026-08-14",
  changeReason: "",
  sentAt: "2026-07-16T08:00:00.000Z",
  authorId: "USR-1",
  comment: "",
  createdAt: "2026-07-16T08:00:00.000Z",
  updatedAt: "2026-07-16T08:00:00.000Z",
  ...overrides,
});

test("термины экономики однозначны", () => {
  assert.equal(ECONOMICS_LABELS.revenue, "Выручка");
  assert.equal(ECONOMICS_LABELS.cost, "Себестоимость");
  assert.equal(ECONOMICS_LABELS.logistics, "Логистика");
  assert.equal(ECONOMICS_LABELS.margin, "Маржа");
  assert.ok(QUOTE_STATUSES.includes("Заменено"));
});

test("маржа — выручка минус себестоимость минус логистика", () => {
  assert.equal(getQuoteMargin(quote()), 131000);
  assert.equal(getQuoteMarginPercent(quote()), 26.3);
});

test("нулевая выручка не даёт NaN или Infinity", () => {
  const empty = quote({ revenue: 0, cost: 0, logistics: 0 });

  assert.equal(getQuoteMargin(empty), 0);
  assert.equal(getQuoteMarginPercent(empty), 0);
});

test("убыточное КП показывает отрицательную маржу, а не ноль", () => {
  const loss = quote({ revenue: 100000, cost: 90000, logistics: 20000 });

  assert.equal(getQuoteMargin(loss), -10000);
  assert.equal(getQuoteMarginPercent(loss), -10);
});

test("экономика сделки читается из активной версии КП", () => {
  const quotes = [
    quote({ id: "КП-СД-0001-1", version: 1, status: "Заменено", revenue: 400000 }),
    quote({ id: "КП-СД-0001-2", version: 2 }),
  ];

  assert.deepEqual(getDealEconomics({ activeQuoteId: "КП-СД-0001-2" }, quotes), {
    revenue: 498000,
    cost: 327000,
    logistics: 40000,
    margin: 131000,
    marginPercent: 26.3,
  });
});

test("сделка без КП даёт нули, а не падение", () => {
  assert.deepEqual(getDealEconomics({ activeQuoteId: null }, []), {
    revenue: 0,
    cost: 0,
    logistics: 0,
    margin: 0,
    marginPercent: 0,
  });
});

test("ссылка на несуществующее КП даёт нули", () => {
  assert.deepEqual(getDealEconomics({ activeQuoteId: "КП-НЕТ-1" }, [quote()]), {
    revenue: 0,
    cost: 0,
    logistics: 0,
    margin: 0,
    marginPercent: 0,
  });
});