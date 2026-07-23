import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("builds a self-contained static GitHub Pages artifact", async () => {
  const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const assetNames = await readdir(new URL("../dist/assets/", import.meta.url));

  assert.match(index, /<html lang="ru">/);
  assert.match(index, /<div id="root"><\/div>/);
  assert.match(index, /ГОФРА CRM/);
  assert.ok(assetNames.some((name) => name.endsWith(".js")));
  assert.ok(assetNames.some((name) => name.endsWith(".css")));
  await access(new URL("../dist/.nojekyll", import.meta.url));
  await access(new URL("../dist/fonts/geist-cyrillic.woff2", import.meta.url));
});

test("keeps every CRM status in the frontend contract", async () => {
  const [app, domain, gateway, packageJson, viteConfig, workflow] =
    await Promise.all([
      readFile(new URL("../app/crm/CrmApp.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/domain.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/crm-gateway.ts", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(app, /CLIENT_PIPELINE/);
  assert.match(app, /DEAL_PIPELINE/);
  assert.match(domain, /"Черный список"/);
  assert.match(domain, /"В закупке \/ производстве"/);
  assert.match(domain, /"Закрыта успешно"/);
  assert.match(domain, /"Отменена"/);
  assert.match(gateway, /localStorage/);
  assert.doesNotMatch(packageJson, /next|vinext|wrangler|drizzle|cloudflare/i);
  assert.match(viteConfig, /GITHUB_REPOSITORY/);
  assert.match(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /\bpush:/);

  await assert.rejects(access(new URL("../.openai/hosting.json", projectRoot)));
  await assert.rejects(access(new URL("../worker/index.ts", projectRoot)));
});
