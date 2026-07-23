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

test("ships the role, theme, calendar, statistics and chat frontend modules", async () => {
  const [
    app,
    domain,
    gateway,
    theme,
    features,
    chat,
    chatGateway,
    styles,
    featureStyles,
    chatStyles,
  ] =
    await Promise.all([
      readFile(new URL("../app/crm/CrmApp.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/domain.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/crm-gateway.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/theme.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/crm/WorkspaceFeatures.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/crm/ChatView.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/chat-gateway.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(
        new URL("../app/crm/workspace-features.css", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/crm/chat.css", import.meta.url), "utf8"),
    ]);

  assert.match(domain, /CRM_SCHEMA_VERSION = 2/);
  assert.match(domain, /UserRole = "manager" \| "employee"/);
  assert.match(domain, /interface Task/);
  assert.match(domain, /"dashboard"[\s\S]*"calendar"[\s\S]*"statistics"[\s\S]*"chat"/);
  assert.match(gateway, /LEGACY_CRM_STORAGE_KEY/);
  assert.match(gateway, /createTasksFromLegacyRecords/);

  assert.match(app, /DashboardView/);
  assert.match(app, /CalendarView/);
  assert.match(app, /StatisticsView/);
  assert.match(app, /ChatView/);
  assert.match(app, /mobile-nav/);
  assert.match(app, /switchDemoUser/);
  assert.match(app, /canViewFinancials/);
  assert.match(app, /managerOptions/);
  assert.match(app, /TASK-КЛ-/);
  assert.match(app, /nextActionAt/);
  assert.match(app, /importBatch/);

  assert.match(theme, /ThemeMode = "system" \| "light" \| "dark"/);
  assert.match(theme, /document\.documentElement\.dataset\.theme/);
  assert.match(styles, /html\[data-theme="dark"\]/);
  assert.match(styles, /--surface-sunken: #12130f/);
  assert.match(styles, /--accent: #d27a3a/);
  assert.doesNotMatch(styles, /#ecefea|#bfd8cf|#fafbf8/);
  assert.doesNotMatch(featureStyles, /#26352f|#a9d3c6|#77b6a2/);
  assert.doesNotMatch(chatStyles, /#456d89|#805b66/);
  assert.match(styles, /@media \(max-width: 720px\)/);

  assert.match(features, /export function DashboardView/);
  assert.match(features, /export function CalendarView/);
  assert.match(features, /export function StatisticsView/);
  assert.match(chat, /export function ChatView/);
  assert.match(chatGateway, /indexedDB/);
  assert.match(chatGateway, /localStorage/);
});
