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
  assert.match(packageJson, /"tailwindcss": "4\.3\.3"/);
  assert.match(packageJson, /"@tailwindcss\/vite": "4\.3\.3"/);
  assert.match(viteConfig, /GITHUB_REPOSITORY/);
  assert.match(viteConfig, /tailwindcss\(\)/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /\bpush:/);
  assert.match(workflow, /branches:\s*\n\s*-\s*main/);

  await assert.rejects(access(new URL("../.openai/hosting.json", projectRoot)));
  await assert.rejects(access(new URL("../worker/index.ts", projectRoot)));
});

test("ships the role, theme, calendar, statistics and chat frontend modules", async () => {
  const [
    app,
    entry,
    icons,
    domain,
    gateway,
    theme,
    features,
    chat,
    chatGateway,
    styles,
    featureStyles,
    chatStyles,
    agencyStyles,
    dealProcess,
    managerFocus,
    leaderControl,
  ] =
    await Promise.all([
      readFile(new URL("../app/crm/CrmApp.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/Icons.tsx", import.meta.url), "utf8"),
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
      readFile(new URL("../app/agency-redesign.css", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/DealProcessView.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/manager-focus.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/crm/leader-control.ts", import.meta.url), "utf8"),
    ]);

  assert.match(domain, /CRM_SCHEMA_VERSION = 6/);
  assert.match(domain, /UserRole = "manager" \| "employee"/);
  assert.match(domain, /interface Task/);
  assert.match(domain, /type TaskSource/);
  assert.match(domain, /interface TaskChecklistItem/);
  assert.match(domain, /"dashboard"[\s\S]*"calendar"[\s\S]*"statistics"[\s\S]*"chat"/);
  assert.match(gateway, /LEGACY_CRM_STORAGE_KEY/);
  assert.match(gateway, /gofra-crm-prototype:v4/);
  assert.match(gateway, /gofra-crm-prototype:v5/);
  assert.match(gateway, /gofra-crm-prototype:v6/);
  assert.match(gateway, /gofra-crm-prototype:v3/);
  assert.match(gateway, /normalizeDealNextAction/);
  assert.match(gateway, /resolveExpectedNextOrder/);
  assert.match(gateway, /createTasksFromLegacyRecords/);
  assert.match(gateway, /checklist/);
  assert.match(gateway, /sourceId/);
  assert.match(domain, /DECISION_ROLES/);
  assert.match(domain, /interface PriceApproval/);
  assert.match(domain, /repeatReminderDays/);
  assert.match(domain, /interface DealBrief/);
  assert.match(domain, /interface DealProcess/);
  assert.match(domain, /interface Quote/);
  assert.match(domain, /Выручка/);
  assert.match(gateway, /syncRepeatOrderTasks/);

  assert.match(app, /DashboardView/);
  assert.match(app, /CalendarView/);
  assert.match(app, /StatisticsView/);
  assert.match(app, /ChatView/);
  assert.match(app, /mobile-nav/);
  assert.match(app, /icon: "home"/);
  assert.match(app, /CrmIcon/);
  assert.match(app, /data-module=\{activeModule\}/);
  assert.match(entry, /agency-redesign\.css/);
  assert.match(app, /function AccountSwitcher/);
  assert.match(styles, /\.account-switcher select option/);
  assert.match(styles, /html\[data-theme="dark"\] \.account-switcher select option/);
  assert.doesNotMatch(app, /short: "ГЛ"/u);
  assert.match(app, /switchDemoUser/);
  assert.match(app, /canViewFinancials/);
  assert.match(app, /managerOptions/);
  assert.match(app, /TASK-КЛ-/);
  assert.match(app, /nextActionAt/);
  assert.match(app, /importBatch/);
  assert.match(app, /Обязательный следующий шаг/);
  assert.match(app, /Согласование цены/);
  assert.match(app, /Карта влияния/);
  assert.match(app, /Активные · 90–119 дней/);
  assert.match(app, /Нет данных об отгрузке/);

  assert.match(theme, /ThemeMode = "system" \| "light" \| "dark"/);
  assert.match(theme, /document\.documentElement\.dataset\.theme/);
  assert.match(theme, /name=\{resolvedTheme === "dark" \? "sun" : "moon"\}/);
  assert.match(icons, /export function CrmIcon/);
  assert.match(icons, /case "brand"/);
  assert.match(icons, /strokeWidth="1\.8"/);
  assert.match(styles, /html\[data-theme="dark"\]/);
  assert.match(styles, /@import "tailwindcss"/);
  assert.match(styles, /--surface-sunken: #12130f/);
  assert.match(styles, /--accent: #d27a3a/);
  assert.doesNotMatch(styles, /#ecefea|#bfd8cf|#fafbf8/);
  assert.doesNotMatch(featureStyles, /#26352f|#a9d3c6|#77b6a2/);
  assert.doesNotMatch(chatStyles, /#456d89|#805b66/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(agencyStyles, /Industrial-editorial design layer/);
  assert.match(agencyStyles, /--accent: #3f6873/);
  assert.match(agencyStyles, /--accent: #7fa7b1/);
  assert.doesNotMatch(agencyStyles, /#bd4d21|#de6429/);
  assert.doesNotMatch(agencyStyles, /gofra-module|decimal-leading-zero/);
  assert.doesNotMatch(agencyStyles, /content: "LOCAL"|content: "\/\/\/"/);
  assert.match(agencyStyles, /\.wf-sales-hero[\s\S]*--wf-hero-ink: var\(--ink\)/);
  assert.match(agencyStyles, /clip-path: polygon/);
  assert.match(agencyStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(app, /OPS SYSTEM \/ REV 03/);
  assert.doesNotMatch(app, /Frontend-only прототип|Сбросить демо|Клиенты в прототипе/);
  assert.doesNotMatch(app, /prototype-note|prototype-badge/);
  assert.doesNotMatch(features, /Команда, выручка и точки внимания/);
  assert.doesNotMatch(features, /Результаты команды, движение воронки/);

  assert.match(features, /export function DashboardView/);
  assert.match(features, /function ManagerFocusDashboard/);
  assert.match(features, /Просроченные действия/);
  assert.match(features, /КП без ответа клиента/);
  assert.match(managerFocus, /selectManagerFocus/);
  assert.match(leaderControl, /selectLeaderControl/);
  assert.match(leaderControl, /syncThresholdPriceApprovals/);
  assert.match(features, /LeaderControlSection/);
  assert.match(features, /wf-control-forecast/);
  assert.match(featureStyles, /\.wf-control-board/);
  assert.match(managerFocus, /quote\?\.status === "Отправлено"/);
  assert.match(dealProcess, /Технический бриф/);
  assert.match(dealProcess, /Версии КП/);
  assert.doesNotMatch(dealProcess, /Наша цена/);
  assert.match(features, /function CustomerOverviewDashboard/);
  assert.match(features, /Прогноз повторного заказа/);
  assert.match(app, /function DealWorkspace/);
  assert.match(app, /Рабочее пространство сделки/);
  assert.match(app, /Сохранить результат контакта/);
  assert.match(
    agencyStyles,
    /\.customer-overview-rail\s*\{[^}]*align-self:\s*start;[^}]*position:\s*static;/s,
  );
  assert.match(agencyStyles, /Final workspace-scroll safeguard/);
  assert.match(
    agencyStyles,
    /\.workspace-header\s*\{[^}]*position:\s*relative;[^}]*top:\s*auto;/s,
  );
  assert.match(
    agencyStyles,
    /Final workspace-scroll safeguard[\s\S]*\.view-toolbar,[\s\S]*\.customer-overview-tabs\s*\{[^}]*position:\s*relative;[^}]*top:\s*auto;/,
  );
  assert.match(
    styles,
    /\.side-nav\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s,
  );
  assert.match(agencyStyles, /\.deal-workspace-backdrop/);
  assert.match(features, /export function CalendarView/);
  assert.match(features, /export function StatisticsView/);
  assert.match(features, /wf-forecast-point-hit/);
  assert.match(features, /wf-chart-tooltip/);
  assert.match(features, /aria-pressed=\{selectedStageId === stage\.id\}/);
  assert.match(features, /role="button"[\s\S]*strokeDasharray/);
  assert.match(agencyStyles, /\.wf-chart-selection/);
  assert.match(features, /TASK_SOURCE_LABELS/);
  assert.match(features, /Поставить задачу сотруднику/);
  assert.match(features, /canAssignTasks/);
  assert.match(features, /wf-checklist-editor/);
  assert.match(featureStyles, /\.wf-task-origin/);
  assert.match(featureStyles, /\.wf-task-assignment-bar/);
  assert.match(features, /function DonutChart/);
  assert.match(features, /function DistributionChart/);
  assert.match(chat, /export function ChatView/);
  assert.match(chatGateway, /indexedDB/);
  assert.match(chatGateway, /localStorage/);
});
