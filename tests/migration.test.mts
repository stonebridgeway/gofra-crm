import assert from "node:assert/strict";
import test from "node:test";

import { migrateCrmSnapshot } from "../app/crm/crm-gateway.ts";
import { CRM_SCHEMA_VERSION, getDealEconomics } from "../app/crm/domain.ts";

/** Снимок схемы v2 в том виде, в каком он лежит в localStorage у пользователя. */
const legacySnapshot = (dealOverrides: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  // Обязательные коллекции: без них migrateCrmSnapshot считает снимок битым.
  clients: [],
  contacts: [],
  interactions: [],
  dictionaries: {},
  deals: [
    {
      id: "СД-0001",
      clientId: "КЛ-0001",
      contactId: null,
      title: "Короба под гофролоток",
      product: "Гофроящик",
      volume: "24 тыс. шт.",
      clientPrice: 516000,
      ourPrice: 498000,
      purchasePrice: 327000,
      logistics: 40000,
      margin: 999999,
      marginPercent: 99,
      status: "КП отправлено",
      proposalDate: "2026-07-16",
      nextAction: "Позвонить",
      nextActionAt: null,
      managerName: "",
      comment: "",
      ownerId: "",
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-16T08:00:00.000Z",
      ...dealOverrides,
    },
  ],
});

test("схема поднимается до третьей версии", () => {
  const snapshot = migrateCrmSnapshot(legacySnapshot());

  assert.equal(snapshot.schemaVersion, CRM_SCHEMA_VERSION);
  assert.equal(snapshot.schemaVersion, 3);
});

test("деньги сделки превращаются в КП версии 1", () => {
  const snapshot = migrateCrmSnapshot(legacySnapshot());
  const deal = snapshot.deals.find((item) => item.id === "СД-0001");
  assert.ok(deal);

  const quotes = snapshot.quotes.filter((quote) => quote.dealId === "СД-0001");
  assert.equal(quotes.length, 1);

  const [quote] = quotes;
  assert.equal(quote.version, 1);
  assert.equal(quote.revenue, 498000, "выручка берётся из ourPrice");
  assert.equal(quote.cost, 327000);
  assert.equal(quote.logistics, 40000);
  assert.equal(quote.volume, "24 тыс. шт.");
  assert.equal(quote.changeReason, "", "у первой версии причины изменения нет");
  assert.equal(quote.status, "Отправлено", "была дата КП");
  assert.equal(deal.activeQuoteId, quote.id);
});

test("расходившаяся маржа пересчитывается, а не переносится", () => {
  const snapshot = migrateCrmSnapshot(legacySnapshot());
  const deal = snapshot.deals.find((item) => item.id === "СД-0001");
  assert.ok(deal);

  const economics = getDealEconomics(deal, snapshot.quotes);
  assert.equal(economics.margin, 131000, "498000 - 327000 - 40000");
  assert.equal(economics.marginPercent, 26.3);
});

test("сделка с нулевыми деньгами не получает КП", () => {
  const snapshot = migrateCrmSnapshot(
    legacySnapshot({
      clientPrice: 0,
      ourPrice: 0,
      purchasePrice: 0,
      logistics: 0,
      margin: 0,
      marginPercent: 0,
      proposalDate: null,
      status: "Новая заявка",
    }),
  );
  const deal = snapshot.deals.find((item) => item.id === "СД-0001");
  assert.ok(deal);

  assert.equal(deal.activeQuoteId, null);
  assert.equal(
    snapshot.quotes.filter((quote) => quote.dealId === "СД-0001").length,
    0,
  );
});

test("КП без даты отправки остаётся черновиком", () => {
  const snapshot = migrateCrmSnapshot(
    legacySnapshot({ proposalDate: null, status: "Считаем цену" }),
  );
  const [quote] = snapshot.quotes.filter((item) => item.dealId === "СД-0001");

  assert.equal(quote.status, "Черновик");
});

test("веха отправки КП восстанавливается из proposalDate", () => {
  const snapshot = migrateCrmSnapshot(legacySnapshot());
  const deal = snapshot.deals.find((item) => item.id === "СД-0001");
  assert.ok(deal);

  assert.equal(deal.process.steps.quoteSent.completedAt, "2026-07-16");
});

test("поздний статус дозаполняет пропущенные вехи", () => {
  const snapshot = migrateCrmSnapshot(
    legacySnapshot({ status: "Отгружено", proposalDate: null }),
  );
  const deal = snapshot.deals.find((item) => item.id === "СД-0001");
  assert.ok(deal);

  for (const step of [
    "specReceived",
    "calculationRequested",
    "calculationReceived",
    "quoteSent",
  ] as const) {
    assert.notEqual(
      deal.process.steps[step].completedAt,
      null,
      `веха ${step} должна быть дозаполнена`,
    );
  }
});

test("вехи образца никогда не дозаполняются по статусу", () => {
  const snapshot = migrateCrmSnapshot(legacySnapshot({ status: "Отгружено" }));
  const deal = snapshot.deals.find((item) => item.id === "СД-0001");
  assert.ok(deal);

  assert.equal(deal.process.steps.sampleProduced.completedAt, null);
  assert.equal(deal.process.steps.sampleSent.completedAt, null);
  assert.equal(deal.process.steps.sampleApproved.completedAt, null);
  assert.equal(deal.process.sampleSkipped, false);
});

test("закрытые статусы не дозаполняют вехи: сделка могла умереть до расчёта", () => {
  const snapshot = migrateCrmSnapshot(
    legacySnapshot({ status: "Отменена", proposalDate: null }),
  );
  const deal = snapshot.deals.find((item) => item.id === "СД-0001");
  assert.ok(deal);

  assert.equal(deal.process.steps.quoteSent.completedAt, null);
  assert.equal(deal.process.steps.calculationRequested.completedAt, null);
});

test("КП без своей сделки отбрасывается", () => {
  const snapshot = migrateCrmSnapshot({
    ...legacySnapshot(),
    quotes: [
      {
        id: "КП-СИРОТА-1",
        dealId: "СД-НЕТ",
        version: 1,
        status: "Отправлено",
        revenue: 1,
        cost: 0,
        logistics: 0,
        volume: "",
        validUntil: null,
        changeReason: "",
        sentAt: null,
        authorId: "",
        comment: "",
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T08:00:00.000Z",
      },
    ],
  });

  assert.equal(
    snapshot.quotes.some((quote) => quote.id === "КП-СИРОТА-1"),
    false,
  );
});

test("activeQuoteId в никуда пересчитывается на последнюю живую версию", () => {
  const snapshot = migrateCrmSnapshot({
    ...legacySnapshot({ activeQuoteId: "КП-НЕТ-9" }),
    quotes: [
      {
        id: "КП-СД-0001-1",
        dealId: "СД-0001",
        version: 1,
        status: "Заменено",
        revenue: 400000,
        cost: 300000,
        logistics: 20000,
        volume: "",
        validUntil: null,
        changeReason: "",
        sentAt: null,
        authorId: "",
        comment: "",
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T08:00:00.000Z",
      },
      {
        id: "КП-СД-0001-2",
        dealId: "СД-0001",
        version: 2,
        status: "Отправлено",
        revenue: 498000,
        cost: 327000,
        logistics: 40000,
        volume: "",
        validUntil: null,
        changeReason: "Скидка под объём",
        sentAt: "2026-07-16T08:00:00.000Z",
        authorId: "",
        comment: "",
        createdAt: "2026-07-16T08:00:00.000Z",
        updatedAt: "2026-07-16T08:00:00.000Z",
      },
    ],
  });
  const deal = snapshot.deals.find((item) => item.id === "СД-0001");
  assert.ok(deal);

  assert.equal(deal.activeQuoteId, "КП-СД-0001-2");
});

test("миграция идемпотентна: повторный прогон ничего не ломает", () => {
  const once = migrateCrmSnapshot(legacySnapshot());
  const twice = migrateCrmSnapshot(JSON.parse(JSON.stringify(once)));

  assert.equal(twice.quotes.length, once.quotes.length);
  const dealOnce = once.deals.find((item) => item.id === "СД-0001");
  const dealTwice = twice.deals.find((item) => item.id === "СД-0001");
  assert.ok(dealOnce && dealTwice);
  assert.equal(dealTwice.activeQuoteId, dealOnce.activeQuoteId);
  assert.deepEqual(
    getDealEconomics(dealTwice, twice.quotes),
    getDealEconomics(dealOnce, once.quotes),
  );
});
