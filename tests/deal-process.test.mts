import assert from "node:assert/strict";
import test from "node:test";

import {
  DEAL_PROCESS_STEPS,
  DEAL_PROCESS_STEP_LABELS,
  createEmptyDealProcess,
  getDealProcessCompletion,
} from "../app/crm/domain.ts";

test("процесс состоит из семи вех с русскими подписями", () => {
  assert.equal(DEAL_PROCESS_STEPS.length, 7);
  assert.equal(DEAL_PROCESS_STEP_LABELS.specReceived, "ТЗ получено");
  assert.equal(DEAL_PROCESS_STEP_LABELS.calculationRequested, "Расчёт запрошен");
  assert.equal(DEAL_PROCESS_STEP_LABELS.sampleApproved, "Образец согласован");
  assert.equal(DEAL_PROCESS_STEP_LABELS.quoteSent, "КП отправлено");
});

test("пустой процесс не содержит пройденных вех", () => {
  const process = createEmptyDealProcess();

  assert.equal(process.replyExpectedAt, null);
  assert.equal(process.sampleSkipped, false);
  for (const step of DEAL_PROCESS_STEPS) {
    assert.equal(process.steps[step].completedAt, null);
    assert.equal(process.steps[step].completedById, null);
  }
  assert.deepEqual(getDealProcessCompletion(process), { filled: 0, total: 7 });
});

test("счётчик считает только вехи с датой", () => {
  const process = createEmptyDealProcess();
  process.steps.specReceived.completedAt = "2026-07-12T08:00:00.000Z";
  process.steps.calculationRequested.completedAt = "2026-07-13T08:00:00.000Z";

  assert.deepEqual(getDealProcessCompletion(process), { filled: 2, total: 7 });
});

test("отказ от образца убирает три вехи из знаменателя и из числителя", () => {
  const process = createEmptyDealProcess();
  process.steps.specReceived.completedAt = "2026-07-12T08:00:00.000Z";
  process.steps.sampleProduced.completedAt = "2026-07-20T08:00:00.000Z";
  process.sampleSkipped = true;

  // Образец отмечен, но не требуется — в счёт не идёт.
  assert.deepEqual(getDealProcessCompletion(process), { filled: 1, total: 4 });
});