import assert from "node:assert/strict";
import test from "node:test";

import { CRM_SCHEMA_VERSION, DEAL_STATUSES } from "../app/crm/domain.ts";
import { migrateCrmSnapshot } from "../app/crm/crm-gateway.ts";

test("исходники домена импортируются в node --test напрямую", () => {
  assert.equal(DEAL_STATUSES.length, 16);
  assert.equal(CRM_SCHEMA_VERSION, 3);
  assert.equal(typeof migrateCrmSnapshot, "function");
});