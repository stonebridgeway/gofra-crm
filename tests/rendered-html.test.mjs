import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the CRM application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /ГОФРА CRM/i);
  assert.match(html, /Frontend-only прототип/i);
  assert.match(html, /Клиенты/);
  assert.match(html, /Сделки/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps every CRM status in the frontend contract", async () => {
  const [page, layout, app, domain, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/crm/CrmApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/crm/domain.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<CrmApp \/>/);
  assert.match(layout, /lang="ru"/);
  assert.match(app, /CLIENT_PIPELINE/);
  assert.match(app, /DEAL_PIPELINE/);
  assert.match(domain, /"Черный список"/);
  assert.match(domain, /"В закупке \/ производстве"/);
  assert.match(domain, /"Закрыта успешно"/);
  assert.match(domain, /"Отменена"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(
    access(new URL("../app/_sites-preview", templateRoot)),
  );
});
