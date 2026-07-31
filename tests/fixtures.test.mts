import assert from "node:assert/strict";
import test from "node:test";

import { demoQuotes, demoSnapshot } from "../app/crm/fixtures.ts";
import { getDealEconomics } from "../app/crm/domain.ts";

const dealById = (id: string) => {
  const deal = demoSnapshot.deals.find((item) => item.id === id);
  assert.ok(deal, `в демоданных нет сделки ${id}`);
  return deal;
};

test("демо-сделка с историей показывает три версии КП", () => {
  const versions = demoQuotes
    .filter((quote) => quote.dealId === "СД-0832")
    .sort((left, right) => left.version - right.version);

  assert.equal(versions.length, 3);
  assert.equal(versions[0].status, "Заменено");
  assert.equal(versions[1].status, "Заменено");
  assert.equal(versions[1].changeReason, "Клиент увеличил тираж");
  assert.equal(versions[2].status, "Отправлено");
  assert.equal(versions[2].changeReason, "Скидка под объём");
  assert.equal(versions[0].changeReason, "", "у первой версии причины нет");
  assert.equal(dealById("СД-0832").activeQuoteId, versions[2].id);
});

test("экономика активной версии считается из её слагаемых", () => {
  assert.deepEqual(getDealEconomics(dealById("СД-0832"), demoQuotes), {
    revenue: 498000,
    cost: 327000,
    logistics: 40000,
    margin: 131000,
    marginPercent: 26.3,
  });
});

test("есть сделка без КП — ветка «КП ещё не рассчитано» не пустует", () => {
  const withoutQuote = demoSnapshot.deals.filter(
    (deal) => deal.activeQuoteId === null,
  );

  assert.ok(withoutQuote.length >= 1);
  for (const deal of withoutQuote) {
    assert.equal(
      demoQuotes.some((quote) => quote.dealId === deal.id),
      false,
      `у сделки ${deal.id} без активного КП не должно быть версий`,
    );
    assert.deepEqual(getDealEconomics(deal, demoQuotes).revenue, 0);
  }
});

test("есть сделка с просроченной датой ответа — рабочий список не пуст", () => {
  const now = Date.now();
  const overdue = demoSnapshot.deals.filter((deal) => {
    const expected = deal.process.replyExpectedAt;
    return expected !== null && new Date(expected).getTime() < now;
  });

  assert.ok(overdue.length >= 1, "нужна хотя бы одна просроченная дата ответа");
  for (const deal of overdue) {
    assert.notEqual(
      deal.process.steps.quoteSent.completedAt,
      null,
      `у ${deal.id} ждём ответ, значит КП должно быть отправлено`,
    );
  }
});

test("каждая версия КП принадлежит существующей сделке", () => {
  const ids = new Set(demoSnapshot.deals.map((deal) => deal.id));

  for (const quote of demoQuotes) {
    assert.ok(ids.has(quote.dealId), `КП ${quote.id} без своей сделки`);
  }
});

test("activeQuoteId всегда указывает на существующую версию", () => {
  const ids = new Set(demoQuotes.map((quote) => quote.id));

  for (const deal of demoSnapshot.deals) {
    if (deal.activeQuoteId === null) continue;
    assert.ok(
      ids.has(deal.activeQuoteId),
      `сделка ${deal.id} ссылается на несуществующее КП ${deal.activeQuoteId}`,
    );
  }
});
