"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { crmGateway } from "./crm-gateway";
import { ChatView } from "./ChatView";
import { DealProcessView } from "./DealProcessView";
import { CrmIcon, type CrmIconName } from "./Icons";
import {
  CalendarView,
  DashboardView,
  StatisticsView,
} from "./WorkspaceFeatures";
import { ThemeSwitch } from "./theme";
import {
  CLIENT_PIPELINE,
  CLIENT_STATUSES,
  DECISION_INFLUENCES,
  DECISION_ROLES,
  DEAL_PIPELINE,
  DEAL_STATUSES,
  LOSS_REASONS,
  PREFERRED_CHANNELS,
  createEmptyDealBrief,
  createEmptyDealProcess,
  type Attachment,
  type AppModule,
  type Client,
  type ClientStatus,
  type Contact,
  type CrmSnapshot,
  type Deal,
  type DealStatus,
  type Interaction,
  type InteractionKind,
  type LossReason,
  type PriceApproval,
  type PriceApprovalStatus,
  type Quote,
  type PipelineGroup,
  type Potential,
  type Task,
  type User,
} from "./domain";
import {
  calculateExpectedNextOrder,
  getDaysWithoutOrder,
  hasRequiredDealNextAction,
  isOpenDeal,
  matchesRepeatSegment,
  normalizeDealNextAction,
  recordsShipment,
  syncClientOrderCycleFromShipment,
  syncRepeatOrderTasks,
  TERMINAL_DEAL_STATUSES,
  type RepeatSegment,
} from "./sales-automation";
import { syncThresholdPriceApprovals } from "./leader-control";
import {
  canAccessModule,
  canViewFinancials,
  filterAccessibleQuotes,
  filterAccessibleRecords,
  isManager,
} from "./permissions";

type ViewMode = "board" | "list";
type DrawerTarget =
  | { kind: "client"; id: string }
  | { kind: "deal"; id: string }
  | null;
type MoveIntent =
  | {
      kind: "client" | "deal";
      id: string;
      title: string;
      statuses: readonly string[];
    }
  | null;
type CreateKind = "client" | "deal" | "contact" | "interaction" | null;
type PendingLoss = {
  dealId: string;
  status: "Проиграна" | "Отменена";
} | null;
type GlobalSearchResult = {
  id: string;
  kind: "client" | "deal" | "contact";
  title: string;
  meta: string;
  clientId?: string;
};

const MODULES: Array<{
  id: AppModule;
  icon: CrmIconName;
  label: string;
  eyebrow: string;
  mobile?: boolean;
}> = [
  {
    id: "dashboard",
    icon: "home",
    label: "Главная",
    eyebrow: "Рабочий стол",
    mobile: true,
  },
  {
    id: "clients",
    icon: "clients",
    label: "Клиенты",
    eyebrow: "Воронка клиентов",
    mobile: true,
  },
  {
    id: "deals",
    icon: "deals",
    label: "Сделки",
    eyebrow: "Коммерческая воронка",
  },
  {
    id: "contacts",
    icon: "contacts",
    label: "Контакты",
    eyebrow: "Контактные лица",
  },
  {
    id: "activity",
    icon: "activity",
    label: "История",
    eyebrow: "Взаимодействия",
  },
  {
    id: "calendar",
    icon: "calendar",
    label: "Календарь",
    eyebrow: "Задачи и напоминания",
    mobile: true,
  },
  {
    id: "statistics",
    icon: "statistics",
    label: "Статистика",
    eyebrow: "Результаты и динамика",
  },
  {
    id: "chat",
    icon: "chat",
    label: "Чат",
    eyebrow: "Командные обсуждения",
    mobile: true,
  },
  {
    id: "import",
    icon: "import",
    label: "Импорт",
    eyebrow: "Загрузка лидов",
  },
  {
    id: "dictionaries",
    icon: "settings",
    label: "Справочники",
    eyebrow: "Настройки CRM",
  },
];

const NAV_GROUPS: Array<{ label: string; modules: AppModule[] }> = [
  { label: "Рабочий стол", modules: ["dashboard"] },
  { label: "Клиенты", modules: ["clients", "contacts"] },
  { label: "Продажи", modules: ["deals"] },
  {
    label: "Задачи и контакты",
    modules: ["activity", "calendar", "chat"],
  },
  { label: "Аналитика", modules: ["statistics"] },
  { label: "Справочники", modules: ["import", "dictionaries"] },
];

const managers = ["Софья Романова", "Николай Ветров", "Тимур Агапов"];
const APP_MODULE_IDS = new Set<AppModule>(MODULES.map((module) => module.id));

const getModuleFromHash = (): AppModule => {
  if (typeof window === "undefined") return "dashboard";
  const candidate = window.location.hash
    .replace(/^#\/?/, "")
    .split(/[/?]/)[0] as AppModule;
  return APP_MODULE_IDS.has(candidate) ? candidate : "dashboard";
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string | null, withTime = false) => {
  if (!value) return "Не назначено";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};

const toIsoOrNull = (value: FormDataEntryValue | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getDueState = (value: string | null) => {
  if (!value) return { className: "due-neutral", label: "Без даты" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { className: "due-neutral", label: "Дата не указана" };
  }
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diff = Math.round(
    (startTarget.getTime() - startToday.getTime()) / 86_400_000,
  );

  if (diff < 0) {
    return {
      className: "due-overdue",
      label: `Просрочено на ${Math.abs(diff)} дн.`,
    };
  }
  if (diff === 0) return { className: "due-today", label: "Сегодня" };
  if (diff === 1) return { className: "due-soon", label: "Завтра" };
  return { className: "due-neutral", label: formatDate(value) };
};

const approvalStatusLabel = (status: PriceApprovalStatus): string =>
  ({
    pending: "Ожидает решения",
    approved: "Согласовано",
    rejected: "Отклонено",
    clarification: "Нужно уточнение",
  })[status];

const nextClientStatus = (status: ClientStatus | null) => {
  if (!status) return CLIENT_STATUSES[0];
  const linear = CLIENT_STATUSES.filter(
    (value) =>
      !["Не подходит", "Спящий клиент", "Отказ", "Черный список"].includes(
        value,
      ),
  );
  const index = linear.indexOf(status);
  return index >= 0 && index < linear.length - 1 ? linear[index + 1] : null;
};

const nextDealStatus = (status: DealStatus) => {
  const linear = DEAL_STATUSES.filter(
    (value) =>
      !TERMINAL_DEAL_STATUSES.includes(
        value as (typeof TERMINAL_DEAL_STATUSES)[number],
      ) && value !== "Отложена",
  );
  const index = linear.indexOf(status);
  return index >= 0 && index < linear.length - 1 ? linear[index + 1] : null;
};

const searchIncludes = (query: string, values: Array<string | null>) => {
  const normalized = query.trim().toLocaleLowerCase("ru");
  if (!normalized) return true;
  return values.some((value) =>
    (value ?? "").toLocaleLowerCase("ru").includes(normalized),
  );
};

function AccountSwitcher({
  currentUser,
  users,
  onChange,
  variant,
}: {
  currentUser: User;
  users: readonly User[];
  onChange: (userId: string) => void;
  variant: "nav" | "header" | "mobile";
}) {
  const roleLabel =
    currentUser.role === "manager" ? "Руководитель" : "Сотрудник";

  return (
    <label
      className={`account-switcher account-switcher-${variant} group/account cursor-pointer`}
      title="Переключить аккаунт"
    >
      <span aria-hidden="true" className="account-avatar">
        <CrmIcon
          className="size-[18px] transition-transform duration-200 group-hover/account:scale-105"
          name={currentUser.role === "manager" ? "manager" : "user"}
        />
      </span>
      <span className="account-copy">
        <strong>{currentUser.fullName}</strong>
        <small>{roleLabel}</small>
      </span>
      <span aria-hidden="true" className="account-chevron">
        <CrmIcon className="size-[14px]" name="chevron-down" />
      </span>
      <select
        aria-label="Выбрать кабинет сотрудника"
        onChange={(event) => onChange(event.target.value)}
        value={currentUser.id}
      >
        {users
          .filter((user) => user.isActive)
          .map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName} ·{" "}
              {user.role === "manager" ? "руководитель" : "сотрудник"}
            </option>
          ))}
      </select>
    </label>
  );
}

export function CrmApp() {
  const [activeModule, setActiveModule] = useState<AppModule>(getModuleFromHash);
  const [snapshot, setSnapshot] = useState<CrmSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerTarget>(null);
  const [moveIntent, setMoveIntent] = useState<MoveIntent>(null);
  const [pendingLoss, setPendingLoss] = useState<PendingLoss>(null);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [createClientId, setCreateClientId] = useState<string | null>(null);
  const [createDealId, setCreateDealId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [pendingClientDeletion, setPendingClientDeletion] =
    useState<Client | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const currentUser = useMemo(
    () =>
      snapshot?.users.find(
        (user) => user.id === snapshot.session.currentUserId,
      ) ?? null,
    [snapshot],
  );

  const visibleModules = useMemo(
    () =>
      currentUser
        ? MODULES.filter((module) => canAccessModule(currentUser, module.id))
        : MODULES.filter(
            (module) =>
              module.id !== "import" && module.id !== "dictionaries",
          ),
    [currentUser],
  );

  const visibleSnapshot = useMemo(() => {
    if (!snapshot || !currentUser || isManager(currentUser)) return snapshot;

    const clients = filterAccessibleRecords(
      currentUser,
      snapshot.clients,
      snapshot.users,
    );
    const clientIds = new Set(clients.map((client) => client.id));
    const deals = filterAccessibleRecords(
      currentUser,
      snapshot.deals,
      snapshot.users,
    );
    const dealIds = new Set(deals.map((deal) => deal.id));

    return {
      ...snapshot,
      clients,
      deals,
      contacts: filterAccessibleRecords(
        currentUser,
        snapshot.contacts,
        snapshot.users,
      ),
      interactions: filterAccessibleRecords(
        currentUser,
        snapshot.interactions,
        snapshot.users,
      ),
      priceApprovals: filterAccessibleRecords(
        currentUser,
        snapshot.priceApprovals,
        snapshot.users,
      ),
      quotes: filterAccessibleQuotes(
        currentUser,
        snapshot.quotes,
        snapshot.deals,
        snapshot.users,
      ).filter((quote) => dealIds.has(quote.dealId)),
      tasks: snapshot.tasks.filter(
        (task) => task.assigneeId === currentUser.id,
      ),
      statusEvents: snapshot.statusEvents.filter(
        (event) =>
          (event.entityType === "client" && clientIds.has(event.entityId)) ||
          (event.entityType === "deal" && dealIds.has(event.entityId)),
      ),
      targets: snapshot.targets.filter(
        (target) =>
          target.subjectId === currentUser.id ||
          target.subjectId === currentUser.teamId,
      ),
    };
  }, [currentUser, snapshot]);

  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    if (!visibleSnapshot || globalSearch.trim().length < 2) return [];

    const clients = visibleSnapshot.clients
      .filter((client) =>
        searchIncludes(globalSearch, [
          client.companyName,
          client.inn,
          client.city,
          client.industry,
        ]),
      )
      .map((client) => ({
        id: client.id,
        kind: "client" as const,
        title: client.companyName,
        meta: `Клиент · ${client.status ?? "Без статуса"}`,
      }));

    const deals = visibleSnapshot.deals
      .filter((deal) =>
        searchIncludes(globalSearch, [
          deal.title,
          deal.product,
          visibleSnapshot.clients.find(
            (client) => client.id === deal.clientId,
          )?.companyName ?? null,
        ]),
      )
      .map((deal) => ({
        id: deal.id,
        kind: "deal" as const,
        title: deal.title,
        meta: `Сделка · ${deal.status}`,
      }));

    const contacts = visibleSnapshot.contacts
      .filter((contact) =>
        searchIncludes(globalSearch, [
          contact.fullName,
          contact.phone,
          contact.email,
          contact.role,
        ]),
      )
      .map((contact) => ({
        id: contact.id,
        kind: "contact" as const,
        title: contact.fullName,
        meta: `Контакт · ${contact.role || "Должность не указана"}`,
        clientId: contact.clientId,
      }));

    return [...clients, ...deals, ...contacts].slice(0, 8);
  }, [globalSearch, visibleSnapshot]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await crmGateway.load();
      setSnapshot(next);
    } catch (loadError) {
      if (
        !(loadError instanceof DOMException && loadError.name === "AbortError")
      ) {
        setError("Не удалось загрузить данные. Попробуйте ещё раз.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void crmGateway
      .load(controller.signal)
      .then((next) => setSnapshot(next))
      .catch((loadError) => {
        if (
          !(
            loadError instanceof DOMException &&
            loadError.name === "AbortError"
          )
        ) {
          setError("Не удалось загрузить данные. Попробуйте ещё раз.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrawer(null);
      setMoveIntent(null);
      setPendingLoss(null);
      setCreateKind(null);
      setMobileMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onHashChange = () => setActiveModule(getModuleFromHash());
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/dashboard");
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!currentUser || canAccessModule(currentUser, activeModule)) return;
    setActiveModule("dashboard");
    window.history.replaceState(null, "", "#/dashboard");
  }, [activeModule, currentUser]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };

  const navigateTo = (module: AppModule) => {
    if (currentUser && !canAccessModule(currentUser, module)) {
      notify("Этот раздел доступен руководителю");
      return;
    }
    setActiveModule(module);
    setMobileMoreOpen(false);
    if (window.location.hash !== `#/${module}`) {
      window.location.hash = `/${module}`;
    }
  };

  const openGlobalSearchResult = (result: GlobalSearchResult) => {
    if (result.kind === "deal") {
      setDrawer({ kind: "deal", id: result.id });
    } else {
      setDrawer({
        kind: "client",
        id: result.kind === "client" ? result.id : result.clientId ?? result.id,
      });
    }
    setGlobalSearch("");
  };

  const commit = (next: CrmSnapshot, message?: string) => {
    const deals = next.deals.map((deal) => normalizeDealNextAction(deal));
    const normalizedBase = {
      ...next,
      deals,
      tasks: syncRepeatOrderTasks(next.clients, next.tasks),
    };
    const normalizedNext = {
      ...normalizedBase,
      priceApprovals: syncThresholdPriceApprovals(normalizedBase),
    };
    setSnapshot(normalizedNext);
    void crmGateway.save(normalizedNext).catch(() => {
      setError("Не удалось сохранить изменение.");
    });
    if (message) notify(message);
  };

  const moveClient = (id: string, status: ClientStatus) => {
    if (!snapshot) return;
    const previous = snapshot.clients.find((client) => client.id === id);
    if (!previous || previous.status === status) {
      setMoveIntent(null);
      return;
    }
    const now = new Date().toISOString();
    commit(
      {
        ...snapshot,
        clients: snapshot.clients.map((client) =>
          client.id === id ? { ...client, status, updatedAt: now } : client,
        ),
        statusEvents: [
          ...snapshot.statusEvents,
          {
            id: `СОБ-КЛ-${Date.now()}`,
            entityType: "client",
            entityId: id,
            fromStatus: previous.status,
            toStatus: status,
            changedById:
              currentUser?.id ?? snapshot.session.currentUserId,
            changedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      `Клиент перемещён: ${status}`,
    );
    setMoveIntent(null);
  };

  const moveDeal = (
    id: string,
    status: DealStatus,
    lossReason: LossReason | null = null,
  ) => {
    if (!snapshot) return;
    const previous = snapshot.deals.find((deal) => deal.id === id);
    if (!previous || previous.status === status) {
      setMoveIntent(null);
      return;
    }
    if (!hasRequiredDealNextAction({ ...previous, status })) {
      notify("Сначала запишите следующий шаг и дату по сделке");
      setCreateClientId(previous.clientId);
      setCreateDealId(previous.id);
      setCreateKind("interaction");
      setMoveIntent(null);
      return;
    }
    const now = new Date().toISOString();
    const recordsNewShipment =
      recordsShipment({ status }) && !recordsShipment(previous);
    commit(
      {
        ...snapshot,
        deals: snapshot.deals.map((deal) =>
          deal.id === id
            ? {
                ...deal,
                status,
                lossReason:
                  status === "Проиграна" || status === "Отменена"
                    ? lossReason
                    : null,
                updatedAt: now,
              }
            : deal,
        ),
        clients: recordsNewShipment
          ? snapshot.clients.map((client) =>
              client.id === previous.clientId
                ? {
                    ...syncClientOrderCycleFromShipment(client, now),
                    updatedAt: now,
                  }
                : client,
            )
          : snapshot.clients,
        statusEvents: [
          ...snapshot.statusEvents,
          {
            id: `СОБ-СД-${Date.now()}`,
            entityType: "deal",
            entityId: id,
            fromStatus: previous.status,
            toStatus: status,
            changedById:
              currentUser?.id ?? snapshot.session.currentUserId,
            changedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      `Сделка перемещена: ${status}`,
    );
    setMoveIntent(null);
  };

  const requestClientMove = (
    client: Client,
    statuses: readonly string[] = CLIENT_STATUSES,
  ) => {
    setMoveIntent({
      kind: "client",
      id: client.id,
      title: client.companyName,
      statuses,
    });
  };

  const requestDealMove = (
    deal: Deal,
    statuses: readonly string[] = DEAL_STATUSES,
  ) => {
    setMoveIntent({
      kind: "deal",
      id: deal.id,
      title: deal.title,
      statuses,
    });
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot || !createKind) return;
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();

    if (createKind === "client") {
      const companyName = String(form.get("companyName") ?? "").trim();
      if (!companyName) return;
      const managerName = String(
        form.get("manager") ?? currentUser?.fullName ?? managers[0],
      );
      const ownerId =
        snapshot.users.find((user) => user.fullName === managerName)?.id ??
        currentUser?.id ??
        snapshot.session.currentUserId;
      const nextAction = String(form.get("nextAction") ?? "").trim();
      const nextActionAt = toIsoOrNull(form.get("nextActionAt"));
      const orderFrequencyDays =
        Number(form.get("orderFrequencyDays")) > 0
          ? Number(form.get("orderFrequencyDays"))
          : null;
      const lastShipmentAt =
        String(form.get("lastShipmentAt") ?? "").trim() || null;
      const manualExpectedNextOrderAt =
        String(form.get("expectedNextOrderAt") ?? "").trim() || null;
      const client: Client = {
        id: `КЛ-${Date.now().toString().slice(-4)}`,
        ownerId,
        createdAt: now,
        updatedAt: now,
        companyName,
        inn: String(form.get("inn") ?? ""),
        region: String(form.get("region") ?? ""),
        city: String(form.get("city") ?? ""),
        industry: String(form.get("industry") ?? "Другое"),
        produces: "",
        mayPurchase: String(form.get("mayPurchase") ?? ""),
        potential: String(form.get("potential") ?? "B") as Potential,
        status: String(form.get("status") ?? "Новый лид") as ClientStatus,
        source: String(form.get("source") ?? "Другое"),
        managerName,
        lastContactAt: null,
        nextAction,
        nextActionAt,
        comment: "",
        orderFrequencyDays,
        lastShipmentAt,
        expectedNextOrderAt:
          manualExpectedNextOrderAt ??
          calculateExpectedNextOrder(lastShipmentAt, orderFrequencyDays),
        expectedNextOrderManual: Boolean(manualExpectedNextOrderAt),
        averageMonthlyVolume: Math.max(
          0,
          Number(form.get("averageMonthlyVolume") ?? 0),
        ),
        repeatReminderDays:
          Number(form.get("repeatReminderDays")) === 7 ? 7 : 14,
      };
      const task: Task | null = nextAction
        ? {
            id: `TASK-КЛ-${Date.now()}`,
            title: nextAction,
            description: `Следующее действие по клиенту «${companyName}».`,
            kind: "follow_up",
            status: "open",
            priority: "normal",
            dueAt: nextActionAt,
            completedAt: null,
            assigneeId: ownerId,
            createdById:
              currentUser?.id ?? snapshot.session.currentUserId,
            source: "client",
            sourceId: client.id,
            checklist: [],
            clientId: client.id,
            dealId: null,
            contactId: null,
            createdAt: now,
            updatedAt: now,
          }
        : null;
      commit(
        {
          ...snapshot,
          clients: [client, ...snapshot.clients],
          tasks: task ? [task, ...snapshot.tasks] : snapshot.tasks,
        },
        "Клиент добавлен",
      );
    }

    if (createKind === "deal") {
      const title = String(form.get("title") ?? "").trim();
      const clientId = String(form.get("clientId") ?? "");
      if (!title || !clientId) return;
      const ourPrice = Number(form.get("ourPrice") ?? 0);
      const managerName = String(
        form.get("manager") ?? currentUser?.fullName ?? managers[0],
      );
      const ownerId =
        snapshot.users.find((user) => user.fullName === managerName)?.id ??
        currentUser?.id ??
        snapshot.session.currentUserId;
      const nextAction = String(form.get("nextAction") ?? "").trim();
      const nextActionAt = toIsoOrNull(form.get("nextActionAt"));
      const forecastCloseAt = toIsoOrNull(form.get("forecastCloseAt"));
      const dealStatus = String(
        form.get("status") ?? "Новая заявка",
      ) as DealStatus;
      if (
        !hasRequiredDealNextAction({
          status: dealStatus,
          nextAction,
          nextActionAt,
          needsNextAction: false,
        })
      ) {
        notify("Для незакрытой сделки укажите следующий шаг и дату");
        return;
      }
      const dealId = `СД-${Date.now().toString().slice(-4)}`;
      const quoteId = `quote-${dealId}-1`;
      const cost = Math.round(ourPrice * 0.68);
      const logistics = Math.round(ourPrice * 0.08);
      const deal: Deal = {
        id: dealId,
        ownerId,
        createdAt: now,
        updatedAt: now,
        clientId,
        contactId: null,
        title,
        product: String(form.get("product") ?? ""),
        volume: String(form.get("volume") ?? ""),
        clientPrice: ourPrice,
        ourPrice,
        purchasePrice: cost,
        logistics,
        margin: ourPrice - cost - logistics,
        marginPercent:
          ourPrice === 0
            ? 0
            : Math.round(
                ((ourPrice - cost - logistics) / ourPrice) * 1000,
              ) / 10,
        status: dealStatus,
        proposalDate: null,
        forecastCloseAt,
        lossReason: null,
        brief: createEmptyDealBrief(),
        process: createEmptyDealProcess(),
        activeQuoteId: quoteId,
        nextAction,
        nextActionAt,
        needsNextAction: false,
        managerName,
        comment: "",
      };
      const quote: Quote = {
        id: quoteId,
        dealId,
        version: 1,
        status: "Черновик",
        revenue: ourPrice,
        cost,
        logistics,
        volume: deal.volume,
        validUntil: null,
        changeReason: "",
        sentAt: null,
        authorId: ownerId,
        comment: "",
        createdAt: now,
        updatedAt: now,
      };
      const task: Task | null = nextAction
        ? {
            id: `TASK-СД-${Date.now()}`,
            title: nextAction,
            description: `Следующее действие по сделке «${title}».`,
            kind: "follow_up",
            status: "open",
            priority: "normal",
            dueAt: nextActionAt,
            completedAt: null,
            assigneeId: ownerId,
            createdById:
              currentUser?.id ?? snapshot.session.currentUserId,
            source: "deal",
            sourceId: deal.id,
            checklist: [],
            clientId,
            dealId: deal.id,
            contactId: null,
            createdAt: now,
            updatedAt: now,
          }
        : null;
      commit(
        {
          ...snapshot,
          deals: [deal, ...snapshot.deals],
          quotes: [quote, ...snapshot.quotes],
          tasks: task ? [task, ...snapshot.tasks] : snapshot.tasks,
        },
        "Сделка добавлена",
      );
    }

    if (createKind === "contact") {
      const fullName = String(form.get("fullName") ?? "").trim();
      const clientId = String(
        form.get("clientId") ?? createClientId ?? "",
      );
      if (!fullName || !clientId) return;
      const ownerId =
        snapshot.clients.find((client) => client.id === clientId)?.ownerId ??
        currentUser?.id ??
        snapshot.session.currentUserId;
      const values = {
        clientId,
        fullName,
        role: String(form.get("role") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        decisionRole: String(
          form.get("decisionRole") ?? "Закупщик",
        ) as Contact["decisionRole"],
        decisionInfluence: String(
          form.get("decisionInfluence") ?? "Влияет",
        ) as Contact["decisionInfluence"],
        preferredChannel: String(
          form.get("preferredChannel") ?? "Телефон",
        ) as Contact["preferredChannel"],
        introductionNeeded: String(form.get("introductionNeeded") ?? ""),
      };

      if (editingContact) {
        commit(
          {
            ...snapshot,
            contacts: snapshot.contacts.map((item) =>
              item.id === editingContact.id
                ? { ...item, ...values, updatedAt: now }
                : item,
            ),
          },
          "Контакт обновлён",
        );
      } else {
        const contact: Contact = {
          id: `КТ-${Date.now().toString().slice(-4)}`,
          ownerId,
          createdAt: now,
          updatedAt: now,
          comment: "",
          ...values,
        };
        commit(
          { ...snapshot, contacts: [contact, ...snapshot.contacts] },
          "Контакт добавлен",
        );
      }
    }

    if (createKind === "interaction") {
      const clientId = String(
        form.get("clientId") ?? createClientId ?? "",
      );
      const subject = String(form.get("subject") ?? "").trim();
      const dealId = String(form.get("dealId") ?? "");
      const contactId = String(form.get("contactId") ?? "");
      if (!clientId || !dealId || !contactId || !subject) {
        notify("Выберите клиента, сделку и контактное лицо");
        return;
      }
      const managerName = String(
        form.get("manager") ?? currentUser?.fullName ?? managers[0],
      );
      const ownerId =
        snapshot.users.find((user) => user.fullName === managerName)?.id ??
        currentUser?.id ??
        snapshot.session.currentUserId;
      const nextStep = String(form.get("nextStep") ?? "").trim();
      const nextStepAt = toIsoOrNull(form.get("nextStepAt"));
      if (!nextStep || !nextStepAt) {
        notify("Следующий шаг и его дата обязательны");
        return;
      }
      const attachments: Attachment[] = form
        .getAll("attachments")
        .filter(
          (value): value is File =>
            typeof File !== "undefined" &&
            value instanceof File &&
            value.size > 0,
        )
        .map((file, index) => ({
          id: `ВЛ-${Date.now()}-${index + 1}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
        }));
      const interaction: Interaction = {
        id: `ИВ-${Date.now().toString().slice(-4)}`,
        ownerId,
        createdAt: now,
        updatedAt: now,
        occurredAt: now,
        clientId,
        dealId,
        contactId,
        kind: String(form.get("kind") ?? "Звонок") as InteractionKind,
        subject,
        result: String(form.get("result") ?? ""),
        nextStep,
        nextStepAt,
        managerName,
        comment: "",
        attachments,
      };
      const task: Task = {
            id: `TASK-ИВ-${Date.now()}`,
            title: nextStep,
            description: `Следующий шаг после взаимодействия «${subject}».`,
            kind: "follow_up",
            status: "open",
            priority: "normal",
            dueAt: nextStepAt,
            completedAt: null,
            assigneeId: ownerId,
            createdById:
              currentUser?.id ?? snapshot.session.currentUserId,
            source: "interaction",
            sourceId: interaction.id,
            checklist: [],
            clientId,
            dealId,
            contactId,
            createdAt: now,
            updatedAt: now,
          };
      const selectedDeal = snapshot.deals.find((deal) => deal.id === dealId);
      const requestApproval = form.get("requestApproval") === "on";
      const priceApproval: PriceApproval | null =
        requestApproval && selectedDeal
          ? {
              id: `СЦ-${Date.now()}`,
              clientId,
              dealId,
              product: String(
                form.get("approvalProduct") ?? selectedDeal.product,
              ),
              currentPrice: Number(
                form.get("currentPrice") ?? selectedDeal.ourPrice,
              ),
              requestedPrice: Number(form.get("requestedPrice") ?? 0),
              volume: String(
                form.get("approvalVolume") ?? selectedDeal.volume,
              ),
              reason: String(form.get("approvalReason") ?? ""),
              comment: String(form.get("approvalComment") ?? ""),
              attachments,
              trigger: "manual",
              quoteId: selectedDeal.activeQuoteId,
              marginPercent: selectedDeal.marginPercent,
              discountPercent: null,
              thresholdPercent: snapshot.salesControl.minMarginPercent,
              status: "pending",
              requestedById:
                currentUser?.id ?? snapshot.session.currentUserId,
              reviewedById: null,
              reviewedAt: null,
              ownerId,
              createdAt: now,
              updatedAt: now,
            }
          : null;
      commit(
        {
          ...snapshot,
          interactions: [interaction, ...snapshot.interactions],
          tasks: [task, ...snapshot.tasks],
          deals: snapshot.deals.map((deal) =>
            deal.id === dealId
              ? {
                  ...deal,
                  nextAction: nextStep,
                  nextActionAt: nextStepAt,
                  needsNextAction: false,
                  updatedAt: now,
                }
              : deal,
          ),
          clients: snapshot.clients.map((client) =>
            client.id === clientId
              ? {
                  ...client,
                  lastContactAt: now,
                  nextAction: nextStep,
                  nextActionAt: nextStepAt,
                  updatedAt: now,
                }
              : client,
          ),
          priceApprovals: priceApproval
            ? [priceApproval, ...snapshot.priceApprovals]
            : snapshot.priceApprovals,
        },
        priceApproval
          ? "Контакт сохранён, запрос на согласование отправлен"
          : "Контакт сохранён, задача создана",
      );
    }

    setCreateKind(null);
    setCreateClientId(null);
    setCreateDealId(null);
    setEditingContact(null);
  };

  const updateClientRepeatOrder = (
    clientId: string,
    values: {
      orderFrequencyDays: number | null;
      lastShipmentAt: string | null;
      expectedNextOrderAt: string | null;
      averageMonthlyVolume: number;
      repeatReminderDays: 7 | 14;
      expectedNextOrderManual: boolean;
    },
  ) => {
    if (!snapshot) return;
    const updatedAt = new Date().toISOString();
    const calculatedExpectedAt = calculateExpectedNextOrder(
      values.lastShipmentAt,
      values.orderFrequencyDays,
    );
    commit(
      {
        ...snapshot,
        clients: snapshot.clients.map((client) =>
          client.id === clientId
            ? {
                ...client,
                ...values,
                expectedNextOrderAt:
                  values.expectedNextOrderManual
                    ? values.expectedNextOrderAt
                    : calculatedExpectedAt,
                updatedAt,
              }
            : client,
        ),
      },
      "Цикл повторных заказов обновлён",
    );
  };

  const reviewPriceApproval = (
    approvalId: string,
    status: PriceApprovalStatus,
  ) => {
    if (!snapshot || !currentUser || !isManager(currentUser)) {
      notify("Решение по цене доступно руководителю");
      return;
    }
    const reviewedAt = new Date().toISOString();
    commit(
      {
        ...snapshot,
        priceApprovals: snapshot.priceApprovals.map((approval) =>
          approval.id === approvalId
            ? {
                ...approval,
                status,
                reviewedById: currentUser.id,
                reviewedAt,
                updatedAt: reviewedAt,
              }
            : approval,
        ),
      },
      `Статус согласования: ${approvalStatusLabel(status)}`,
    );
  };

  const openCreate = (
    kind: Exclude<CreateKind, null>,
    clientId?: string,
    dealId?: string,
  ) => {
    setEditingContact(null);
    setCreateKind(kind);
    setCreateClientId(clientId ?? null);
    setCreateDealId(dealId ?? null);
  };

  const openContactCard = (contact: Contact) => {
    setEditingContact(contact);
    setCreateKind("contact");
    setCreateClientId(contact.clientId);
    setCreateDealId(null);
  };

  const deleteClient = (clientId: string) => {
    if (!snapshot) return;
    const client = snapshot.clients.find((item) => item.id === clientId);
    if (!client) return;
    const dealIds = new Set(
      snapshot.deals
        .filter((deal) => deal.clientId === clientId)
        .map((deal) => deal.id),
    );
    commit(
      {
        ...snapshot,
        clients: snapshot.clients.filter((item) => item.id !== clientId),
        contacts: snapshot.contacts.filter(
          (item) => item.clientId !== clientId,
        ),
        deals: snapshot.deals.filter((item) => item.clientId !== clientId),
        interactions: snapshot.interactions.filter(
          (item) => item.clientId !== clientId,
        ),
        priceApprovals: snapshot.priceApprovals.filter(
          (item) => item.clientId !== clientId && !dealIds.has(item.dealId),
        ),
        quotes: snapshot.quotes.filter((item) => !dealIds.has(item.dealId)),
        tasks: snapshot.tasks.filter(
          (item) =>
            item.clientId !== clientId &&
            !(item.dealId && dealIds.has(item.dealId)),
        ),
        statusEvents: snapshot.statusEvents.filter(
          (item) =>
            !(item.entityType === "client" && item.entityId === clientId) &&
            !(item.entityType === "deal" && dealIds.has(item.entityId)),
        ),
      },
      `Клиент удалён: ${client.companyName}`,
    );
    setPendingClientDeletion(null);
    setDrawer(null);
  };

  const updateDealWorkflow = (updatedDeal: Deal, dealQuotes: Quote[]) => {
    if (!snapshot) return;
    const quoteIds = new Set(dealQuotes.map((quote) => quote.id));
    commit(
      {
        ...snapshot,
        deals: snapshot.deals.map((deal) =>
          deal.id === updatedDeal.id ? updatedDeal : deal,
        ),
        quotes: [
          ...snapshot.quotes.filter(
            (quote) =>
              quote.dealId !== updatedDeal.id && !quoteIds.has(quote.id),
          ),
          ...dealQuotes,
        ],
      },
      "Процесс сделки обновлён",
    );
  };

  const resetDemo = async () => {
    setLoading(true);
    const next = await crmGateway.reset();
    setSnapshot(next);
    setLoading(false);
    notify("Данные восстановлены");
  };

  const switchDemoUser = (userId: string) => {
    if (!snapshot || snapshot.session.currentUserId === userId) return;
    const nextUser = snapshot.users.find((user) => user.id === userId);
    if (!nextUser) return;
    commit(
      {
        ...snapshot,
        session: {
          ...snapshot.session,
          currentUserId: userId,
          activeTeamId: nextUser.teamId,
        },
      },
      `Открыт кабинет: ${nextUser.fullName}`,
    );
  };

  const activeMeta = MODULES.find((item) => item.id === activeModule)!;
  const viewSnapshot = visibleSnapshot ?? snapshot;
  const moduleHasOwnHeader = [
    "dashboard",
    "calendar",
    "statistics",
    "chat",
  ].includes(activeModule);

  return (
    <div className="crm-app" data-module={activeModule}>
      <aside className="side-nav" aria-label="Разделы CRM">
        <div className="brand-block">
          <span aria-hidden="true" className="brand-mark">
            <CrmIcon className="size-[21px]" name="brand" />
          </span>
          <span className="brand-copy">
            <strong>ГОФРА</strong>
          </span>
        </div>
        <nav className="module-nav">
          {NAV_GROUPS.map((group) => {
            const groupModules = visibleModules.filter((module) =>
              group.modules.includes(module.id),
            );
            if (!groupModules.length) return null;
            return (
              <section className="nav-group" key={group.label}>
                <span className="nav-group-label">{group.label}</span>
                {groupModules.map((module) => (
                  <button
                    className={`${module.id === activeModule ? "is-active" : ""} group/nav`}
                    key={module.id}
                    onClick={() => navigateTo(module.id)}
                    type="button"
                  >
                    <span aria-hidden="true" className="nav-icon">
                      <CrmIcon
                        className="size-[17px] transition-transform duration-200 group-hover/nav:scale-105"
                        name={module.icon}
                      />
                    </span>
                    <span>{module.label}</span>
                  </button>
                ))}
              </section>
            );
          })}
        </nav>
        {snapshot && currentUser && (
          <div className="side-nav-footer">
            <AccountSwitcher
              currentUser={currentUser}
              onChange={switchDemoUser}
              users={snapshot.users}
              variant="nav"
            />
          </div>
        )}
      </aside>

      <main className="workspace">
        <header
          className={`workspace-header ${
            moduleHasOwnHeader ? "is-feature-module" : ""
          }`}
        >
          <div className="workspace-title">
            <p>{activeMeta.eyebrow}</p>
            <h1>{activeMeta.label}</h1>
          </div>
          <div className="global-search">
            <label htmlFor="global-crm-search">Поиск по CRM</label>
            <input
              aria-label="Поиск по всей CRM"
              id="global-crm-search"
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Компания, ИНН, контакт, телефон"
              type="search"
              value={globalSearch}
            />
            {globalSearch.trim().length >= 2 && (
              <div
                aria-label="Результаты поиска"
                className="global-search-results"
                role="region"
              >
                {globalSearchResults.length ? (
                  globalSearchResults.map((result) => (
                    <button
                      key={`${result.kind}-${result.id}`}
                      onClick={() => openGlobalSearchResult(result)}
                      type="button"
                    >
                      <span aria-hidden="true">
                        <CrmIcon
                          className="size-[16px]"
                          name={
                            result.kind === "client"
                              ? "clients"
                              : result.kind === "deal"
                                ? "deals"
                                : "user"
                          }
                        />
                      </span>
                      <strong>{result.title}</strong>
                      <small>{result.meta}</small>
                    </button>
                  ))
                ) : (
                  <p>Совпадений не найдено</p>
                )}
              </div>
            )}
          </div>
          <div className="header-actions">
            {snapshot && currentUser && (
              <AccountSwitcher
                currentUser={currentUser}
                onChange={switchDemoUser}
                users={snapshot.users}
                variant="header"
              />
            )}
            <ThemeSwitch compact />
            <button className="ghost-button" onClick={resetDemo} type="button">
              Сбросить данные
            </button>
          </div>
        </header>

        {(["clients", "deals", "contacts"] as AppModule[]).includes(
          activeModule,
        ) && (
          <nav aria-label="Разделы CRM" className="mobile-crm-tabs">
            {MODULES.filter((module) =>
              ["clients", "deals", "contacts"].includes(module.id),
            ).map((module) => (
              <button
                className={module.id === activeModule ? "is-active" : ""}
                key={module.id}
                onClick={() => navigateTo(module.id)}
                type="button"
              >
                <span aria-hidden="true">
                  <CrmIcon className="size-[15px]" name={module.icon} />
                </span>
                {module.label}
              </button>
            ))}
          </nav>
        )}

        {loading ? (
          <WorkspaceSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : viewSnapshot && currentUser ? (
          <>
            {activeModule === "dashboard" && (
              <DashboardView
                currentUser={currentUser}
                loading={loading}
                onOpenClient={(id) => setDrawer({ kind: "client", id })}
                onOpenDeal={(id) => setDrawer({ kind: "deal", id })}
                onSnapshotChange={commit}
                snapshot={snapshot}
              />
            )}
            {activeModule === "clients" && (
              <ClientsView
                clients={viewSnapshot.clients}
                globalSearch={globalSearch}
                onAdvance={(client) => {
                  const status = nextClientStatus(client.status);
                  if (status) moveClient(client.id, status);
                }}
                onCreate={() => openCreate("client")}
                onOpen={(client) =>
                  setDrawer({ kind: "client", id: client.id })
                }
                onRequestMove={requestClientMove}
              />
            )}
            {activeModule === "deals" && (
              <DealsView
                clients={viewSnapshot.clients}
                deals={viewSnapshot.deals}
                globalSearch={globalSearch}
                showFinancials={canViewFinancials(currentUser)}
                onAdvance={(deal) => {
                  const status = nextDealStatus(deal.status);
                  if (status) moveDeal(deal.id, status);
                }}
                onCreate={() => openCreate("deal")}
                onOpen={(deal) => setDrawer({ kind: "deal", id: deal.id })}
                onRequestMove={requestDealMove}
              />
            )}
            {activeModule === "contacts" && (
              <ContactsView
                clients={viewSnapshot.clients}
                contacts={viewSnapshot.contacts}
                globalSearch={globalSearch}
                onCreate={() => openCreate("contact")}
                onLog={(contact) =>
                  openCreate("interaction", contact.clientId)
                }
                onOpenClient={(clientId) =>
                  setDrawer({ kind: "client", id: clientId })
                }
                onOpenContact={openContactCard}
              />
            )}
            {activeModule === "activity" && (
              <ActivityView
                clients={viewSnapshot.clients}
                globalSearch={globalSearch}
                interactions={viewSnapshot.interactions}
                onCreate={() => openCreate("interaction")}
                onOpenClient={(clientId) =>
                  setDrawer({ kind: "client", id: clientId })
                }
              />
            )}
            {activeModule === "calendar" && (
              <CalendarView
                currentUser={currentUser}
                loading={loading}
                onOpenClient={(id) => setDrawer({ kind: "client", id })}
                onOpenDeal={(id) => setDrawer({ kind: "deal", id })}
                onSnapshotChange={commit}
                snapshot={snapshot}
              />
            )}
            {activeModule === "statistics" && (
              <StatisticsView
                currentUser={currentUser}
                loading={loading}
                onOpenClient={(id) => setDrawer({ kind: "client", id })}
                onOpenDeal={(id) => setDrawer({ kind: "deal", id })}
                onSnapshotChange={commit}
                snapshot={snapshot}
              />
            )}
            {activeModule === "chat" && (
              <ChatView
                currentUser={currentUser}
                onOpenClient={(id) => setDrawer({ kind: "client", id })}
                snapshot={viewSnapshot}
              />
            )}
            {activeModule === "import" && (
              <ImportView
                onCommit={(status) => {
                  if (!snapshot) return;
                  const importBatch = Date.now().toString(36);
                  const importedAt = new Date().toISOString();
                  const importClients: Client[] = [
                    "Медовый край",
                    "Речной терминал",
                    "Формула заботы",
                  ].map((companyName, index) => ({
                    ...snapshot.clients[index],
                    id: `КЛ-IM-${importBatch}-${index + 1}`,
                    companyName,
                    status,
                    inn: `${7812007000 + index * 93}`,
                    createdAt: importedAt,
                    updatedAt: importedAt,
                  }));
                  commit(
                    {
                      ...snapshot,
                      clients: [...importClients, ...snapshot.clients],
                    },
                    "Три лида добавлены",
                  );
                }}
              />
            )}
            {activeModule === "dictionaries" && (
              <DictionariesView snapshot={viewSnapshot} />
            )}
          </>
        ) : null}
      </main>

      <nav aria-label="Основная навигация" className="mobile-nav">
        <button
          className={activeModule === "dashboard" ? "is-active" : ""}
          onClick={() => navigateTo("dashboard")}
          type="button"
        >
          <span aria-hidden="true">
            <CrmIcon className="size-[17px]" name="home" />
          </span>
          Главная
        </button>
        <button
          className={
            ["clients", "deals", "contacts"].includes(activeModule)
              ? "is-active"
              : ""
          }
          onClick={() => navigateTo("clients")}
          type="button"
        >
          <span aria-hidden="true">
            <CrmIcon className="size-[17px]" name="clients" />
          </span>
          Клиенты
        </button>
        <button
          className={activeModule === "calendar" ? "is-active" : ""}
          onClick={() => navigateTo("calendar")}
          type="button"
        >
          <span aria-hidden="true">
            <CrmIcon className="size-[17px]" name="calendar" />
          </span>
          Календарь
        </button>
        <button
          className={activeModule === "chat" ? "is-active" : ""}
          onClick={() => navigateTo("chat")}
          type="button"
        >
          <span aria-hidden="true">
            <CrmIcon className="size-[17px]" name="chat" />
          </span>
          Чат
        </button>
        <button
          aria-expanded={mobileMoreOpen}
          className={
            ["activity", "statistics", "import", "dictionaries"].includes(
              activeModule,
            ) || mobileMoreOpen
              ? "is-active"
              : ""
          }
          onClick={() => setMobileMoreOpen((open) => !open)}
          type="button"
        >
          <span aria-hidden="true">
            <CrmIcon className="size-[17px]" name="more" />
          </span>
          Ещё
        </button>
      </nav>

      {mobileMoreOpen && (
        <div
          className="mobile-more-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileMoreOpen(false);
          }}
          role="presentation"
        >
          <section
            aria-label="Дополнительные разделы"
            aria-modal="true"
            className="mobile-more-sheet"
            role="dialog"
          >
            <header>
              <div>
                <span className="section-kicker">Навигация</span>
                <h2>Ещё</h2>
              </div>
              <button
                aria-label="Закрыть меню"
                className="ghost-button"
                onClick={() => setMobileMoreOpen(false)}
                type="button"
              >
                Закрыть
              </button>
            </header>
            <div className="mobile-more-links">
              {visibleModules
                .filter((module) =>
                  ["activity", "statistics", "import", "dictionaries"].includes(
                    module.id,
                  ),
                )
                .map((module) => (
                  <button
                    className={module.id === activeModule ? "is-active" : ""}
                    key={module.id}
                    onClick={() => navigateTo(module.id)}
                    type="button"
                  >
                    <span aria-hidden="true">
                      <CrmIcon className="size-[18px]" name={module.icon} />
                    </span>
                    <strong>{module.label}</strong>
                    <small>{module.eyebrow}</small>
                  </button>
                ))}
            </div>
            {snapshot && currentUser && (
              <div className="mobile-account-settings">
                <div className="mobile-account-block">
                  <span>Аккаунт</span>
                  <AccountSwitcher
                    currentUser={currentUser}
                    onChange={switchDemoUser}
                    users={snapshot.users}
                    variant="mobile"
                  />
                </div>
                <div>
                  <span>Оформление</span>
                  <ThemeSwitch />
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {drawer && viewSnapshot && (
        <RecordDrawer
          currentUser={currentUser}
          drawer={drawer}
          snapshot={viewSnapshot}
          onAddContact={(clientId) => openCreate("contact", clientId)}
          onAddInteraction={(clientId, dealId) =>
            openCreate("interaction", clientId, dealId)
          }
          onClose={() => setDrawer(null)}
          onDeleteClient={setPendingClientDeletion}
          onMoveClient={requestClientMove}
          onMoveDeal={requestDealMove}
          onReviewApproval={reviewPriceApproval}
          onUpdateRepeatOrder={updateClientRepeatOrder}
          onUpdateDealWorkflow={updateDealWorkflow}
          showFinancials={
            currentUser ? canViewFinancials(currentUser) : false
          }
        />
      )}

      {pendingClientDeletion && viewSnapshot && (
        <DeleteClientDialog
          client={pendingClientDeletion}
          onClose={() => setPendingClientDeletion(null)}
          onConfirm={() => deleteClient(pendingClientDeletion.id)}
          snapshot={viewSnapshot}
        />
      )}

      {moveIntent && (
        <StatusPicker
          intent={moveIntent}
          onChoose={(status) => {
            if (moveIntent.kind === "client") {
              moveClient(moveIntent.id, status as ClientStatus);
            } else {
              const nextStatus = status as DealStatus;
              if (nextStatus === "Проиграна" || nextStatus === "Отменена") {
                setPendingLoss({ dealId: moveIntent.id, status: nextStatus });
                setMoveIntent(null);
              } else {
                moveDeal(moveIntent.id, nextStatus);
              }
            }
          }}
          onClose={() => setMoveIntent(null)}
        />
      )}

      {pendingLoss && (
        <LossReasonDialog
          onClose={() => setPendingLoss(null)}
          onSubmit={(reason) => {
            moveDeal(pendingLoss.dealId, pendingLoss.status, reason);
            setPendingLoss(null);
          }}
          status={pendingLoss.status}
        />
      )}

      {createKind && viewSnapshot && currentUser && (
        <CreateDialog
          clientId={createClientId}
          contact={editingContact}
          currentUser={currentUser}
          dealId={createDealId}
          kind={createKind}
          onClose={() => {
            setCreateKind(null);
            setCreateClientId(null);
            setCreateDealId(null);
            setEditingContact(null);
          }}
          onSubmit={handleCreate}
          snapshot={viewSnapshot}
        />
      )}

      <div aria-live="polite" className={`toast ${toast ? "is-visible" : ""}`}>
        {toast}
      </div>
    </div>
  );
}

type BoardItem = { id: string; status: string | null };

function PipelineBoard<T extends BoardItem>({
  groups,
  items,
  showClosed,
  renderCard,
  onGroupDrop,
}: {
  groups: readonly PipelineGroup[];
  items: T[];
  showClosed: boolean;
  renderCard: (item: T) => ReactNode;
  onGroupDrop: (item: T, statuses: readonly string[]) => void;
}) {
  const visibleGroups = groups.filter((group) => showClosed || !group.closed);
  const [mobileGroup, setMobileGroup] = useState(visibleGroups[0]?.id ?? "");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const itemsForGroup = (group: PipelineGroup) =>
    items.filter((item) =>
      group.statuses.includes(item.status ?? "Без статуса"),
    );

  const handleDrop = (
    event: DragEvent<HTMLElement>,
    group: PipelineGroup,
  ) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/crm-record");
    const item = items.find((candidate) => candidate.id === id);
    setDraggingId(null);
    if (item) onGroupDrop(item, group.statuses);
  };

  return (
    <>
      <div className="mobile-stage-tabs" aria-label="Этапы воронки">
        {visibleGroups.map((group) => (
          <button
            className={mobileGroup === group.id ? "is-active" : ""}
            key={group.id}
            onClick={() => setMobileGroup(group.id)}
            type="button"
          >
            {group.label}
            <span>{itemsForGroup(group).length}</span>
          </button>
        ))}
      </div>
      <div className="kanban-board">
        {visibleGroups.map((group) => {
          const groupItems = itemsForGroup(group);
          return (
            <section
              className={`kanban-column ${
                mobileGroup === group.id ? "is-mobile-active" : ""
              } ${draggingId ? "is-dragging" : ""}`}
              key={group.id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => handleDrop(event, group)}
            >
              <header className="column-header">
                <div>
                  <h3>{group.label}</h3>
                  <span>{groupItems.length}</span>
                </div>
                <div className="substatus-list">
                  {group.statuses.map((status) => (
                    <span key={status}>{status}</span>
                  ))}
                </div>
              </header>
              <div className="column-stack">
                {groupItems.length ? (
                  groupItems.map((item) => (
                    <div
                      draggable
                      key={item.id}
                      onDragEnd={() => setDraggingId(null)}
                      onDragStart={(event) => {
                        setDraggingId(item.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/crm-record",
                          item.id,
                        );
                      }}
                    >
                      {renderCard(item)}
                    </div>
                  ))
                ) : (
                  <div className="column-empty">
                    <strong>Пока пусто</strong>
                    <span>Перетащите карточку или измените её статус.</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function ClientsView({
  clients,
  globalSearch,
  onAdvance,
  onCreate,
  onOpen,
  onRequestMove,
}: {
  clients: Client[];
  globalSearch: string;
  onAdvance: (client: Client) => void;
  onCreate: () => void;
  onOpen: (client: Client) => void;
  onRequestMove: (client: Client, statuses?: readonly string[]) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [potential, setPotential] = useState("all");
  const [status, setStatus] = useState("all");
  const [showClosed, setShowClosed] = useState(false);
  const [repeatSegment, setRepeatSegment] = useState<RepeatSegment>("all");

  const filtered = useMemo(
    () =>
      clients.filter(
        (client) =>
          searchIncludes(globalSearch, [
            client.companyName,
            client.inn,
            client.city,
            client.region,
            client.industry,
          ]) &&
          (potential === "all" || client.potential === potential) &&
          matchesRepeatSegment(client, repeatSegment) &&
          (status === "all" ||
            (status === "unassigned"
              ? client.status === null
              : client.status === status)),
      ),
    [clients, globalSearch, potential, repeatSegment, status],
  );

  const potentialA = clients.filter((client) => client.potential === "A").length;
  const needsAction = clients.filter((client) => {
    if (!client.nextActionAt) return false;
    return new Date(client.nextActionAt) <= new Date();
  }).length;

  return (
    <section className="module-view">
      <div className="metric-strip">
        <Metric label="Всего клиентов" value={clients.length} />
        <Metric label="Потенциал A" value={potentialA} />
        <Metric label="Действия сегодня" value={needsAction} tone="attention" />
        <Metric label="Статусы доступны" value={CLIENT_STATUSES.length} />
      </div>
      <div className="repeat-segments" aria-label="Сегменты повторных продаж">
        {(
          [
            ["all", "Все клиенты"],
            ["30", "Активные · 30–59 дней"],
            ["60", "Активные · 60–89 дней"],
            ["90", "Активные · 90–119 дней"],
            ["sleeping", "Спящие для возврата"],
            ["no_data", "Нет данных об отгрузке"],
          ] as const
        ).map(([value, label]) => {
          const count = clients.filter((client) =>
            matchesRepeatSegment(client, value),
          ).length;
          return (
            <button
              aria-pressed={repeatSegment === value}
              className={repeatSegment === value ? "is-active" : ""}
              key={value}
              onClick={() => setRepeatSegment(value)}
              type="button"
            >
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>
      <div className="view-toolbar">
        <div className="filter-cluster">
          <label>
            Потенциал
            <select
              onChange={(event) => setPotential(event.target.value)}
              value={potential}
            >
              <option value="all">Все</option>
              {["A", "B", "C", "D"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Точный статус
            <select
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="all">Все статусы</option>
              <option value="unassigned">Без статуса</option>
              {CLIENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="check-filter">
            <input
              checked={showClosed}
              onChange={(event) => setShowClosed(event.target.checked)}
              type="checkbox"
            />
            Показать закрытые
          </label>
          <span className="result-count">Найдено: {filtered.length}</span>
        </div>
        <div className="toolbar-actions">
          <ViewSwitch onChange={setViewMode} value={viewMode} />
          <button className="primary-button" onClick={onCreate} type="button">
            Добавить клиента
          </button>
        </div>
      </div>

      {viewMode === "board" ? (
        <PipelineBoard
          groups={CLIENT_PIPELINE}
          items={filtered}
          onGroupDrop={(client, statuses) =>
            onRequestMove(client, statuses)
          }
          renderCard={(client) => (
            <ClientCard
              client={client}
              onAdvance={() => onAdvance(client)}
              onOpen={() => onOpen(client)}
              onStatus={() => onRequestMove(client)}
            />
          )}
          showClosed={showClosed}
        />
      ) : (
        <ClientTable
          clients={filtered}
          onOpen={onOpen}
          onStatus={onRequestMove}
        />
      )}
    </section>
  );
}

function ClientCard({
  client,
  onAdvance,
  onOpen,
  onStatus,
}: {
  client: Client;
  onAdvance: () => void;
  onOpen: () => void;
  onStatus: () => void;
}) {
  const due = getDueState(client.nextActionAt);
  const canAdvance = Boolean(nextClientStatus(client.status));
  return (
    <article className="record-card client-card">
      <button className="card-open" onClick={onOpen} type="button">
        <div className="card-heading">
          <div>
            <span className="record-id">{client.id}</span>
            <h4>{client.companyName}</h4>
          </div>
          <span className={`potential potential-${client.potential}`}>
            {client.potential}
          </span>
        </div>
        <span className="exact-status">{client.status ?? "Без статуса"}</span>
        <dl className="card-facts">
          <div>
            <dt>Регион</dt>
            <dd>
              {client.city}, {client.region}
            </dd>
          </div>
          <div>
            <dt>Отрасль</dt>
            <dd>{client.industry}</dd>
          </div>
        </dl>
        <div className="next-action">
          <span className={due.className}>{due.label}</span>
          <strong>{client.nextAction || "Добавить следующий шаг"}</strong>
        </div>
      </button>
      <footer className="card-footer">
        <span aria-hidden="true" className="manager-chip">
          <CrmIcon className="size-[13px]" name="user" />
        </span>
        <span>{client.managerName}</span>
        <div>
          <button onClick={onStatus} type="button">
            Статус
          </button>
          {canAdvance && (
            <button onClick={onAdvance} type="button">
              Продвинуть
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

function HorizontalScrollShell({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const body = bodyScrollRef.current;
    if (!body) return;

    const sync = () => {
      if (spacerRef.current) {
        spacerRef.current.style.width = `${body.scrollWidth}px`;
      }
      setHasOverflow(body.scrollWidth > body.clientWidth + 1);
    };
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(body);
    return () => observer.disconnect();
  });

  const syncScroll = (
    source: HTMLDivElement,
    target: HTMLDivElement | null,
  ) => {
    if (syncingRef.current) {
      syncingRef.current = false;
      return;
    }
    if (!target) return;
    syncingRef.current = true;
    target.scrollLeft = source.scrollLeft;
  };

  return (
    <div className="hscroll-shell">
      <div
        aria-hidden="true"
        className="hscroll-topbar"
        hidden={!hasOverflow}
        onScroll={(event) =>
          syncScroll(event.currentTarget, bodyScrollRef.current)
        }
        ref={topScrollRef}
      >
        <div className="hscroll-topbar-spacer" ref={spacerRef} />
      </div>
      <div
        className={`${className} hscroll-body`}
        onScroll={(event) =>
          syncScroll(event.currentTarget, topScrollRef.current)
        }
        ref={bodyScrollRef}
      >
        {children}
      </div>
    </div>
  );
}

function ClientTable({
  clients,
  onOpen,
  onStatus,
}: {
  clients: Client[];
  onOpen: (client: Client) => void;
  onStatus: (client: Client) => void;
}) {
  return (
    <>
      <HorizontalScrollShell className="table-shell clients-desktop-table">
      <table>
        <thead>
          <tr>
            <th>Клиент</th>
            <th>ИНН</th>
            <th>Город</th>
            <th>Потенциал</th>
            <th>Точный статус</th>
            <th>Последняя отгрузка</th>
            <th>Следующий заказ</th>
            <th>Объём / мес.</th>
            <th>Следующее действие</th>
            <th>Менеджер</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>
                <button
                  aria-label={`Открыть клиента ${client.companyName}`}
                  className="table-link"
                  onClick={() => onOpen(client)}
                  type="button"
                >
                  <strong>{client.companyName}</strong>
                  <small>{client.id}</small>
                </button>
              </td>
              <td className="mono">{client.inn}</td>
              <td>{client.city}</td>
              <td>
                <span className={`potential potential-${client.potential}`}>
                  {client.potential}
                </span>
              </td>
              <td>
                <span className="exact-status">
                  {client.status ?? "Без статуса"}
                </span>
              </td>
              <td>
                <strong>{formatDate(client.lastShipmentAt)}</strong>
                <small>
                  {getDaysWithoutOrder(client) === null
                    ? "Нет истории"
                    : `${getDaysWithoutOrder(client)} дн. без заказа`}
                </small>
              </td>
              <td>
                <strong>{formatDate(client.expectedNextOrderAt)}</strong>
                <small>Напомнить за {client.repeatReminderDays} дней</small>
              </td>
              <td className="mono">
                {client.averageMonthlyVolume.toLocaleString("ru-RU")} шт.
              </td>
              <td>
                <strong>{client.nextAction || "Не назначено"}</strong>
                <small>{formatDate(client.nextActionAt)}</small>
              </td>
              <td>{client.managerName}</td>
              <td>
                <button
                  className="text-button"
                  onClick={() => onStatus(client)}
                  type="button"
                >
                  Изменить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!clients.length && <TableEmpty />}
      </HorizontalScrollShell>
      <div className="mobile-client-list" aria-label="Клиенты">
        {clients.map((client) => (
          <article className="mobile-client-card" key={client.id}>
            <header>
              <button
                aria-label={`Открыть клиента ${client.companyName}`}
                className="table-link"
                onClick={() => onOpen(client)}
                type="button"
              >
                <strong>{client.companyName}</strong>
                <small>
                  {client.id} · {client.city}
                </small>
              </button>
              <span className={`potential potential-${client.potential}`}>
                {client.potential}
              </span>
            </header>
            <div className="mobile-client-status">
              <span className="exact-status">
                {client.status ?? "Без статуса"}
              </span>
              <span>{client.managerName}</span>
            </div>
            <dl>
              <div>
                <dt>Последняя отгрузка</dt>
                <dd>{formatDate(client.lastShipmentAt)}</dd>
              </div>
              <div>
                <dt>Следующий заказ</dt>
                <dd>{formatDate(client.expectedNextOrderAt)}</dd>
              </div>
              <div>
                <dt>Объём / мес.</dt>
                <dd>
                  {client.averageMonthlyVolume.toLocaleString("ru-RU")} шт.
                </dd>
              </div>
              <div>
                <dt>Следующий шаг</dt>
                <dd>{client.nextAction || "Не назначено"}</dd>
              </div>
            </dl>
            <footer>
              <span>{formatDate(client.nextActionAt)}</span>
              <button
                className="text-button"
                onClick={() => onStatus(client)}
                type="button"
              >
                Изменить статус
              </button>
            </footer>
          </article>
        ))}
        {!clients.length && <TableEmpty />}
      </div>
    </>
  );
}

function DealsView({
  clients,
  deals,
  globalSearch,
  showFinancials,
  onAdvance,
  onCreate,
  onOpen,
  onRequestMove,
}: {
  clients: Client[];
  deals: Deal[];
  globalSearch: string;
  showFinancials: boolean;
  onAdvance: (deal: Deal) => void;
  onCreate: () => void;
  onOpen: (deal: Deal) => void;
  onRequestMove: (deal: Deal, statuses?: readonly string[]) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [status, setStatus] = useState("all");
  const [showClosed, setShowClosed] = useState(false);
  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const filtered = useMemo(
    () =>
      deals.filter((deal) => {
        const client = clientMap.get(deal.clientId);
        return (
          searchIncludes(globalSearch, [
            deal.title,
            deal.product,
            client?.companyName ?? "",
            deal.managerName,
          ]) &&
          (status === "all" || deal.status === status)
        );
      }),
    [clientMap, deals, globalSearch, status],
  );

  const pipeline = deals
    .filter(isOpenDeal)
    .reduce((sum, deal) => sum + deal.ourPrice, 0);
  const margin = deals.reduce((sum, deal) => sum + deal.margin, 0);

  return (
    <section className="module-view">
      <div className="metric-strip">
        <Metric label="Сделки" value={deals.length} />
        <Metric label="В работе" value={formatMoney(pipeline)} />
        <Metric
          label={showFinancials ? "Плановая маржа" : "Следующие шаги"}
          value={
            showFinancials
              ? formatMoney(margin)
              : deals.filter((deal) => deal.nextAction.trim()).length
          }
          tone={showFinancials ? "good" : "neutral"}
        />
        <Metric label="Статусы доступны" value={DEAL_STATUSES.length} />
      </div>
      <div className="view-toolbar">
        <div className="filter-cluster">
          <label>
            Точный статус
            <select
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="all">Все статусы</option>
              {DEAL_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="check-filter">
            <input
              checked={showClosed}
              onChange={(event) => setShowClosed(event.target.checked)}
              type="checkbox"
            />
            Показать закрытые
          </label>
          <span className="result-count">Найдено: {filtered.length}</span>
        </div>
        <div className="toolbar-actions">
          <ViewSwitch onChange={setViewMode} value={viewMode} />
          <button className="primary-button" onClick={onCreate} type="button">
            Добавить сделку
          </button>
        </div>
      </div>

      {viewMode === "board" ? (
        <PipelineBoard
          groups={DEAL_PIPELINE}
          items={filtered}
          onGroupDrop={(deal, statuses) => onRequestMove(deal, statuses)}
          renderCard={(deal) => (
            <DealCard
              clientName={
                clientMap.get(deal.clientId)?.companyName ?? "Клиент не найден"
              }
              deal={deal}
              showFinancials={showFinancials}
              onAdvance={() => onAdvance(deal)}
              onOpen={() => onOpen(deal)}
              onStatus={() => onRequestMove(deal)}
            />
          )}
          showClosed={showClosed}
        />
      ) : (
        <DealTable
          clientMap={clientMap}
          deals={filtered}
          showFinancials={showFinancials}
          onOpen={onOpen}
          onStatus={onRequestMove}
        />
      )}
    </section>
  );
}

function DealCard({
  deal,
  clientName,
  showFinancials,
  onAdvance,
  onOpen,
  onStatus,
}: {
  deal: Deal;
  clientName: string;
  showFinancials: boolean;
  onAdvance: () => void;
  onOpen: () => void;
  onStatus: () => void;
}) {
  const due = deal.needsNextAction
    ? { className: "due-overdue", label: "Требует действия" }
    : getDueState(deal.nextActionAt);
  return (
    <article className="record-card deal-card">
      <button className="card-open" onClick={onOpen} type="button">
        <span className="record-id">{deal.id}</span>
        <h4>{deal.title}</h4>
        <p className="company-line">{clientName}</p>
        <span className="exact-status">{deal.status}</span>
        <dl className={`deal-numbers ${showFinancials ? "" : "is-single"}`}>
          <div>
            <dt>Выручка</dt>
            <dd>{formatMoney(deal.ourPrice)}</dd>
          </div>
          {showFinancials && (
            <div>
              <dt>Маржа</dt>
              <dd className="positive">
                {formatMoney(deal.margin)} · {deal.marginPercent}%
              </dd>
            </div>
          )}
        </dl>
        <div className="next-action">
          <span className={due.className}>{due.label}</span>
          <strong>{deal.nextAction || "Добавить следующий шаг"}</strong>
        </div>
      </button>
      <footer className="card-footer">
        <span aria-hidden="true" className="manager-chip">
          <CrmIcon className="size-[13px]" name="user" />
        </span>
        <span>{deal.managerName}</span>
        <div>
          <button onClick={onStatus} type="button">
            Статус
          </button>
          {nextDealStatus(deal.status) && (
            <button onClick={onAdvance} type="button">
              Продвинуть
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

function DealTable({
  deals,
  clientMap,
  showFinancials,
  onOpen,
  onStatus,
}: {
  deals: Deal[];
  clientMap: Map<string, Client>;
  showFinancials: boolean;
  onOpen: (deal: Deal) => void;
  onStatus: (deal: Deal) => void;
}) {
  return (
    <HorizontalScrollShell className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Сделка</th>
            <th>Клиент</th>
            <th>Товар / объём</th>
            <th>Выручка</th>
            {showFinancials && <th>Маржа</th>}
            <th>Точный статус</th>
            <th>Следующий шаг</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id}>
              <td>
                <button
                  className="table-link"
                  onClick={() => onOpen(deal)}
                  type="button"
                >
                  <strong>{deal.title}</strong>
                  <small>{deal.id}</small>
                </button>
              </td>
              <td>{clientMap.get(deal.clientId)?.companyName}</td>
              <td>
                <strong>{deal.product}</strong>
                <small>{deal.volume}</small>
              </td>
              <td className="mono">{formatMoney(deal.ourPrice)}</td>
              {showFinancials && (
                <td className="positive">
                  {formatMoney(deal.margin)} · {deal.marginPercent}%
                </td>
              )}
              <td>
                <span className="exact-status">{deal.status}</span>
              </td>
              <td>
                <strong>{deal.nextAction}</strong>
                <small>{formatDate(deal.nextActionAt)}</small>
              </td>
              <td>
                <button
                  className="text-button"
                  onClick={() => onStatus(deal)}
                  type="button"
                >
                  Изменить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!deals.length && <TableEmpty />}
    </HorizontalScrollShell>
  );
}

function ContactsView({
  clients,
  contacts,
  globalSearch,
  onCreate,
  onLog,
  onOpenClient,
  onOpenContact,
}: {
  clients: Client[];
  contacts: Contact[];
  globalSearch: string;
  onCreate: () => void;
  onLog: (contact: Contact) => void;
  onOpenClient: (id: string) => void;
  onOpenContact: (contact: Contact) => void;
}) {
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const filtered = contacts.filter((contact) =>
    searchIncludes(globalSearch, [
      contact.fullName,
      contact.role,
      contact.phone,
      contact.email,
      clientMap.get(contact.clientId)?.companyName ?? "",
    ]),
  );

  return (
    <section className="module-view">
      <div className="section-heading">
        <div>
          <h2>Лица, принимающие решения</h2>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          Добавить контакт
        </button>
      </div>
      <div className="table-shell contacts-table">
        <table>
          <thead>
            <tr>
              <th>Контакт</th>
              <th>Компания</th>
              <th>Должность</th>
              <th>Роль в решении</th>
              <th>Влияние</th>
              <th>Канал</th>
              <th>Познакомиться</th>
              <th>Телефон</th>
              <th>Email</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <button
                    className="table-link"
                    onClick={() => onOpenContact(contact)}
                    type="button"
                  >
                    <strong>{contact.fullName}</strong>
                  </button>
                  <small>{contact.id}</small>
                </td>
                <td>
                  <button
                    className="table-link"
                    onClick={() => onOpenClient(contact.clientId)}
                    type="button"
                  >
                    {clientMap.get(contact.clientId)?.companyName}
                  </button>
                </td>
                <td>{contact.role}</td>
                <td>{contact.decisionRole}</td>
                <td>
                  <span
                    className={`influence influence-${contact.decisionInfluence === "Блокирует" ? "blocker" : contact.decisionInfluence === "Принимает решение" ? "decision" : "influencer"}`}
                  >
                    {contact.decisionInfluence}
                  </span>
                </td>
                <td>{contact.preferredChannel}</td>
                <td>{contact.introductionNeeded || "Карта закрыта"}</td>
                <td className="mono">{contact.phone}</td>
                <td>{contact.email}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => onLog(contact)}
                    type="button"
                  >
                    Записать контакт
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <TableEmpty />}
      </div>
    </section>
  );
}

function ActivityView({
  clients,
  interactions,
  globalSearch,
  onCreate,
  onOpenClient,
}: {
  clients: Client[];
  interactions: Interaction[];
  globalSearch: string;
  onCreate: () => void;
  onOpenClient: (id: string) => void;
}) {
  const [kind, setKind] = useState("all");
  const [mode, setMode] = useState<"feed" | "table">("feed");
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const filtered = interactions
    .filter(
      (interaction) =>
        (kind === "all" || interaction.kind === kind) &&
        searchIncludes(globalSearch, [
          interaction.subject,
          interaction.result,
          interaction.managerName,
          clientMap.get(interaction.clientId)?.companyName ?? "",
        ]),
    )
    .sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    );

  return (
    <section className="module-view">
      <div className="view-toolbar">
        <div className="filter-cluster">
          <label>
            Тип контакта
            <select onChange={(event) => setKind(event.target.value)} value={kind}>
              <option value="all">Все типы</option>
              {[
                "Звонок",
                "Email",
                "WhatsApp",
                "Telegram",
                "Встреча",
                "Повторный звонок",
                "Отправка КП",
                "Получение ТЗ",
                "Другое",
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <span className="result-count">Событий: {filtered.length}</span>
        </div>
        <div className="toolbar-actions">
          <div className="view-switch" aria-label="Вид истории">
            <button
              className={mode === "feed" ? "is-active" : ""}
              onClick={() => setMode("feed")}
              type="button"
            >
              Лента
            </button>
            <button
              className={mode === "table" ? "is-active" : ""}
              onClick={() => setMode("table")}
              type="button"
            >
              Таблица
            </button>
          </div>
          <button className="primary-button" onClick={onCreate} type="button">
            Записать результат контакта
          </button>
        </div>
      </div>

      {mode === "feed" ? (
        <div className="activity-layout">
          <div className="activity-feed">
            {filtered.map((interaction) => (
              <article className="activity-item" key={interaction.id}>
                <div className="activity-rail">
                  <span>{interaction.kind.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="activity-content">
                  <header>
                    <div>
                      <span className="exact-status">{interaction.kind}</span>
                      <h3>{interaction.subject}</h3>
                    </div>
                    <time>{formatDate(interaction.occurredAt, true)}</time>
                  </header>
                  <button
                    className="company-button"
                    onClick={() => onOpenClient(interaction.clientId)}
                    type="button"
                  >
                    {clientMap.get(interaction.clientId)?.companyName}
                  </button>
                  <p>{interaction.result}</p>
                  <div className="activity-next">
                    <span>Следующий шаг</span>
                    <strong>{interaction.nextStep}</strong>
                    <time>{formatDate(interaction.nextStepAt)}</time>
                  </div>
                  {interaction.attachments.length > 0 && (
                    <div className="activity-attachments">
                      <span>Вложения</span>
                      {interaction.attachments.map((attachment) => (
                        <strong key={attachment.id}>{attachment.name}</strong>
                      ))}
                    </div>
                  )}
                  <footer>{interaction.managerName}</footer>
                </div>
              </article>
            ))}
          </div>
          <aside className="activity-summary">
            <span className="section-kicker">Контроль ритма</span>
            <strong>{filtered.length}</strong>
            <p>взаимодействий в выбранном представлении</p>
            <dl>
              <div>
                <dt>Звонки</dt>
                <dd>
                  {filtered.filter((item) => item.kind === "Звонок").length}
                </dd>
              </div>
              <div>
                <dt>Встречи</dt>
                <dd>
                  {filtered.filter((item) => item.kind === "Встреча").length}
                </dd>
              </div>
              <div>
                <dt>Следующие шаги</dt>
                <dd>{filtered.filter((item) => item.nextStepAt).length}</dd>
              </div>
            </dl>
          </aside>
        </div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Компания</th>
                <th>Тип</th>
                <th>Тема</th>
                <th>Итог</th>
                <th>Следующий шаг</th>
                <th>Ответственный</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((interaction) => (
                <tr key={interaction.id}>
                  <td className="mono">
                    {formatDate(interaction.occurredAt, true)}
                  </td>
                  <td>{clientMap.get(interaction.clientId)?.companyName}</td>
                  <td>
                    <span className="exact-status">{interaction.kind}</span>
                  </td>
                  <td>{interaction.subject}</td>
                  <td>{interaction.result}</td>
                  <td>
                    <strong>{interaction.nextStep}</strong>
                    <small>{formatDate(interaction.nextStepAt)}</small>
                  </td>
                  <td>{interaction.managerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ImportView({
  onCommit,
}: {
  onCommit: (status: ClientStatus) => void;
}) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<ClientStatus>("Новый лид");

  const preview = [
    {
      company: "Медовый край",
      inn: "7728041927",
      region: "Москва",
      state: "Готово",
    },
    {
      company: "Речной терминал",
      inn: "7816034512",
      region: "Санкт-Петербург",
      state: "Предупреждение",
    },
    {
      company: "Формула заботы",
      inn: "6671039475",
      region: "Свердловская область",
      state: "Готово",
    },
    {
      company: "Повторная строка",
      inn: "7728041927",
      region: "Москва",
      state: "Дубль",
    },
  ];

  return (
    <section className="module-view import-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Импорт лидов</span>
          <h2>Проверка данных до загрузки</h2>
        </div>
      </div>
      <ol className="import-steps">
        {["Файл", "Сопоставление", "Проверка", "Результат"].map(
          (label, index) => (
            <li
              className={step >= index + 1 ? "is-active" : ""}
              key={label}
            >
              <span>{index + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>

      <div className="import-panel">
        {step === 1 && (
          <div className="drop-zone">
            <span className="drop-mark">CSV</span>
            <h3>{fileName || "Перетащите таблицу с лидами"}</h3>
            <p>До 10 МБ · CSV, TSV или XLSX</p>
            <label className="primary-button file-button">
              Выбрать файл
              <input
                accept=".csv,.tsv,.xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setFileName(file.name);
                }}
                type="file"
              />
            </label>
            <button
              className="text-button"
              onClick={() => setFileName("demo-leads.csv")}
              type="button"
            >
              Загрузить пример
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Сопоставление</span>
                <h3>{fileName}</h3>
              </div>
              <span>20 полей CRM доступно</span>
            </div>
            <div className="mapping-grid">
              {[
                ["Название компании", "Компания"],
                ["ИНН", "ИНН"],
                ["Регион", "Область"],
                ["Город", "Город"],
                ["Отрасль", "Категория"],
                ["Потенциал", "Приоритет"],
              ].map(([field, source]) => (
                <label key={field}>
                  <span>{field}</span>
                  <select defaultValue={source}>
                    <option>{source}</option>
                    <option>Не импортировать</option>
                  </select>
                </label>
              ))}
            </div>
            <label className="wide-field">
              Стартовый статус
              <select
                onChange={(event) =>
                  setStatus(event.target.value as ClientStatus)
                }
                value={status}
              >
                {CLIENT_STATUSES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <small>
                Все 16 клиентских статусов доступны при импорте.
              </small>
            </label>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Проверка</span>
                <h3>4 строки · 2 готовы · 1 предупреждение · 1 дубль</h3>
              </div>
              <button className="text-button" type="button">
                Скачать ошибки
              </button>
            </div>
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Компания</th>
                    <th>ИНН</th>
                    <th>Регион</th>
                    <th>Статус строки</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={`${row.inn}-${row.company}`}>
                      <td>{row.company}</td>
                      <td className="mono">{row.inn}</td>
                      <td>{row.region}</td>
                      <td>
                        <span
                          className={`row-state row-state-${row.state
                            .toLowerCase()
                            .replace(" ", "-")}`}
                        >
                          {row.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="import-success">
            <span>3 / 4</span>
            <h3>Партия готова</h3>
            <p>
              Три лида добавлены со статусом «{status}».
              Дубль пропущен.
            </p>
            <button
              className="ghost-button"
              onClick={() => {
                setStep(1);
                setFileName("");
              }}
              type="button"
            >
              Новый импорт
            </button>
          </div>
        )}

        {step < 4 && (
          <footer className="import-actions">
            <button
              className="ghost-button"
              disabled={step === 1}
              onClick={() => setStep((current) => current - 1)}
              type="button"
            >
              Назад
            </button>
            <button
              className="primary-button"
              disabled={step === 1 && !fileName}
              onClick={() => {
                if (step === 3) {
                  onCommit(status);
                }
                setStep((current) => current + 1);
              }}
              type="button"
            >
              {step === 3 ? "Импортировать 3 строки" : "Продолжить"}
            </button>
          </footer>
        )}
      </div>
    </section>
  );
}

function DictionariesView({ snapshot }: { snapshot: CrmSnapshot }) {
  const initial = useMemo(
    () => ({
      clientStatuses: [...CLIENT_STATUSES],
      dealStatuses: [...DEAL_STATUSES],
      potentials: [...snapshot.dictionaries.potentials],
      industries: [...snapshot.dictionaries.industries],
      productTypes: [...snapshot.dictionaries.productTypes],
      sources: [...snapshot.dictionaries.sources],
      interactionTypes: [...snapshot.dictionaries.interactionTypes],
    }),
    [snapshot],
  );
  const [activeKey, setActiveKey] =
    useState<keyof typeof initial>("clientStatuses");
  const [values, setValues] = useState(initial);
  const [disabledItems, setDisabledItems] = useState<string[]>([]);

  const tabs: Array<[keyof typeof initial, string]> = [
    ["clientStatuses", "Статусы клиентов"],
    ["dealStatuses", "Статусы сделок"],
    ["potentials", "Потенциал"],
    ["industries", "Отрасли"],
    ["productTypes", "Типы товара"],
    ["sources", "Источники"],
    ["interactionTypes", "Типы контактов"],
  ];
  const current = values[activeKey];

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    setValues((state) => ({ ...state, [activeKey]: next }));
  };

  return (
    <section className="module-view dictionaries-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Справочники</span>
          <h2>Значения форм и воронок</h2>
        </div>
        <button
          className="ghost-button"
          onClick={() => {
            setValues(initial);
            setDisabledItems([]);
          }}
          type="button"
        >
          Восстановить значения
        </button>
      </div>
      <div className="dictionary-shell">
        <nav className="dictionary-tabs" aria-label="Типы справочников">
          {tabs.map(([key, label]) => (
            <button
              className={key === activeKey ? "is-active" : ""}
              key={key}
              onClick={() => setActiveKey(key)}
              type="button"
            >
              <span>{label}</span>
              <small>{values[key].length}</small>
            </button>
          ))}
        </nav>
        <div className="dictionary-list">
          <header>
            <div>
              <span className="section-kicker">Активный справочник</span>
              <h3>{tabs.find(([key]) => key === activeKey)?.[1]}</h3>
            </div>
            <span>{current.length} значений</span>
          </header>
          <ol>
            {current.map((value, index) => {
              const disabled = disabledItems.includes(value);
              return (
                <li className={disabled ? "is-disabled" : ""} key={value}>
                  <span className="dictionary-order">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{value}</strong>
                  <span className="dictionary-state">
                    {disabled ? "Выключено" : "Активно"}
                  </span>
                  <div>
                    <button
                      aria-label={`Поднять ${value}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      type="button"
                    >
                      Выше
                    </button>
                    <button
                      aria-label={`Опустить ${value}`}
                      disabled={index === current.length - 1}
                      onClick={() => move(index, 1)}
                      type="button"
                    >
                      Ниже
                    </button>
                    <button
                      onClick={() =>
                        setDisabledItems((items) =>
                          items.includes(value)
                            ? items.filter((item) => item !== value)
                            : [...items, value],
                        )
                      }
                      type="button"
                    >
                      {disabled ? "Включить" : "Выключить"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function RecordDrawer({
  currentUser,
  drawer,
  snapshot,
  onClose,
  onDeleteClient,
  onMoveClient,
  onMoveDeal,
  onAddContact,
  onAddInteraction,
  onReviewApproval,
  onUpdateRepeatOrder,
  onUpdateDealWorkflow,
  showFinancials,
}: {
  currentUser: User | null;
  drawer: Exclude<DrawerTarget, null>;
  snapshot: CrmSnapshot;
  onClose: () => void;
  onDeleteClient: (client: Client) => void;
  onMoveClient: (client: Client) => void;
  onMoveDeal: (deal: Deal) => void;
  onAddContact: (clientId: string) => void;
  onAddInteraction: (clientId: string, dealId?: string) => void;
  onReviewApproval: (
    approvalId: string,
    status: PriceApprovalStatus,
  ) => void;
  onUpdateRepeatOrder: (
    clientId: string,
    values: {
      orderFrequencyDays: number | null;
      lastShipmentAt: string | null;
      expectedNextOrderAt: string | null;
      averageMonthlyVolume: number;
      repeatReminderDays: 7 | 14;
      expectedNextOrderManual: boolean;
    },
  ) => void;
  onUpdateDealWorkflow: (deal: Deal, quotes: Quote[]) => void;
  showFinancials: boolean;
}) {
  const client =
    drawer.kind === "client"
      ? snapshot.clients.find((item) => item.id === drawer.id)
      : undefined;
  const deal =
    drawer.kind === "deal"
      ? snapshot.deals.find((item) => item.id === drawer.id)
      : undefined;

  if (!client && !deal) return null;

  const relatedClient = client
    ? client
    : snapshot.clients.find((item) => item.id === deal?.clientId);
  const relatedContacts = snapshot.contacts.filter(
    (item) => item.clientId === relatedClient?.id,
  );
  const relatedDeals = snapshot.deals.filter(
    (item) => item.clientId === relatedClient?.id,
  );
  const relatedInteractions = snapshot.interactions
    .filter((item) => item.clientId === relatedClient?.id)
    .slice(0, 4);
  const relatedApprovals = snapshot.priceApprovals.filter((approval) =>
    deal
      ? approval.dealId === deal.id
      : approval.clientId === relatedClient?.id,
  );

  if (deal && relatedClient) {
    return (
      <DealWorkspace
        approvals={relatedApprovals}
        client={relatedClient}
        contacts={relatedContacts}
        currentUser={currentUser}
        deal={deal}
        interactions={relatedInteractions}
        quotes={snapshot.quotes.filter((quote) => quote.dealId === deal.id)}
        users={snapshot.users}
        onAddInteraction={() =>
          onAddInteraction(relatedClient.id, deal.id)
        }
        onClose={onClose}
        onMoveDeal={() => onMoveDeal(deal)}
        onReviewApproval={onReviewApproval}
        onUpdateDealWorkflow={onUpdateDealWorkflow}
        showFinancials={showFinancials}
      />
    );
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <aside
        aria-label={client ? "Карточка клиента" : "Карточка сделки"}
        aria-modal="true"
        className="record-drawer"
        role="dialog"
      >
        <header className="drawer-header">
          <div>
            <span className="record-id">{client?.id ?? deal?.id}</span>
            <h2>{client?.companyName ?? deal?.title}</h2>
            {deal && <p>{relatedClient?.companyName}</p>}
          </div>
          <button autoFocus className="ghost-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </header>

        <div className="drawer-status">
          <span className="exact-status">
            {client?.status ?? deal?.status ?? "Без статуса"}
          </span>
          {client && (
            <span className={`potential potential-${client.potential}`}>
              {client.potential}
            </span>
          )}
          <button
            className="text-button"
            onClick={() =>
              client ? onMoveClient(client) : deal && onMoveDeal(deal)
            }
            type="button"
          >
            Изменить статус
          </button>
        </div>

        <div className="drawer-scroll">
          {client && (
            <>
              <DrawerSection title="Следующее действие">
                <div className="next-action drawer-next">
                  <span className={getDueState(client.nextActionAt).className}>
                    {getDueState(client.nextActionAt).label}
                  </span>
                  <strong>{client.nextAction || "Шаг не назначен"}</strong>
                  <small>{formatDate(client.nextActionAt, true)}</small>
                </div>
              </DrawerSection>
              <DrawerSection
                action={
                  <button
                    className="text-button"
                    onClick={() => onAddContact(client.id)}
                    type="button"
                  >
                    Добавить
                  </button>
                }
                title="Карта влияния"
              >
                <div className="decision-map">
                  {relatedContacts.length ? (
                    relatedContacts.map((contact) => (
                      <article key={contact.id}>
                        <div className="decision-person">
                          <span aria-hidden="true" className="decision-avatar">
                            {contact.fullName
                              .split(" ")
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")}
                          </span>
                          <div>
                            <strong>{contact.fullName}</strong>
                            <span>{contact.role || contact.decisionRole}</span>
                          </div>
                        </div>
                        <div className="decision-tags">
                          <span>{contact.decisionRole}</span>
                          <span
                            className={`influence influence-${contact.decisionInfluence === "Блокирует" ? "blocker" : contact.decisionInfluence === "Принимает решение" ? "decision" : "influencer"}`}
                          >
                            {contact.decisionInfluence}
                          </span>
                        </div>
                        <dl>
                          <div>
                            <dt>Канал</dt>
                            <dd>{contact.preferredChannel}</dd>
                          </div>
                          <div>
                            <dt>Ещё познакомиться</dt>
                            <dd>
                              {contact.introductionNeeded || "Карта закрыта"}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    ))
                  ) : (
                    <p className="muted-copy">Контакты ещё не добавлены.</p>
                  )}
                </div>
              </DrawerSection>
              <DrawerSection title="Повторные продажи">
                <RepeatOrderForm
                  client={client}
                  onSave={(values) => onUpdateRepeatOrder(client.id, values)}
                />
              </DrawerSection>
              <DrawerSection title="Профиль клиента">
                <dl className="detail-grid">
                  <Detail label="ИНН" value={client.inn} mono />
                  <Detail label="Регион" value={client.region} />
                  <Detail label="Город" value={client.city} />
                  <Detail label="Отрасль" value={client.industry} />
                  <Detail label="Производит" value={client.produces} />
                  <Detail label="Может покупать" value={client.mayPurchase} />
                  <Detail label="Источник" value={client.source} />
                  <Detail label="Менеджер" value={client.managerName} />
                </dl>
              </DrawerSection>
              <DrawerSection title="Сделки">
                <div className="related-list">
                  {relatedDeals.map((item) => (
                    <article key={item.id}>
                      <strong>{item.title}</strong>
                      <span>{item.status}</span>
                      <small>{formatMoney(item.ourPrice)}</small>
                    </article>
                  ))}
                </div>
              </DrawerSection>
            </>
          )}

          {deal && (
            <>
              <DrawerSection
                title={showFinancials ? "Экономика сделки" : "Детали сделки"}
              >
                <dl className="detail-grid">
                  <Detail label="Товар" value={deal.product} />
                  <Detail label="Объём" value={deal.volume} />
                  <Detail
                    label="Выручка"
                    value={formatMoney(deal.ourPrice)}
                    mono
                  />
                  {showFinancials && (
                    <>
                      <Detail
                        label="Себестоимость"
                        value={formatMoney(deal.purchasePrice)}
                        mono
                      />
                      <Detail
                        label="Логистика"
                        value={formatMoney(deal.logistics)}
                        mono
                      />
                      <Detail
                        label="Маржа"
                        value={`${formatMoney(deal.margin)} · ${deal.marginPercent}%`}
                        mono
                      />
                    </>
                  )}
                  <Detail label="Дата КП" value={formatDate(deal.proposalDate)} />
                </dl>
              </DrawerSection>
              <DrawerSection title="Следующий шаг">
                <div className="next-action drawer-next">
                  <span
                    className={
                      deal.needsNextAction
                        ? "due-overdue"
                        : getDueState(deal.nextActionAt).className
                    }
                  >
                    {deal.needsNextAction
                      ? "Требует действия"
                      : getDueState(deal.nextActionAt).label}
                  </span>
                  <strong>{deal.nextAction}</strong>
                  <small>{formatDate(deal.nextActionAt, true)}</small>
                </div>
              </DrawerSection>
              <DrawerSection title="Ответственный">
                <p>{deal.managerName}</p>
              </DrawerSection>
            </>
          )}

          <DrawerSection title="Согласование цены">
            <div className="approval-list">
              {relatedApprovals.length ? (
                relatedApprovals.map((approval) => (
                  <article key={approval.id}>
                    <header>
                      <div>
                        <strong>{approval.product}</strong>
                        <span>{approval.volume}</span>
                      </div>
                      <span className={`approval-status is-${approval.status}`}>
                        {approvalStatusLabel(approval.status)}
                      </span>
                    </header>
                    <dl>
                      <Detail
                        label="Текущая цена"
                        value={formatMoney(approval.currentPrice)}
                        mono
                      />
                      <Detail
                        label="Запрошенная цена"
                        value={formatMoney(approval.requestedPrice)}
                        mono
                      />
                    </dl>
                    <p>{approval.reason || "Причина не указана"}</p>
                    {currentUser &&
                      isManager(currentUser) &&
                      ["pending", "clarification"].includes(approval.status) && (
                        <div className="approval-actions">
                          <button
                            className="primary-button"
                            onClick={() =>
                              onReviewApproval(approval.id, "approved")
                            }
                            type="button"
                          >
                            Согласовать
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() =>
                              onReviewApproval(approval.id, "clarification")
                            }
                            type="button"
                          >
                            Запросить уточнение
                          </button>
                          <button
                            className="danger-button"
                            onClick={() =>
                              onReviewApproval(approval.id, "rejected")
                            }
                            type="button"
                          >
                            Отклонить
                          </button>
                        </div>
                      )}
                  </article>
                ))
              ) : (
                <p className="muted-copy">Запросов на согласование пока нет.</p>
              )}
            </div>
          </DrawerSection>

          <DrawerSection
            action={
              relatedClient ? (
                <button
                  className="text-button"
                  onClick={() => onAddInteraction(relatedClient.id)}
                  type="button"
                >
                  Записать контакт
                </button>
              ) : null
            }
            title="Последние взаимодействия"
          >
            <div className="mini-timeline">
              {relatedInteractions.map((interaction) => (
                <article key={interaction.id}>
                  <time>{formatDate(interaction.occurredAt, true)}</time>
                  <strong>{interaction.subject}</strong>
                  <span>{interaction.kind}</span>
                </article>
              ))}
            </div>
          </DrawerSection>
        </div>

        {client && (
          <footer className="drawer-footer">
            <button
              className="danger-button"
              onClick={() => onDeleteClient(client)}
              type="button"
            >
              Удалить клиента
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

function DeleteClientDialog({
  client,
  snapshot,
  onClose,
  onConfirm,
}: {
  client: Client;
  snapshot: CrmSnapshot;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const relatedDeals = snapshot.deals.filter(
    (deal) => deal.clientId === client.id,
  );
  const relatedContacts = snapshot.contacts.filter(
    (contact) => contact.clientId === client.id,
  );
  const relatedInteractions = snapshot.interactions.filter(
    (interaction) => interaction.clientId === client.id,
  );

  return (
    <div className="dialog-backdrop centered" role="presentation">
      <section
        aria-label="Удаление клиента"
        aria-modal="true"
        className="status-dialog confirm-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span className="section-kicker">Подтверждение</span>
            <h2>Удалить клиента «{client.companyName}»?</h2>
            <p>
              Действие нельзя отменить. Вместе с клиентом будут удалены сделки
              ({relatedDeals.length}), контактные лица (
              {relatedContacts.length}) и записанные взаимодействия (
              {relatedInteractions.length}).
            </p>
          </div>
        </header>
        <footer className="confirm-actions">
          <button
            autoFocus
            className="ghost-button"
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button className="danger-button" onClick={onConfirm} type="button">
            Удалить клиента
          </button>
        </footer>
      </section>
    </div>
  );
}

function DealWorkspace({
  approvals,
  client,
  contacts,
  currentUser,
  deal,
  interactions,
  quotes,
  users,
  onAddInteraction,
  onClose,
  onMoveDeal,
  onReviewApproval,
  onUpdateDealWorkflow,
  showFinancials,
}: {
  approvals: PriceApproval[];
  client: Client;
  contacts: Contact[];
  currentUser: User | null;
  deal: Deal;
  interactions: Interaction[];
  quotes: Quote[];
  users: User[];
  onAddInteraction: () => void;
  onClose: () => void;
  onMoveDeal: () => void;
  onReviewApproval: (
    approvalId: string,
    status: PriceApprovalStatus,
  ) => void;
  onUpdateDealWorkflow: (deal: Deal, quotes: Quote[]) => void;
  showFinancials: boolean;
}) {
  const latestInteraction = interactions[0];
  const decisionMaker =
    contacts.find(
      (contact) => contact.decisionInfluence === "Принимает решение",
    ) ?? contacts[0];
  const probability = Math.min(
    92,
    Math.max(
      48,
      58 +
        contacts.filter(
          (contact) => contact.decisionInfluence === "Принимает решение",
        ).length *
          12 +
        (deal.status === "Переговоры" ? 10 : 0),
    ),
  );
  const due = deal.needsNextAction
    ? { className: "due-overdue", label: "Требует действия" }
    : getDueState(deal.nextActionAt);
  const pendingApproval = approvals.find(
    (approval) => approval.status === "pending",
  );

  return (
    <div className="dialog-backdrop deal-workspace-backdrop" role="presentation">
      <section
        aria-label="Рабочее пространство сделки"
        aria-modal="true"
        className="deal-workspace"
        role="dialog"
      >
        <header className="deal-workspace-header">
          <div className="deal-workspace-heading">
            <button className="deal-back-button" onClick={onClose} type="button">
              <span aria-hidden="true">←</span>
              К списку сделок
            </button>
            <div>
              <span className="record-id">Сделка {deal.id}</span>
              <h2>{deal.title}</h2>
              <p>
                <strong>{client.companyName}</strong>
                <span>ИНН {client.inn}</span>
                <span>{client.status ?? "Без статуса"}</span>
              </p>
            </div>
          </div>
          <div className="deal-workspace-actions">
            <button className="ghost-button" onClick={onMoveDeal} type="button">
              Изменить статус
            </button>
            <button
              className="primary-button"
              onClick={onAddInteraction}
              type="button"
            >
              <CrmIcon className="size-[16px]" name="activity" />
              Сохранить контакт
            </button>
            <button
              aria-label="Закрыть карточку сделки"
              className="deal-close-button"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </header>

        <div className="deal-workspace-scroll">
          <div className="deal-summary-strip">
            <div>
              <span>Выручка сделки</span>
              <strong>{formatMoney(deal.ourPrice)}</strong>
            </div>
            <div>
              <span>Вероятность</span>
              <strong>{probability}%</strong>
            </div>
            <div>
              <span>Прогноз повт. заказа</span>
              <strong className="positive">Высокая</strong>
              <small>{formatDate(client.expectedNextOrderAt)}</small>
            </div>
            <div>
              <span>Последняя отгрузка</span>
              <strong>{formatDate(client.lastShipmentAt)}</strong>
              <small>
                {client.averageMonthlyVolume.toLocaleString("ru-RU")} шт./мес.
              </small>
            </div>
            <div>
              <span>Ответственный</span>
              <strong>{deal.managerName}</strong>
              <small>Менеджер по продажам</small>
            </div>
          </div>

          <div className="deal-workspace-layout">
            <main className="deal-workspace-main">
              <section className="deal-contact-panel">
                <header>
                  <div>
                    <span className="section-kicker">Быстрое действие</span>
                    <h3>Сохранить результат контакта</h3>
                  </div>
                  <span className="deal-status-badge">{deal.status}</span>
                </header>

                <div className="deal-contact-context">
                  <article>
                    <span>Контактное лицо</span>
                    <strong>
                      {decisionMaker?.fullName ?? "Контакт не выбран"}
                    </strong>
                    <small>
                      {decisionMaker
                        ? `${decisionMaker.decisionRole} · ${decisionMaker.preferredChannel}`
                        : "Добавьте ЛПР в карточке клиента"}
                    </small>
                  </article>
                  <article>
                    <span>Последний результат</span>
                    <strong>
                      {latestInteraction?.result ||
                        "Контакт по сделке ещё не зафиксирован"}
                    </strong>
                    <small>
                      {latestInteraction
                        ? formatDate(latestInteraction.occurredAt, true)
                        : "Запишите итог разговора"}
                    </small>
                  </article>
                </div>

                <div className="deal-mandatory-step">
                  <div>
                    <span>Обязательный следующий шаг</span>
                    <strong>
                      {deal.nextAction || "Следующий шаг не назначен"}
                    </strong>
                  </div>
                  <div>
                    <span>Крайний срок</span>
                    <strong>{formatDate(deal.nextActionAt, true)}</strong>
                  </div>
                  <span className={due.className}>{due.label}</span>
                </div>

                <div className="deal-contact-guidance">
                  <span>
                    После сохранения CRM автоматически создаст задачу и обновит
                    следующий шаг сделки.
                  </span>
                  <button
                    className="primary-button"
                    onClick={onAddInteraction}
                    type="button"
                  >
                    Записать результат контакта
                  </button>
                </div>
              </section>

              {currentUser ? (
                <DealProcessView
                  currentUser={currentUser}
                  deal={deal}
                  onChange={onUpdateDealWorkflow}
                  quotes={quotes}
                  showFinancials={showFinancials}
                  users={users}
                />
              ) : null}

              <section className="deal-economics-panel">
                <header>
                  <div>
                    <span className="section-kicker">Коммерческие условия</span>
                    <h3>
                      {showFinancials ? "Экономика сделки" : "Детали сделки"}
                    </h3>
                  </div>
                  {pendingApproval ? (
                    <span className="approval-status is-pending">
                      На согласовании
                    </span>
                  ) : null}
                </header>
                <dl>
                  <Detail label="Товар" value={deal.product} />
                  <Detail label="Объём" value={deal.volume} />
                  <Detail
                    label="Выручка"
                    value={formatMoney(deal.ourPrice)}
                    mono
                  />
                  {showFinancials ? (
                    <>
                      <Detail
                        label="Себестоимость"
                        value={formatMoney(deal.purchasePrice)}
                        mono
                      />
                      <Detail
                        label="Логистика"
                        value={formatMoney(deal.logistics)}
                        mono
                      />
                      <Detail
                        label="Маржа"
                        value={`${formatMoney(deal.margin)} · ${deal.marginPercent}%`}
                        mono
                      />
                    </>
                  ) : null}
                  <Detail
                    label="Дата КП"
                    value={formatDate(deal.proposalDate)}
                  />
                </dl>
              </section>

              <section className="deal-history-panel">
                <header>
                  <div>
                    <span className="section-kicker">Хронология</span>
                    <h3>История контактов</h3>
                  </div>
                  <button
                    className="text-button"
                    onClick={onAddInteraction}
                    type="button"
                  >
                    Добавить запись
                  </button>
                </header>
                <div>
                  {interactions.length ? (
                    interactions.map((interaction) => (
                      <article key={interaction.id}>
                        <span className="deal-history-kind">
                          {interaction.kind.slice(0, 2)}
                        </span>
                        <time>{formatDate(interaction.occurredAt, true)}</time>
                        <div>
                          <strong>{interaction.subject}</strong>
                          <p>{interaction.result}</p>
                        </div>
                        <span>{interaction.managerName}</span>
                      </article>
                    ))
                  ) : (
                    <p className="muted-copy">
                      По этой сделке пока нет зафиксированных контактов.
                    </p>
                  )}
                </div>
              </section>
            </main>

            <aside className="deal-workspace-rail">
              <section className="deal-influence-panel">
                <header>
                  <h3>Карта влияния</h3>
                  <span>{contacts.length}</span>
                </header>
                <div>
                  {contacts.length ? (
                    contacts.map((contact) => (
                      <article key={contact.id}>
                        <span className="decision-avatar">
                          {contact.fullName
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </span>
                        <div>
                          <strong>{contact.fullName}</strong>
                          <small>{contact.role || contact.decisionRole}</small>
                          <em
                            className={`influence influence-${contact.decisionInfluence === "Блокирует" ? "blocker" : contact.decisionInfluence === "Принимает решение" ? "decision" : "influencer"}`}
                          >
                            {contact.decisionInfluence}
                          </em>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="muted-copy">
                      Добавьте закупщика, технолога и руководителя производства.
                    </p>
                  )}
                </div>
              </section>

              <section className="deal-repeat-panel">
                <header>
                  <h3>Прогноз повторного заказа</h3>
                  <span>{probability}%</span>
                </header>
                <strong>Высокая вероятность</strong>
                <dl>
                  <div>
                    <dt>Период</dt>
                    <dd>{formatDate(client.expectedNextOrderAt)}</dd>
                  </div>
                  <div>
                    <dt>Регулярность</dt>
                    <dd>
                      {client.orderFrequencyDays
                        ? `${client.orderFrequencyDays} дней`
                        : "Не задана"}
                    </dd>
                  </div>
                  <div>
                    <dt>Средний объём</dt>
                    <dd>
                      {client.averageMonthlyVolume.toLocaleString("ru-RU")} шт.
                    </dd>
                  </div>
                  <div>
                    <dt>Последняя активность</dt>
                    <dd>{formatDate(client.lastContactAt)}</dd>
                  </div>
                </dl>
              </section>

              <section className="deal-approval-panel">
                <header>
                  <h3>Согласование цены</h3>
                  <span>{approvals.length}</span>
                </header>
                {approvals.length ? (
                  approvals.map((approval) => (
                    <article key={approval.id}>
                      <div>
                        <strong>{approval.product}</strong>
                        <span className={`approval-status is-${approval.status}`}>
                          {approvalStatusLabel(approval.status)}
                        </span>
                      </div>
                      <p>{approval.reason || "Причина не указана"}</p>
                      <dl>
                        <div>
                          <dt>Текущая</dt>
                          <dd>{formatMoney(approval.currentPrice)}</dd>
                        </div>
                        <div>
                          <dt>Запрошенная</dt>
                          <dd>{formatMoney(approval.requestedPrice)}</dd>
                        </div>
                      </dl>
                      {currentUser &&
                      isManager(currentUser) &&
                      ["pending", "clarification"].includes(
                        approval.status,
                      ) ? (
                        <div className="deal-approval-actions">
                          <button
                            onClick={() =>
                              onReviewApproval(approval.id, "approved")
                            }
                            type="button"
                          >
                            Согласовать
                          </button>
                          <button
                            onClick={() =>
                              onReviewApproval(approval.id, "clarification")
                            }
                            type="button"
                          >
                            Уточнить
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <button
                    className="ghost-button"
                    onClick={onAddInteraction}
                    type="button"
                  >
                    Запросить согласование
                  </button>
                )}
              </section>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

function RepeatOrderForm({
  client,
  onSave,
}: {
  client: Client;
  onSave: (values: {
    orderFrequencyDays: number | null;
    lastShipmentAt: string | null;
    expectedNextOrderAt: string | null;
    averageMonthlyVolume: number;
    repeatReminderDays: 7 | 14;
    expectedNextOrderManual: boolean;
  }) => void;
}) {
  const daysWithoutOrder = getDaysWithoutOrder(client);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const frequency = Number(form.get("orderFrequencyDays"));
    const expectedNextOrderAt =
      String(form.get("expectedNextOrderAt") ?? "") || null;
    const expectedNextOrderManual = expectedNextOrderAt
      ? expectedNextOrderAt !== client.expectedNextOrderAt ||
        client.expectedNextOrderManual
      : false;
    onSave({
      orderFrequencyDays: frequency > 0 ? frequency : null,
      lastShipmentAt: String(form.get("lastShipmentAt") ?? "") || null,
      expectedNextOrderAt,
      expectedNextOrderManual,
      averageMonthlyVolume: Math.max(
        0,
        Number(form.get("averageMonthlyVolume") ?? 0),
      ),
      repeatReminderDays:
        Number(form.get("repeatReminderDays")) === 7 ? 7 : 14,
    });
  };

  return (
    <form className="repeat-order-form" onSubmit={handleSubmit}>
      <div className="repeat-order-summary">
        <div>
          <span>Без заказа</span>
          <strong>
            {daysWithoutOrder === null ? "Нет истории" : `${daysWithoutOrder} дн.`}
          </strong>
        </div>
        <div>
          <span>Ожидаемый заказ</span>
          <strong>{formatDate(client.expectedNextOrderAt)}</strong>
        </div>
        <div>
          <span>Средний объём</span>
          <strong>
            {client.averageMonthlyVolume.toLocaleString("ru-RU")} шт./мес.
          </strong>
        </div>
      </div>
      <div className="repeat-order-fields">
        <label>
          Периодичность, дней
          <input
            defaultValue={client.orderFrequencyDays ?? ""}
            min="1"
            name="orderFrequencyDays"
            type="number"
          />
        </label>
        <label>
          Последняя отгрузка
          <input
            defaultValue={client.lastShipmentAt?.slice(0, 10) ?? ""}
            name="lastShipmentAt"
            type="date"
          />
        </label>
        <label>
          Следующий заказ
          <input
            defaultValue={client.expectedNextOrderAt?.slice(0, 10) ?? ""}
            name="expectedNextOrderAt"
            type="date"
          />
        </label>
        <label>
          Средний объём, шт./мес.
          <input
            defaultValue={client.averageMonthlyVolume}
            min="0"
            name="averageMonthlyVolume"
            type="number"
          />
        </label>
        <label>
          Напомнить заранее
          <select
            defaultValue={String(client.repeatReminderDays)}
            name="repeatReminderDays"
          >
            <option value="7">За 7 дней</option>
            <option value="14">За 14 дней</option>
          </select>
        </label>
      </div>
      <button className="ghost-button" type="submit">
        Сохранить цикл
      </button>
    </form>
  );
}

function StatusPicker({
  intent,
  onChoose,
  onClose,
}: {
  intent: Exclude<MoveIntent, null>;
  onChoose: (status: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="dialog-backdrop centered" role="presentation">
      <section
        aria-label="Выбор точного статуса"
        aria-modal="true"
        className="status-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span className="section-kicker">Точный статус</span>
            <h2>{intent.title}</h2>
          </div>
          <button autoFocus className="ghost-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </header>
        <div className="status-options">
          {intent.statuses.map((status, index) => (
            <button key={status} onClick={() => onChoose(status)} type="button">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{status}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function LossReasonDialog({
  status,
  onSubmit,
  onClose,
}: {
  status: "Проиграна" | "Отменена";
  onSubmit: (reason: LossReason) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<LossReason>(LOSS_REASONS[0]);

  return (
    <div className="dialog-backdrop centered" role="presentation">
      <form
        aria-label="Причина закрытия сделки"
        aria-modal="true"
        className="status-dialog loss-reason-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(reason);
        }}
        role="dialog"
      >
        <header>
          <div>
            <span className="section-kicker">Контроль результата</span>
            <h2>Почему сделка {status.toLocaleLowerCase("ru-RU")}?</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </header>
        <label className="loss-reason-field">
          Причина
          <select
            autoFocus
            onChange={(event) => setReason(event.target.value as LossReason)}
            value={reason}
          >
            {LOSS_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <footer>
          <button className="primary-button" type="submit">
            Сохранить причину
          </button>
        </footer>
      </form>
    </div>
  );
}

function CreateDialog({
  kind,
  clientId,
  contact,
  dealId,
  currentUser,
  snapshot,
  onClose,
  onSubmit,
}: {
  kind: Exclude<CreateKind, null>;
  clientId: string | null;
  contact?: Contact | null;
  dealId: string | null;
  currentUser: User;
  snapshot: CrmSnapshot;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const titles = {
    client: "Новый клиент",
    deal: "Новая сделка",
    contact: contact ? "Карточка контакта" : "Новый контакт",
    interaction: "Результат контакта",
  };
  const managerOptions = (
    currentUser.role === "manager"
      ? snapshot.users.filter((user) => user.isActive)
      : [currentUser]
  ).map((user) => user.fullName);
  const initialClientId =
    clientId ??
    snapshot.clients.find(
      (client) =>
        snapshot.deals.some((deal) => deal.clientId === client.id) &&
        snapshot.contacts.some((contact) => contact.clientId === client.id),
    )?.id ??
    snapshot.clients[0]?.id ??
    "";
  const [selectedClientId, setSelectedClientId] =
    useState(initialClientId);
  const clientDeals = snapshot.deals.filter(
    (deal) => deal.clientId === selectedClientId,
  );
  const clientContacts = snapshot.contacts.filter(
    (contact) => contact.clientId === selectedClientId,
  );
  const [selectedDealId, setSelectedDealId] = useState(
    clientDeals.some((deal) => deal.id === dealId)
      ? (dealId ?? "")
      : (clientDeals[0]?.id ?? ""),
  );
  const [requestApproval, setRequestApproval] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [formValid, setFormValid] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (clientDeals.some((deal) => deal.id === selectedDealId)) return;
    setSelectedDealId(clientDeals[0]?.id ?? "");
  }, [clientDeals, selectedDealId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setFormValid(formRef.current?.checkValidity() ?? false);
    });
    return () => cancelAnimationFrame(frame);
  }, [kind, requestApproval, selectedClientId, selectedDealId]);

  const selectedDeal = clientDeals.find((deal) => deal.id === selectedDealId);
  const refreshValidity = () => {
    setFormValid(formRef.current?.checkValidity() ?? false);
  };

  return (
    <div className="dialog-backdrop centered" role="presentation">
      <form
        aria-label={titles[kind]}
        aria-modal="true"
        className="create-dialog"
        onChange={refreshValidity}
        onInput={refreshValidity}
        onSubmit={onSubmit}
        ref={formRef}
        role="dialog"
      >
        <header>
          <div>
            <span className="section-kicker">Локальная запись</span>
            <h2>{titles[kind]}</h2>
          </div>
          <button
            autoFocus
            className="ghost-button"
            onClick={onClose}
            type="button"
          >
            Закрыть
          </button>
        </header>

        <div className="form-grid">
          {kind === "client" && (
            <>
              <Field label="Название компании" name="companyName" required />
              <Field label="ИНН" name="inn" />
              <Field label="Регион" name="region" />
              <Field label="Город" name="city" />
              <SelectField
                label="Отрасль"
                name="industry"
                options={snapshot.dictionaries.industries}
              />
              <Field label="Что может покупать" name="mayPurchase" />
              <SelectField
                label="Потенциал"
                name="potential"
                options={snapshot.dictionaries.potentials}
              />
              <SelectField
                label="Статус"
                name="status"
                options={[...CLIENT_STATUSES]}
              />
              <SelectField
                label="Источник"
                name="source"
                options={snapshot.dictionaries.sources}
              />
              <SelectField
                label="Менеджер"
                name="manager"
                options={managerOptions}
              />
              <Field label="Следующее действие" name="nextAction" wide />
              <Field
                label="Дата следующего действия"
                name="nextActionAt"
                type="datetime-local"
                wide
              />
              <Field
                label="Обычная периодичность заказа, дней"
                name="orderFrequencyDays"
                type="number"
              />
              <Field
                label="Дата последней отгрузки"
                name="lastShipmentAt"
                type="date"
              />
              <Field
                label="Ожидаемая дата следующего заказа"
                name="expectedNextOrderAt"
                type="date"
              />
              <Field
                label="Среднемесячный объём, шт."
                name="averageMonthlyVolume"
                type="number"
              />
              <SelectField
                label="Напоминание"
                name="repeatReminderDays"
                options={[
                  { label: "За 14 дней", value: "14" },
                  { label: "За 7 дней", value: "7" },
                ]}
              />
            </>
          )}

          {kind === "deal" && (
            <>
              <Field label="Название сделки" name="title" required wide />
              <SelectField
                label="Клиент"
                name="clientId"
                options={snapshot.clients.map((client) => ({
                  label: client.companyName,
                  value: client.id,
                }))}
              />
              <SelectField
                label="Статус"
                name="status"
                options={[...DEAL_STATUSES]}
              />
              <Field label="Товар" name="product" />
              <Field label="Объём" name="volume" />
              <Field label="Выручка" name="ourPrice" type="number" />
              <SelectField
                label="Менеджер"
                name="manager"
                options={managerOptions}
              />
              <Field
                label="Следующее действие · обязательно"
                name="nextAction"
                required
                wide
              />
              <Field
                label="Дата следующего действия · обязательно"
                name="nextActionAt"
                required
                type="datetime-local"
                wide
              />
              <Field
                label="Прогнозная дата закрытия · обязательно"
                name="forecastCloseAt"
                required
                type="date"
                wide
              />
            </>
          )}

          {kind === "contact" && (
            <>
              <SelectField
                defaultValue={contact?.clientId ?? clientId ?? undefined}
                label="Клиент"
                name="clientId"
                options={snapshot.clients.map((client) => ({
                  label: client.companyName,
                  value: client.id,
                }))}
              />
              <Field
                defaultValue={contact?.fullName}
                label="Имя и фамилия"
                name="fullName"
                required
              />
              <Field
                defaultValue={contact?.role}
                label="Должность"
                name="role"
              />
              <Field
                defaultValue={contact?.phone}
                label="Телефон"
                name="phone"
                type="tel"
              />
              <Field
                defaultValue={contact?.email}
                label="Email"
                name="email"
                type="email"
                wide
              />
              <SelectField
                defaultValue={contact?.decisionRole}
                label="Роль в решении"
                name="decisionRole"
                options={DECISION_ROLES}
              />
              <SelectField
                defaultValue={contact?.decisionInfluence}
                label="Влияние"
                name="decisionInfluence"
                options={DECISION_INFLUENCES}
              />
              <SelectField
                defaultValue={contact?.preferredChannel}
                label="Предпочтительный канал"
                name="preferredChannel"
                options={PREFERRED_CHANNELS}
              />
              <Field
                defaultValue={contact?.introductionNeeded}
                label="С кем ещё необходимо познакомиться"
                name="introductionNeeded"
                wide
              />
            </>
          )}

          {kind === "interaction" && (
            <>
              <SelectField
                defaultValue={selectedClientId}
                label="Клиент · обязательно"
                name="clientId"
                onChange={setSelectedClientId}
                options={snapshot.clients.map((client) => ({
                  label: client.companyName,
                  value: client.id,
                }))}
                required
              />
              <SelectField
                defaultValue={selectedDealId}
                label="Сделка · обязательно"
                name="dealId"
                onChange={setSelectedDealId}
                options={clientDeals.map((deal) => ({
                  label: `${deal.title} · ${deal.status}`,
                  value: deal.id,
                }))}
                required
              />
              <SelectField
                label="Контактное лицо · обязательно"
                name="contactId"
                options={clientContacts.map((contact) => ({
                  label: `${contact.fullName} · ${contact.decisionRole}`,
                  value: contact.id,
                }))}
                required
              />
              <SelectField
                label="Тип контакта"
                name="kind"
                options={snapshot.dictionaries.interactionTypes}
              />
              <Field label="Тема" name="subject" required wide />
              <Field label="Результат контакта · обязательно" name="result" required wide />
              <div className="mandatory-next-step wide-field">
                <header>
                  <strong>Обязательный следующий шаг</strong>
                  <span>Автоматически станет задачей</span>
                </header>
                <div>
                  <Field label="Что сделать" name="nextStep" required />
                  <Field
                    label="Крайний срок"
                    name="nextStepAt"
                    required
                    type="datetime-local"
                  />
                </div>
              </div>
              <SelectField
                label="Ответственный"
                name="manager"
                options={managerOptions}
              />
              <label className="file-field wide-field">
                Файл или фотография
                <input
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="file-input-native"
                  multiple
                  name="attachments"
                  onChange={(event) => {
                    setAttachmentCount(event.target.files?.length ?? 0);
                    refreshValidity();
                  }}
                  type="file"
                />
                <span className="file-pick-control">
                  <strong>Выбрать файлы</strong>
                  <span>
                    {attachmentCount
                      ? `Выбрано: ${attachmentCount}`
                      : "Файлы не выбраны"}
                  </span>
                </span>
                <small>Можно приложить несколько файлов или фотографий</small>
              </label>
              <label className="approval-toggle wide-field">
                <input
                  checked={requestApproval}
                  name="requestApproval"
                  onChange={(event) =>
                    setRequestApproval(event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  <strong>Запросить согласование цены</strong>
                  <small>Запрос увидит руководитель</small>
                </span>
              </label>
              {requestApproval && (
                <div
                  className="price-approval-fields wide-field"
                  key={selectedDealId}
                >
                  <header>
                    <strong>Параметры согласования</strong>
                    <span>{selectedDeal?.title ?? "Выберите сделку"}</span>
                  </header>
                  <div>
                    <Field
                      defaultValue={selectedDeal?.product}
                      label="Продукт"
                      name="approvalProduct"
                      required
                    />
                    <Field
                      defaultValue={selectedDeal?.volume}
                      label="Объём"
                      name="approvalVolume"
                      required
                    />
                    <Field
                      defaultValue={selectedDeal?.ourPrice}
                      label="Текущая цена"
                      name="currentPrice"
                      required
                      type="number"
                    />
                    <Field
                      label="Запрашиваемая цена"
                      name="requestedPrice"
                      required
                      type="number"
                    />
                    <Field
                      label="Причина изменения"
                      name="approvalReason"
                      required
                      wide
                    />
                    <Field
                      label="Комментарий руководителю"
                      name="approvalComment"
                      wide
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <footer>
          <button className="ghost-button" onClick={onClose} type="button">
            Отмена
          </button>
          <button
            className="primary-button"
            disabled={!formValid}
            type="submit"
          >
            {kind === "interaction" ? "Сохранить контакт" : "Сохранить"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  type = "text",
  wide,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  wide?: boolean;
  defaultValue?: string | number;
}) {
  return (
    <label className={wide ? "wide-field" : ""}>
      {label}
      <input
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

type SelectOption = string | { label: string; value: string };

function SelectField({
  label,
  name,
  options,
  defaultValue,
  onChange,
  required,
}: {
  label: string;
  name: string;
  options: readonly SelectOption[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const controlledProps = onChange
    ? {
        value: defaultValue ?? "",
        onChange: (event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value),
      }
    : { defaultValue };

  return (
    <label>
      {label}
      <select
        name={name}
        required={required}
        {...controlledProps}
      >
        {!options.length && <option value="">Нет доступных вариантов</option>}
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const text = typeof option === "string" ? option : option.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function DrawerSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="drawer-section">
      <header>
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : ""}>{value || "Не заполнено"}</dd>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "attention" | "good";
}) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ViewSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div className="view-switch" aria-label="Режим отображения">
      <button
        className={value === "board" ? "is-active" : ""}
        onClick={() => onChange("board")}
        type="button"
      >
        Канбан
      </button>
      <button
        className={value === "list" ? "is-active" : ""}
        onClick={() => onChange("list")}
        type="button"
      >
        Список
      </button>
    </div>
  );
}

function TableEmpty() {
  return (
    <div className="table-empty">
      <strong>Ничего не найдено</strong>
      <span>Измените поиск или сбросьте фильтры.</span>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div aria-label="CRM загружается" className="workspace-skeleton" role="status">
      <div className="skeleton-metrics">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="skeleton-toolbar" />
      <div className="skeleton-columns">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <div className="error-state" role="alert">
      <span>Ошибка загрузки</span>
      <h2>{message}</h2>
      <button className="primary-button" onClick={() => void onRetry()} type="button">
        Повторить
      </button>
    </div>
  );
}
