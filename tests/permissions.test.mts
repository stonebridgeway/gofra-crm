import assert from "node:assert/strict";
import test from "node:test";

import { filterAccessibleQuotes } from "../app/crm/permissions.ts";
import type { Deal, Quote, User } from "../app/crm/domain.ts";

const user = (id: string, role: User["role"]): User => ({
  id,
  teamId: "TEAM-1",
  fullName: id,
  email: `${id}@example.com`,
  role,
  jobTitle: "",
  initials: "XX",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const deal = (id: string, ownerId: string) =>
  ({ id, ownerId }) as unknown as Deal;

const quote = (id: string, dealId: string) =>
  ({ id, dealId }) as unknown as Quote;

const users = [user("USR-1", "employee"), user("USR-2", "manager")];
const deals = [deal("СД-1", "USR-1"), deal("СД-2", "USR-2")];
const quotes = [quote("КП-СД-1-1", "СД-1"), quote("КП-СД-2-1", "СД-2")];

test("сотрудник видит КП только по своим сделкам", () => {
  const visible = filterAccessibleQuotes(users[0], quotes, deals, users);

  assert.deepEqual(
    visible.map((item) => item.id),
    ["КП-СД-1-1"],
  );
});

test("руководитель видит КП по всем сделкам команды", () => {
  const visible = filterAccessibleQuotes(users[1], quotes, deals, users);

  assert.equal(visible.length, 2);
});

test("КП без своей сделки не показывается никому", () => {
  const orphan = [quote("КП-СИРОТА-1", "СД-НЕТ")];

  assert.equal(filterAccessibleQuotes(users[1], orphan, deals, users).length, 0);
});
