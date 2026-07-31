# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

ГОФРА CRM — фронтенд-прототип CRM для B2B-продаж гофроупаковки: клиенты, сделки,
контакты, история взаимодействий, календарь задач, статистика, внутренний чат.
Backend отсутствует полностью: всё состояние живёт в `localStorage`/IndexedDB
браузера, деплой — статика на GitHub Pages.

Интерфейс, доменные термины, статусы и сообщения об ошибках — на русском языке.
Новый код должен это соблюдать (тесты проверяют точные русские строки статусов).

## Команды

```bash
pnpm install          # pnpm@11.9.0, Node >=22.13.0
pnpm run dev          # Vite dev-сервер
pnpm run lint         # tsc --noEmit (единственная проверка типов, ESLint нет)
pnpm run build        # vite build -> dist/
pnpm test             # vite build + node --test "tests/**/*.test.*"
```

Один тест-кейс: `node --test --test-name-pattern="<часть имени>" tests/static-build.test.mjs`
(перед этим нужен свежий `pnpm run build` — контрактные тесты читают `dist/`).
Поведенческие наборы (`tests/*.test.mts`) сборки не требуют и запускаются как
`node --test tests/migration.test.mts`.

CI (`.github/workflows/deploy-pages.yml`) на push в `main` выполняет `lint` + `test`
и деплоит `dist/` на Pages.

## Архитектура

Единственный React-рут (`src/main.tsx`) → `ThemeProvider` → `CrmApp`. Роутинга нет:
активный модуль хранится в hash (`#/clients`), см. `getModuleFromHash` и список
`MODULES` в `CrmApp.tsx`. `AppModule` в `domain.ts` — исчерпывающий список из 10 разделов.

### Слой данных

- `app/crm/domain.ts` — единственный источник правды по типам и константам:
  `CLIENT_STATUSES`/`DEAL_STATUSES` (по 16 статусов), `CLIENT_PIPELINE`/`DEAL_PIPELINE`
  (группировка статусов в колонки канбана), `CrmSnapshot`, `CRM_SCHEMA_VERSION`.
  Там же `DealBrief` — технический бриф сделки (FEFCO, размеры, картон, печать,
  объёмы, паллетирование, текущий поставщик, материалы от клиента) со справочниками
  `PACKAGING_TYPES`/`FEFCO_CODES`/`CARDBOARD_GRADES`/`FLUTE_PROFILES` и счётчиком
  заполненности `getDealBriefCompletion`. Бриф добавлен после схемы v2, поэтому
  версия не менялась: недостающие поля добираются при миграции.
  Там же `DealProcess` — дорожка вех расчёта, образца и КП (`DEAL_PROCESS_STEPS`,
  `DEAL_PROCESS_STEP_LABELS`, `SAMPLE_STEPS`, `createEmptyDealProcess`,
  `getActiveProcessSteps`, `getDealProcessCompletion`, `getImpliedProcessSteps`)
  и `Quote` — версия КП с выручкой, себестоимостью, логистикой, объёмом, сроком
  действия и причиной изменения (`QUOTE_STATUSES`, `getQuoteMargin`,
  `getQuoteMarginPercent`).
- `app/crm/crm-gateway.ts` — интерфейс `CrmGateway` (`load`/`save`/`reset`) и его
  единственная реализация `BrowserMockGateway` поверх `localStorage`.
  **Это точка интеграции с будущим backend**: заменяется HTTP-адаптером без правок экранов.
  Здесь же `migrateCrmSnapshot` — обязательная нормализация/миграция любого снимка
  (v1 → v2 → v3, восстановление owner'ов, генерация задач из legacy `nextAction`,
  добор технического брифа через `normalizeDealBrief`, вех — через
  `normalizeDealProcess` и `backfillProcessFromStatus`, версий КП — через
  `normalizeQuote` и `createQuoteFromLegacyDeal`: старые плоские деньги сделки
  становятся КП версии 1). Читает три ключа хранилища по убыванию версии.
  Всё, что читается или пишется в хранилище, проходит через неё.
- `app/crm/fixtures.ts` — демоданные (`demoSnapshot`, `demoQuotes`), возвращаются
  при пустом хранилище. Требования к ним закреплены в `tests/fixtures.test.mts`.

**Деньги сделки живут только в версиях КП.** У `Deal` нет собственных денежных
полей: сделка ссылается на активную версию через `activeQuoteId`, а экраны читают
суммы единственным хелпером `getDealEconomics(deal, quotes)`. Термины —
`ECONOMICS_LABELS`: Выручка, Себестоимость, Логистика, Маржа. Маржа не хранится,
а считается: хранимое поле неизбежно разъезжается со слагаемыми. Прежние
`clientPrice`/`ourPrice`/`purchasePrice`/`logistics`/`margin`/`marginPercent`/
`proposalDate` удалены; контрактный тест не даёт им вернуться. Дата отправки КП —
это веха `deal.process.steps.quoteSent.completedAt`.
- `app/crm/chat-gateway.ts` — отдельный gateway чата с деградацией хранилища
  IndexedDB → localStorage → memory (`ChatStorageMode`).

Состояние приложения — один `CrmSnapshot` в `useState` внутри `CrmApp`. Все мутации
идут через локальный хелпер `commit(next, message?)`: заменяет снимок, асинхронно
сохраняет через gateway и показывает тост. Снимок иммутабелен — новые объекты через spread.

### Роли и доступ

`app/crm/permissions.ts` — роли `manager`/`employee`, набор `Permission`, хелперы
`canViewRecord`/`canAssignOwner`/`canAccessModule` и др. В `CrmApp` из снимка
вычисляется `visibleSnapshot`: для сотрудника коллекции фильтруются по `ownerId`/
`assigneeId`, у руководителя — полный снимок. Экраны получают `visibleSnapshot`,
мутации применяются к полному `snapshot`.

Переключение ролей (`AccountSwitcher`) — демонстрационное; реальную авторизацию
должен проверять backend.

### UI

- `CrmApp.tsx` (~3.3k строк) — оболочка, навигация, глобальный поиск, drawer'ы,
  диалоги создания и экраны клиентов/сделок/контактов/активности/импорта/справочников.
- `WorkspaceFeatures.tsx` (~3.8k строк) — `DashboardView`, `CalendarView`, `StatisticsView`
  (включая самописные `DonutChart`/`DistributionChart` без библиотек).
  Рабочий стол разделён по ролям: `DashboardView` — сводка руководителя,
  `ManagerFocusBoard` — пять рабочих списков менеджера (пороги молчания по КП и
  цикла повторного заказа заданы константами `PROPOSAL_SILENCE_DAYS`,
  `REORDER_CYCLE_DAYS`, `REORDER_WINDOW_DAYS`).
- `DealProcessView.tsx` — `DealProcessSection` (дорожка вех, тумблер «Образец не
  требуется», срок ответа клиента) и `QuoteHistorySection`/`QuoteEditor` (версии КП).
  Веху «КП отправлено» ставит только отправка версии, руками её не переключить.
- `ChatView.tsx`, `Icons.tsx` (`CrmIcon` — все иконки inline SVG), `theme.tsx`
  (`system`/`light`/`dark` через `document.documentElement.dataset.theme`).

Стили — обычный CSS с переменными, а не Tailwind-классы, хотя Tailwind 4 подключён
(`@import "tailwindcss"` в `globals.css`). Порядок импорта в `main.tsx` значим:
`globals.css` задаёт базовые токены, `agency-redesign.css` подключается **после** и
переопределяет палитру/визуальный язык. Правки внешнего вида обычно идут в
`agency-redesign.css`, а не в базовые файлы.

### Задачи и календарь

`Task` — канонический источник для календаря и напоминаний. Поля `nextAction`/`nextStep`
на клиентах/сделках/взаимодействиях оставлены только для отображения; новые функции
календаря должны читать и писать `snapshot.tasks` (`Reminder` — алиас `Task`).

## Соглашения

- ID генерируются строками с русскими префиксами: `КЛ-` клиент, `СД-` сделка,
  `КТ-` контакт, `ИВ-` взаимодействие, `КП-<сделка>-<версия>` версия КП,
  `TASK-<сущность>-`, `СОБ-<сущность>-` (StatusEvent), `КЛ-IM-<batch>-` при импорте.
  Срок ответа по КП ведёт задачу со стабильным id `TASK-СД-<сделка>-reply`.
- Даты — ISO-строки; форматирование через `Intl` с локалью `ru-RU`, валюта RUB.
- `tsconfig` строгий, покрывает только `src`, `app/crm`, `vite.config.ts`.

## Тесты

Два вида тестов, оба без внешних зависимостей — Node исполняет TypeScript сам
(встроенное срезание типов), поэтому `tests/*.test.mts` импортируют `app/crm/*.ts`
напрямую. Из-за этого относительные импорты в `crm-gateway.ts`, `fixtures.ts` и
`permissions.ts` идут с расширением `.ts`, а в `tsconfig` включён
`allowImportingTsExtensions`.

`tests/static-build.test.mjs` — не юнит-тесты, а контрактные проверки: они читают
исходники регулярками и падают, если из кода исчезли ключевые статусы, экспорты,
CSS-переменные, версия схемы, зависимости в `package.json` или настройки workflow.
При осознанном переименовании/удалении такой сущности тест нужно обновлять вместе с кодом.
Также проверяется, что `dist/` самодостаточен (`.nojekyll`, шрифты, assets).

`tests/deal-process.test.mts`, `economics.test.mts`, `migration.test.mts`,
`permissions.test.mts`, `fixtures.test.mts` — поведенческие. Самый важный из них
`migration.test.mts`: миграция односторонне перезаписывает `localStorage`
пользователей, поэтому покрыта плотнее остального, включая идемпотентность.

## Ограничения

Не добавлять Next.js, Cloudflare Workers, Drizzle, wrangler и подобное — тест явно
запрещает эти зависимости, проект должен оставаться чистой статикой.
`vite.config.ts` сам подставляет `base` по имени репозитория в GitHub Actions;
переопределяется через `PAGES_BASE_PATH`.
