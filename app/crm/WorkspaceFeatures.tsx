"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  DEAL_PIPELINE,
  type CrmSnapshot,
  type Deal,
  type Interaction,
  type StatusEvent,
  type Task,
  type User,
} from "./domain";
import "./workspace-features.css";

export interface WorkspaceFeatureProps {
  snapshot: CrmSnapshot | null;
  currentUser: User | null;
  onSnapshotChange: (snapshot: CrmSnapshot) => void;
  onOpenClient: (clientId: string) => void;
  onOpenDeal: (dealId: string) => void;
  loading?: boolean;
}

type CalendarMode = "month" | "agenda";
type StatisticsTab = "overview" | "funnel" | "sales" | "activity" | "team";
type RangePreset = "7" | "30" | "90" | "all";
type TaskStateFilter = "open" | "completed" | "all";
type TaskLinkFilter = "all" | "client" | "deal" | "general";
type IconName =
  | "arrow"
  | "calendar"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "close"
  | "edit"
  | "plus"
  | "trend";

interface DrillRow {
  id: string;
  primary: string;
  secondary: string;
  meta: string;
  entity?: "client" | "deal";
  entityId?: string;
}

interface DrillState {
  title: string;
  eyebrow: string;
  rows: DrillRow[];
}

const DAY_MS = 86_400_000;
const CLOSED_DEAL_STATUSES = new Set([
  "Закрыта успешно",
  "Проиграна",
  "Отложена",
  "Отменена",
]);

const TASK_KIND_LABELS: Record<Task["kind"], string> = {
  call: "Звонок",
  meeting: "Встреча",
  email: "Письмо",
  proposal: "Коммерческое предложение",
  follow_up: "Повторный контакт",
  reminder: "Напоминание",
  other: "Другое",
};

const TASK_KIND_SHORT: Record<Task["kind"], string> = {
  call: "ЗВ",
  meeting: "ВС",
  email: "ПС",
  proposal: "КП",
  follow_up: "ПК",
  reminder: "НП",
  other: "ДР",
};

const TASK_PRIORITY_LABELS: Record<Task["priority"], string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});

const DAY_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const MONEY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const COMPACT_MONEY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  notation: "compact",
  maximumFractionDigits: 1,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("ru-RU");

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoAtLocalTime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function localDateTimeValue(value: string | null) {
  const date = safeDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatMoney(value: number) {
  return MONEY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatCompactMoney(value: number) {
  return COMPACT_MONEY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string | null, withTime = false) {
  const date = safeDate(value);
  if (!date) return "Без даты";
  return (withTime ? DATE_TIME_FORMATTER : SHORT_DATE_FORMATTER).format(date);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 10) / 10}%`;
}

function readString(record: object, key: string) {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function ownerId(record: object) {
  return readString(record, "ownerId");
}

function recordCreatedAt(record: object) {
  return (
    readString(record, "createdAt") ||
    readString(record, "proposalDate") ||
    readString(record, "occurredAt")
  );
}

function belongsToUser(
  record: object,
  user: User,
  managerName = readString(record, "managerName"),
) {
  const assignedOwnerId = ownerId(record);
  return assignedOwnerId
    ? assignedOwnerId === user.id
    : managerName === user.fullName;
}

function findUserByLegacyManager(snapshot: CrmSnapshot, managerName: string) {
  return snapshot.users.find((user) => user.fullName === managerName);
}

function getTaskAssignee(snapshot: CrmSnapshot, task: Task) {
  return snapshot.users.find((user) => user.id === task.assigneeId) ?? null;
}

function getTaskClient(snapshot: CrmSnapshot, task: Task) {
  return task.clientId
    ? snapshot.clients.find((client) => client.id === task.clientId) ?? null
    : null;
}

function getTaskDeal(snapshot: CrmSnapshot, task: Task) {
  return task.dealId
    ? snapshot.deals.find((deal) => deal.id === task.dealId) ?? null
    : null;
}

function taskIsCompleted(task: Task) {
  return task.status === "completed";
}

function taskIsOpen(task: Task) {
  return task.status === "open";
}

function taskIsOverdue(task: Task, today = startOfDay(new Date())) {
  const dueAt = safeDate(task.dueAt);
  return Boolean(
    dueAt && taskIsOpen(task) && startOfDay(dueAt).getTime() < today.getTime(),
  );
}

function taskIsToday(task: Task, today = startOfDay(new Date())) {
  const dueAt = safeDate(task.dueAt);
  return Boolean(dueAt && dateKey(dueAt) === dateKey(today));
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function legacyTask(
  snapshot: CrmSnapshot,
  source: {
    id: string;
    title: string;
    description?: string;
    dueAt: string;
    managerName: string;
    clientId?: string | null;
    dealId?: string | null;
    kind?: Task["kind"];
  },
): Task {
  const assignedUser =
    findUserByLegacyManager(snapshot, source.managerName) ??
    snapshot.users.find((user) => user.role === "employee") ??
    snapshot.users[0];
  const now = new Date().toISOString();

  return {
    id: source.id,
    title: source.title,
    description: source.description ?? "",
    kind: source.kind ?? "reminder",
    status: "open",
    priority: "normal",
    dueAt: source.dueAt,
    completedAt: null,
    assigneeId: assignedUser?.id ?? "",
    createdById: assignedUser?.id ?? "",
    clientId: source.clientId ?? null,
    dealId: source.dealId ?? null,
    contactId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function getWorkspaceTasks(snapshot: CrmSnapshot | null) {
  if (!snapshot) return [];

  const stored = snapshot.tasks ?? [];
  const storedIds = new Set(stored.map((task) => task.id));
  const covered = new Set(
    stored.map(
      (task) =>
        `${task.clientId ?? ""}|${task.dealId ?? ""}|${task.title}|${task.dueAt ?? ""}`,
    ),
  );
  const derived: Task[] = [];

  snapshot.clients.forEach((client) => {
    if (!client.nextActionAt || !client.nextAction) return;
    const legacyId = `legacy-client-${client.id}`;
    const signature = `${client.id}||${client.nextAction}|${client.nextActionAt}`;
    if (storedIds.has(legacyId) || covered.has(signature)) return;
    derived.push(
      legacyTask(snapshot, {
        id: legacyId,
        title: client.nextAction,
        description: `Следующее действие по клиенту «${client.companyName}»`,
        dueAt: client.nextActionAt,
        managerName: client.managerName,
        clientId: client.id,
        kind: "follow_up",
      }),
    );
  });

  snapshot.deals.forEach((deal) => {
    if (!deal.nextActionAt || !deal.nextAction) return;
    const legacyId = `legacy-deal-${deal.id}`;
    const signature = `${deal.clientId}|${deal.id}|${deal.nextAction}|${deal.nextActionAt}`;
    if (storedIds.has(legacyId) || covered.has(signature)) return;
    derived.push(
      legacyTask(snapshot, {
        id: legacyId,
        title: deal.nextAction,
        description: `Следующее действие по сделке «${deal.title}»`,
        dueAt: deal.nextActionAt,
        managerName: deal.managerName,
        clientId: deal.clientId,
        dealId: deal.id,
        kind: "follow_up",
      }),
    );
  });

  snapshot.interactions.forEach((interaction) => {
    if (!interaction.nextStepAt || !interaction.nextStep) return;
    const legacyId = `legacy-interaction-${interaction.id}`;
    const signature = `${interaction.clientId}||${interaction.nextStep}|${interaction.nextStepAt}`;
    if (storedIds.has(legacyId) || covered.has(signature)) return;
    derived.push(
      legacyTask(snapshot, {
        id: legacyId,
        title: interaction.nextStep,
        description: `Продолжение: ${interaction.subject}`,
        dueAt: interaction.nextStepAt,
        managerName: interaction.managerName,
        clientId: interaction.clientId,
        kind: "follow_up",
      }),
    );
  });

  return [...stored, ...derived];
}

function scopedTasks(
  tasks: Task[],
  currentUser: User,
  selectedUserId = currentUser.id,
) {
  if (currentUser.role !== "manager" || selectedUserId !== "all") {
    return tasks.filter(
      (task) =>
        task.assigneeId ===
        (currentUser.role === "manager" ? selectedUserId : currentUser.id),
    );
  }
  return tasks;
}

function scopedDeals(
  snapshot: CrmSnapshot,
  currentUser: User,
  selectedUserId = currentUser.id,
) {
  if (currentUser.role === "manager" && selectedUserId === "all") {
    return snapshot.deals;
  }
  const user =
    snapshot.users.find(
      (item) =>
        item.id ===
        (currentUser.role === "manager" ? selectedUserId : currentUser.id),
    ) ?? currentUser;
  return snapshot.deals.filter((deal) =>
    belongsToUser(deal, user, deal.managerName),
  );
}

function scopedClients(
  snapshot: CrmSnapshot,
  currentUser: User,
  selectedUserId = currentUser.id,
) {
  if (currentUser.role === "manager" && selectedUserId === "all") {
    return snapshot.clients;
  }
  const user =
    snapshot.users.find(
      (item) =>
        item.id ===
        (currentUser.role === "manager" ? selectedUserId : currentUser.id),
    ) ?? currentUser;
  return snapshot.clients.filter((client) =>
    belongsToUser(client, user, client.managerName),
  );
}

function scopedInteractions(
  snapshot: CrmSnapshot,
  currentUser: User,
  selectedUserId = currentUser.id,
) {
  if (currentUser.role === "manager" && selectedUserId === "all") {
    return snapshot.interactions;
  }
  const user =
    snapshot.users.find(
      (item) =>
        item.id ===
        (currentUser.role === "manager" ? selectedUserId : currentUser.id),
    ) ?? currentUser;
  return snapshot.interactions.filter(
    (interaction) =>
      ownerId(interaction) === user.id ||
      interaction.managerName === user.fullName,
  );
}

function persistTask(
  snapshot: CrmSnapshot,
  task: Task,
  onSnapshotChange: (next: CrmSnapshot) => void,
) {
  const index = snapshot.tasks.findIndex((item) => item.id === task.id);
  const nextTasks =
    index >= 0
      ? snapshot.tasks.map((item) => (item.id === task.id ? task : item))
      : [...snapshot.tasks, task];
  onSnapshotChange({ ...snapshot, tasks: nextTasks });
}

function getMonthDays(month: Date) {
  const first = startOfMonth(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getDueLabel(task: Task, today = startOfDay(new Date())) {
  const dueAt = safeDate(task.dueAt);
  if (!dueAt) return { text: "Без даты", tone: "neutral" };
  const diff = Math.round(
    (startOfDay(dueAt).getTime() - today.getTime()) / DAY_MS,
  );
  if (taskIsCompleted(task)) {
    return { text: "Выполнено", tone: "done" };
  }
  if (diff < 0) {
    return {
      text: `Просрочено · ${Math.abs(diff)} дн.`,
      tone: "danger",
    };
  }
  if (diff === 0) return { text: "Сегодня", tone: "today" };
  if (diff === 1) return { text: "Завтра", tone: "soon" };
  return { text: formatDate(task.dueAt), tone: "neutral" };
}

function getDealDate(
  deal: Deal,
  statusEvents: StatusEvent[],
  status?: string,
) {
  const matching = statusEvents
    .filter(
      (event) =>
        event.entityType === "deal" &&
        event.entityId === deal.id &&
        (!status || event.toStatus === status),
    )
    .sort(
      (left, right) =>
        new Date(right.changedAt).getTime() -
        new Date(left.changedAt).getTime(),
    );
  return (
    matching[0]?.changedAt ||
    readString(deal, "closedAt") ||
    deal.proposalDate ||
    recordCreatedAt(deal)
  );
}

function rangeStart(preset: RangePreset, now: Date) {
  if (preset === "all") return null;
  return addDays(startOfDay(now), -(Number(preset) - 1));
}

function withinRange(
  value: string | null | undefined,
  start: Date | null,
  end: Date,
) {
  if (!start) return true;
  const date = safeDate(value);
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("ru");
}

function plural(
  value: number,
  forms: [one: string, few: string, many: string],
) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return forms[1];
  }
  return forms[2];
}

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {name === "plus" && (
        <path {...common} d="M12 5v14M5 12h14" />
      )}
      {name === "check" && <path {...common} d="m5 12 4 4L19 7" />}
      {name === "close" && (
        <path {...common} d="m6 6 12 12M18 6 6 18" />
      )}
      {name === "edit" && (
        <>
          <path {...common} d="M4 20h4l11-11-4-4L4 16v4Z" />
          <path {...common} d="m13.8 6.2 4 4" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle {...common} cx="12" cy="12" r="8.5" />
          <path {...common} d="M12 7.5V12l3 2" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect {...common} x="3.5" y="5" width="17" height="15" rx="2" />
          <path {...common} d="M8 3v4M16 3v4M3.5 9.5h17" />
        </>
      )}
      {name === "arrow" && (
        <path {...common} d="M5 12h14m-5-5 5 5-5 5" />
      )}
      {name === "chevron-left" && (
        <path {...common} d="m15 5-7 7 7 7" />
      )}
      {name === "chevron-right" && (
        <path {...common} d="m9 5 7 7-7 7" />
      )}
      {name === "trend" && (
        <>
          <path {...common} d="m4 16 5-5 4 3 7-8" />
          <path {...common} d="M15 6h5v5" />
        </>
      )}
    </svg>
  );
}

function FeatureHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="wf-feature-header">
      <div>
        <span className="wf-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="wf-header-actions">{actions}</div> : null}
    </header>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="wf-empty">
      <span aria-hidden="true">00</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function FeatureSkeleton({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="wf-skeleton">
      <div className="wf-skeleton-heading" />
      <div className="wf-skeleton-metrics">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="wf-skeleton-body">
        <span />
        <span />
      </div>
    </section>
  );
}

function MissingIdentity() {
  return (
    <section className="wf-view">
      <EmptyState
        title="Не выбран пользователь"
        description="Выберите сотрудника в демо-профиле, чтобы открыть его рабочий кабинет."
      />
    </section>
  );
}

function useNotice() {
  const [notice, setNotice] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const showNotice = (message: string) => {
    setNotice(message);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(""), 2600);
  };

  return { notice, showNotice };
}

function Notice({ message }: { message: string }) {
  return (
    <div
      aria-live="polite"
      className={`wf-notice ${message ? "is-visible" : ""}`}
      role="status"
    >
      <Icon name="check" />
      {message}
    </div>
  );
}

function TaskRow({
  snapshot,
  task,
  currentUser,
  onSnapshotChange,
  onOpenClient,
  onOpenDeal,
  onEdit,
  onNotice,
  compact = false,
}: {
  snapshot: CrmSnapshot;
  task: Task;
  currentUser: User;
  onSnapshotChange: (snapshot: CrmSnapshot) => void;
  onOpenClient: (clientId: string) => void;
  onOpenDeal: (dealId: string) => void;
  onEdit?: (task: Task) => void;
  onNotice: (message: string) => void;
  compact?: boolean;
}) {
  const due = getDueLabel(task);
  const client = getTaskClient(snapshot, task);
  const deal = getTaskDeal(snapshot, task);
  const assignee = getTaskAssignee(snapshot, task);

  const updateStatus = () => {
    const completed = taskIsCompleted(task);
    const now = new Date().toISOString();
    persistTask(
      snapshot,
      {
        ...task,
        status: completed ? "open" : "completed",
        completedAt: completed ? null : now,
        updatedAt: now,
      },
      onSnapshotChange,
    );
    onNotice(completed ? "Задача возвращена в работу" : "Задача выполнена");
  };

  const snooze = (amount: number) => {
    const base = safeDate(task.dueAt) ?? new Date();
    const next = addDays(base, amount);
    persistTask(
      snapshot,
      {
        ...task,
        dueAt: next.toISOString(),
        status: "open",
        completedAt: null,
        updatedAt: new Date().toISOString(),
      },
      onSnapshotChange,
    );
    onNotice(amount === 1 ? "Перенесено на завтра" : "Перенесено на неделю");
  };

  return (
    <article
      className={`wf-task-row priority-${task.priority} ${
        taskIsCompleted(task) ? "is-completed" : ""
      } ${compact ? "is-compact" : ""}`}
    >
      <button
        aria-label={
          taskIsCompleted(task)
            ? `Вернуть задачу «${task.title}»`
            : `Выполнить задачу «${task.title}»`
        }
        className="wf-task-check"
        onClick={updateStatus}
        type="button"
      >
        {taskIsCompleted(task) ? <Icon name="check" /> : null}
      </button>
      <div className="wf-task-main">
        <header>
          <span className="wf-kind-mark">{TASK_KIND_SHORT[task.kind]}</span>
          <strong>{task.title}</strong>
          <span className={`wf-due tone-${due.tone}`}>{due.text}</span>
        </header>
        {!compact && task.description ? <p>{task.description}</p> : null}
        <footer>
          {task.dueAt ? (
            <time dateTime={task.dueAt}>
              <Icon name="clock" />
              {TIME_FORMATTER.format(safeDate(task.dueAt) ?? new Date())}
            </time>
          ) : null}
          {currentUser.role === "manager" && assignee ? (
            <span className="wf-inline-person">
              <i>{assignee.initials || initials(assignee.fullName)}</i>
              {assignee.fullName}
            </span>
          ) : null}
          {client ? (
            <button
              className="wf-link-button"
              onClick={() => onOpenClient(client.id)}
              type="button"
            >
              {client.companyName}
            </button>
          ) : null}
          {deal ? (
            <button
              className="wf-link-button"
              onClick={() => onOpenDeal(deal.id)}
              type="button"
            >
              {deal.id}
            </button>
          ) : null}
        </footer>
      </div>
      {!compact ? (
        <div className="wf-task-actions">
          {taskIsOpen(task) ? (
            <>
              <button
                aria-label="Перенести на завтра"
                onClick={() => snooze(1)}
                type="button"
              >
                +1 день
              </button>
              <button
                aria-label="Перенести на неделю"
                onClick={() => snooze(7)}
                type="button"
              >
                +7 дней
              </button>
            </>
          ) : null}
          {onEdit ? (
            <button
              aria-label={`Редактировать задачу «${task.title}»`}
              className="wf-icon-button"
              onClick={() => onEdit(task)}
              type="button"
            >
              <Icon name="edit" />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MetricCard({
  label,
  value,
  caption,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: "default" | "good" | "danger" | "accent";
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </>
  );

  return onClick ? (
    <button
      className={`wf-metric-card tone-${tone}`}
      onClick={onClick}
      type="button"
    >
      {content}
      <i>
        <Icon name="arrow" />
      </i>
    </button>
  ) : (
    <article className={`wf-metric-card tone-${tone}`}>{content}</article>
  );
}

export function DashboardView({
  snapshot,
  currentUser,
  onSnapshotChange,
  onOpenClient,
  onOpenDeal,
  loading = false,
}: WorkspaceFeatureProps) {
  const { notice, showNotice } = useNotice();
  const today = useMemo(() => startOfDay(new Date()), []);
  const allTasks = useMemo(() => getWorkspaceTasks(snapshot), [snapshot]);

  if (loading || !snapshot) {
    return <FeatureSkeleton label="Загрузка рабочего кабинета" />;
  }
  if (!currentUser) return <MissingIdentity />;

  const isManager = currentUser.role === "manager";
  const tasks = scopedTasks(
    allTasks,
    currentUser,
    isManager ? "all" : currentUser.id,
  );
  const deals = scopedDeals(
    snapshot,
    currentUser,
    isManager ? "all" : currentUser.id,
  );
  const clients = scopedClients(
    snapshot,
    currentUser,
    isManager ? "all" : currentUser.id,
  );
  const interactions = scopedInteractions(
    snapshot,
    currentUser,
    isManager ? "all" : currentUser.id,
  );
  const openTasks = tasks.filter(taskIsOpen);
  const overdueTasks = openTasks.filter((task) => taskIsOverdue(task, today));
  const todayTasks = openTasks.filter((task) => taskIsToday(task, today));
  const focusTasks = [...overdueTasks, ...todayTasks]
    .filter(
      (task, index, list) =>
        list.findIndex((candidate) => candidate.id === task.id) === index,
    )
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority === "high" ? -1 : right.priority === "high" ? 1 : 0;
      }
      return (
        (safeDate(left.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (safeDate(right.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, 6);
  const activeDeals = deals.filter(
    (deal) => !CLOSED_DEAL_STATUSES.has(deal.status),
  );
  const wonDeals = deals.filter((deal) => deal.status === "Закрыта успешно");
  const revenue = wonDeals.reduce((sum, deal) => sum + deal.ourPrice, 0);
  const pipeline = activeDeals.reduce((sum, deal) => sum + deal.ourPrice, 0);
  const margin = activeDeals.reduce((sum, deal) => sum + deal.margin, 0);
  const weekStart = addDays(today, -6);
  const weeklyInteractions = interactions.filter((interaction) =>
    withinRange(interaction.occurredAt, weekStart, addDays(today, 1)),
  );
  const newClients = clients.filter((client) =>
    withinRange(recordCreatedAt(client), weekStart, addDays(today, 1)),
  );
  const attentionClients = clients
    .filter(
      (client) =>
        !ownerId(client) ||
        (client.nextActionAt &&
          (safeDate(client.nextActionAt)?.getTime() ?? 0) < today.getTime()),
    )
    .slice(0, 5);
  const upcomingTasks = openTasks
    .filter((task) => {
      const due = safeDate(task.dueAt);
      return due && due.getTime() >= addDays(today, 1).getTime();
    })
    .sort(
      (left, right) =>
        (safeDate(left.dueAt)?.getTime() ?? 0) -
        (safeDate(right.dueAt)?.getTime() ?? 0),
    )
    .slice(0, 5);

  const teamRows = snapshot.users
    .filter((user) => user.isActive && user.role === "employee")
    .map((user) => {
      const userDeals = scopedDeals(snapshot, currentUser, user.id);
      const userTasks = allTasks.filter((task) => task.assigneeId === user.id);
      return {
        user,
        activeDeals: userDeals.filter(
          (deal) => !CLOSED_DEAL_STATUSES.has(deal.status),
        ).length,
        pipeline: userDeals
          .filter((deal) => !CLOSED_DEAL_STATUSES.has(deal.status))
          .reduce((sum, deal) => sum + deal.ourPrice, 0),
        overdue: userTasks.filter((task) => taskIsOverdue(task, today)).length,
      };
    })
    .sort(
      (left, right) =>
        right.overdue - left.overdue || right.pipeline - left.pipeline,
    );

  const pipelineRows = DEAL_PIPELINE.filter(
    (stage) => !stage.closed && stage.id !== "won",
  ).map((stage) => {
    const stageDeals = activeDeals.filter((deal) =>
      stage.statuses.includes(deal.status),
    );
    return {
      id: stage.id,
      label: stage.label,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, deal) => sum + deal.ourPrice, 0),
    };
  });
  const maxStageValue = Math.max(...pipelineRows.map((row) => row.value), 1);

  return (
    <section
      className={`wf-view wf-dashboard ${
        isManager ? "is-manager" : "is-employee"
      }`}
    >
      <FeatureHeader
        actions={
          <div className="wf-current-date">
            <Icon name="calendar" />
            <span>
              <small>Сегодня</small>
              {DAY_FORMATTER.format(today)}
            </span>
          </div>
        }
        description={
          isManager
            ? "Команда, выручка и точки внимания — в одном рабочем поле."
            : "Приоритеты на сегодня, личная воронка и ближайшие контакты."
        }
        eyebrow={isManager ? "Кабинет руководителя" : "Личный кабинет"}
        title={
          isManager
            ? `Добрый день, ${currentUser.fullName.split(" ")[0]}`
            : `Фокус на сегодня, ${currentUser.fullName.split(" ")[0]}`
        }
      />

      {clients.length === 0 && deals.length === 0 && tasks.length === 0 ? (
        <EmptyState
          title="Рабочее пространство пока пустое"
          description="Добавьте первого клиента или задачу — здесь появятся приоритеты, воронка и показатели."
        />
      ) : (
        <>
          <div className="wf-metric-grid">
            <MetricCard
              caption={
                isManager
                  ? `${wonDeals.length} успешных сделок`
                  : "по завершённым сделкам"
              }
              label={isManager ? "Выручка команды" : "Моя выручка"}
              tone="accent"
              value={formatCompactMoney(revenue)}
            />
            <MetricCard
              caption={`${activeDeals.length} ${plural(activeDeals.length, [
                "сделка",
                "сделки",
                "сделок",
              ])} в работе`}
              label="Активная воронка"
              value={formatCompactMoney(pipeline)}
            />
            <MetricCard
              caption={
                overdueTasks.length
                  ? "нужна реакция сегодня"
                  : "все сроки под контролем"
              }
              label="Просрочено"
              tone={overdueTasks.length ? "danger" : "good"}
              value={NUMBER_FORMATTER.format(overdueTasks.length)}
            />
            <MetricCard
              caption={`${weeklyInteractions.length} контактов за 7 дней`}
              label={isManager ? "Плановая маржа" : "Активность"}
              tone="good"
              value={
                isManager
                  ? formatCompactMoney(margin)
                  : NUMBER_FORMATTER.format(weeklyInteractions.length)
              }
            />
          </div>

          <div className="wf-dashboard-grid">
            <section className="wf-panel wf-focus-panel">
              <header className="wf-panel-heading">
                <div>
                  <span className="wf-eyebrow">Приоритеты</span>
                  <h2>
                    {isManager ? "Требует внимания" : "Сделать сегодня"}
                  </h2>
                </div>
                <span className="wf-panel-count">
                  {focusTasks.length.toString().padStart(2, "0")}
                </span>
              </header>
              {focusTasks.length ? (
                <div className="wf-task-list">
                  {focusTasks.map((task) => (
                    <TaskRow
                      compact
                      currentUser={currentUser}
                      key={task.id}
                      onNotice={showNotice}
                      onOpenClient={onOpenClient}
                      onOpenDeal={onOpenDeal}
                      onSnapshotChange={onSnapshotChange}
                      snapshot={snapshot}
                      task={task}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Срочных задач нет"
                  description="Можно перейти к ближайшим контактам или заняться развитием воронки."
                />
              )}
            </section>

            <section className="wf-panel wf-funnel-panel">
              <header className="wf-panel-heading">
                <div>
                  <span className="wf-eyebrow">Воронка</span>
                  <h2>{isManager ? "Коммерческий поток" : "Мои сделки"}</h2>
                </div>
                <span className="wf-panel-count">
                  {activeDeals.length.toString().padStart(2, "0")}
                </span>
              </header>
              <div className="wf-mini-funnel">
                {pipelineRows.map((row, index) => (
                  <div className="wf-mini-funnel-row" key={row.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <header>
                        <strong>{row.label}</strong>
                        <small>{row.count}</small>
                      </header>
                      <i>
                        <b
                          style={{
                            transform: `scaleX(${Math.max(
                              row.value / maxStageValue,
                              row.count ? 0.08 : 0,
                            )})`,
                          }}
                        />
                      </i>
                    </div>
                    <em>{formatCompactMoney(row.value)}</em>
                  </div>
                ))}
              </div>
            </section>

            {isManager ? (
              <section className="wf-panel wf-team-panel">
                <header className="wf-panel-heading">
                  <div>
                    <span className="wf-eyebrow">Команда</span>
                    <h2>Нагрузка сотрудников</h2>
                  </div>
                  <span className="wf-panel-count">
                    {teamRows.length.toString().padStart(2, "0")}
                  </span>
                </header>
                {teamRows.length ? (
                  <div className="wf-team-list">
                    {teamRows.map((row) => (
                      <article key={row.user.id}>
                        <span className="wf-avatar">
                          {row.user.initials || initials(row.user.fullName)}
                        </span>
                        <div>
                          <strong>{row.user.fullName}</strong>
                          <small>
                            {row.activeDeals} в работе ·{" "}
                            {formatCompactMoney(row.pipeline)}
                          </small>
                        </div>
                        <span
                          className={
                            row.overdue ? "wf-overdue-number" : "wf-zero-number"
                          }
                        >
                          {row.overdue}
                          <small>проср.</small>
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Нет активных сотрудников"
                    description="Добавьте сотрудников в команду, чтобы сравнивать нагрузку."
                  />
                )}
              </section>
            ) : (
              <section className="wf-panel wf-rhythm-panel">
                <header className="wf-panel-heading">
                  <div>
                    <span className="wf-eyebrow">Ритм недели</span>
                    <h2>Личная динамика</h2>
                  </div>
                  <span className="wf-trend-chip">
                    <Icon name="trend" />
                    7 дней
                  </span>
                </header>
                <dl className="wf-rhythm-stats">
                  <div>
                    <dt>Контакты</dt>
                    <dd>{weeklyInteractions.length}</dd>
                    <span>за неделю</span>
                  </div>
                  <div>
                    <dt>Новые клиенты</dt>
                    <dd>{newClients.length}</dd>
                    <span>в работе</span>
                  </div>
                  <div>
                    <dt>Маржа воронки</dt>
                    <dd>{formatCompactMoney(margin)}</dd>
                    <span>плановая</span>
                  </div>
                </dl>
              </section>
            )}

            <section className="wf-panel wf-upcoming-panel">
              <header className="wf-panel-heading">
                <div>
                  <span className="wf-eyebrow">
                    {isManager ? "Риски" : "Дальше"}
                  </span>
                  <h2>
                    {isManager ? "Клиенты без движения" : "Ближайшие задачи"}
                  </h2>
                </div>
              </header>
              {isManager ? (
                attentionClients.length ? (
                  <div className="wf-attention-list">
                    {attentionClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => onOpenClient(client.id)}
                        type="button"
                      >
                        <span
                          className={`wf-potential potential-${client.potential.toLocaleLowerCase()}`}
                        >
                          {client.potential}
                        </span>
                        <span>
                          <strong>{client.companyName}</strong>
                          <small>
                            {client.nextAction || "Не назначено действие"}
                          </small>
                        </span>
                        <time dateTime={client.nextActionAt ?? undefined}>
                          {formatDate(client.nextActionAt)}
                        </time>
                        <Icon name="arrow" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Рисков не найдено"
                    description="Все клиенты распределены, ближайшие действия назначены."
                  />
                )
              ) : upcomingTasks.length ? (
                <div className="wf-upcoming-list">
                  {upcomingTasks.map((task) => (
                    <TaskRow
                      compact
                      currentUser={currentUser}
                      key={task.id}
                      onNotice={showNotice}
                      onOpenClient={onOpenClient}
                      onOpenDeal={onOpenDeal}
                      onSnapshotChange={onSnapshotChange}
                      snapshot={snapshot}
                      task={task}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Ближайших задач нет"
                  description="Запланируйте следующий контакт в календаре."
                />
              )}
            </section>
          </div>
        </>
      )}
      <Notice message={notice} />
    </section>
  );
}

function CalendarDay({
  date,
  month,
  selectedKey,
  tasks,
  onSelect,
}: {
  date: Date;
  month: Date;
  selectedKey: string;
  tasks: Task[];
  onSelect: (date: Date) => void;
}) {
  const key = dateKey(date);
  const isSelected = key === selectedKey;
  const isToday = key === dateKey(new Date());
  const outside = date.getMonth() !== month.getMonth();
  const openCount = tasks.filter(taskIsOpen).length;
  const completedCount = tasks.filter(taskIsCompleted).length;

  return (
    <button
      aria-label={`${DAY_FORMATTER.format(date)}, ${tasks.length} задач`}
      aria-pressed={isSelected}
      className={`wf-calendar-day ${isSelected ? "is-selected" : ""} ${
        isToday ? "is-today" : ""
      } ${outside ? "is-outside" : ""}`}
      onClick={() => onSelect(date)}
      type="button"
    >
      <span className="wf-day-number">{date.getDate()}</span>
      <div className="wf-day-tasks" aria-hidden="true">
        {tasks.slice(0, 2).map((task) => (
          <span
            className={`kind-${task.kind} ${
              taskIsCompleted(task) ? "is-done" : ""
            }`}
            key={task.id}
          >
            <i>{TASK_KIND_SHORT[task.kind]}</i>
            {task.title}
          </span>
        ))}
        {tasks.length > 2 ? (
          <small>ещё {tasks.length - 2}</small>
        ) : null}
      </div>
      {tasks.length ? (
        <span className="wf-day-dots" aria-hidden="true">
          {openCount ? <i /> : null}
          {completedCount ? <i className="is-done" /> : null}
        </span>
      ) : null}
    </button>
  );
}

function TaskEditor({
  snapshot,
  currentUser,
  task,
  selectedDate,
  onClose,
  onSave,
}: {
  snapshot: CrmSnapshot;
  currentUser: User;
  task: Task | null;
  selectedDate: Date;
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const titleId = useId();
  const [error, setError] = useState("");
  const defaultDueAt = task?.dueAt
    ? localDateTimeValue(task.dueAt)
    : localDateTimeValue(
        new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          10,
        ).toISOString(),
      );
  const availableUsers = snapshot.users.filter((user) => user.isActive);
  const visibleClients =
    currentUser.role === "manager"
      ? snapshot.clients
      : snapshot.clients.filter((client) =>
          belongsToUser(client, currentUser, client.managerName),
        );
  const visibleDeals =
    currentUser.role === "manager"
      ? snapshot.deals
      : snapshot.deals.filter((deal) =>
          belongsToUser(deal, currentUser, deal.managerName),
        );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const dueAt = isoAtLocalTime(String(data.get("dueAt") ?? ""));
    if (!title) {
      setError("Укажите, что нужно сделать.");
      return;
    }
    if (!dueAt) {
      setError("Укажите дату и время.");
      return;
    }
    const now = new Date().toISOString();
    const next: Task = {
      id: task?.id ?? createId("TASK"),
      title,
      description: String(data.get("description") ?? "").trim(),
      kind: String(data.get("kind") ?? "reminder") as Task["kind"],
      status: task?.status ?? "open",
      priority: String(data.get("priority") ?? "normal") as Task["priority"],
      dueAt,
      completedAt: task?.completedAt ?? null,
      assigneeId:
        currentUser.role === "manager"
          ? String(data.get("assigneeId") || currentUser.id)
          : currentUser.id,
      createdById: task?.createdById ?? currentUser.id,
      clientId: String(data.get("clientId") || "") || null,
      dealId: String(data.get("dealId") || "") || null,
      contactId: task?.contactId ?? null,
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(next);
  };

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="wf-dialog-backdrop"
      role="dialog"
    >
      <form className="wf-task-editor" onSubmit={submit}>
        <header>
          <div>
            <span className="wf-eyebrow">
              {task ? "Редактирование" : "Новая задача"}
            </span>
            <h2 id={titleId}>
              {task ? "Обновить напоминание" : "Запланировать действие"}
            </h2>
          </div>
          <button
            aria-label="Закрыть"
            className="wf-dialog-close"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="wf-editor-grid">
          <label className="wf-field wf-field-wide">
            <span>Что нужно сделать</span>
            <input
              autoFocus
              defaultValue={task?.title ?? ""}
              name="title"
              placeholder="Например, уточнить объём партии"
              required
            />
          </label>
          <label className="wf-field">
            <span>Дата и время</span>
            <input
              defaultValue={defaultDueAt}
              name="dueAt"
              required
              type="datetime-local"
            />
          </label>
          <label className="wf-field">
            <span>Тип действия</span>
            <select defaultValue={task?.kind ?? "reminder"} name="kind">
              {Object.entries(TASK_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="wf-field">
            <span>Приоритет</span>
            <select defaultValue={task?.priority ?? "normal"} name="priority">
              {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {currentUser.role === "manager" ? (
            <label className="wf-field">
              <span>Ответственный</span>
              <select
                defaultValue={task?.assigneeId ?? currentUser.id}
                name="assigneeId"
              >
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="wf-field wf-readonly-field">
              <span>Ответственный</span>
              <strong>{currentUser.fullName}</strong>
            </div>
          )}
          <label className="wf-field">
            <span>Клиент</span>
            <select defaultValue={task?.clientId ?? ""} name="clientId">
              <option value="">Без привязки</option>
              {visibleClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </select>
          </label>
          <label className="wf-field">
            <span>Сделка</span>
            <select defaultValue={task?.dealId ?? ""} name="dealId">
              <option value="">Без привязки</option>
              {visibleDeals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </label>
          <label className="wf-field wf-field-wide">
            <span>Комментарий</span>
            <textarea
              defaultValue={task?.description ?? ""}
              name="description"
              placeholder="Контекст, договорённости или ожидаемый результат"
              rows={4}
            />
          </label>
          {error ? (
            <p className="wf-form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer>
          <button className="wf-secondary-button" onClick={onClose} type="button">
            Отмена
          </button>
          <button className="wf-primary-button" type="submit">
            <Icon name="check" />
            {task ? "Сохранить" : "Создать задачу"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function TaskFilters({
  snapshot,
  currentUser,
  assigneeId,
  state,
  link,
  kind,
  query,
  onAssigneeChange,
  onStateChange,
  onLinkChange,
  onKindChange,
  onQueryChange,
}: {
  snapshot: CrmSnapshot;
  currentUser: User;
  assigneeId: string;
  state: TaskStateFilter;
  link: TaskLinkFilter;
  kind: Task["kind"] | "all";
  query: string;
  onAssigneeChange: (value: string) => void;
  onStateChange: (value: TaskStateFilter) => void;
  onLinkChange: (value: TaskLinkFilter) => void;
  onKindChange: (value: Task["kind"] | "all") => void;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="wf-filter-bar">
      <label className="wf-search-field">
        <span className="wf-visually-hidden">Поиск задач</span>
        <input
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск задач"
          type="search"
          value={query}
        />
      </label>
      {currentUser.role === "manager" ? (
        <label>
          <span>Ответственный</span>
          <select
            onChange={(event) => onAssigneeChange(event.target.value)}
            value={assigneeId}
          >
            <option value="all">Вся команда</option>
            {snapshot.users
              .filter((user) => user.isActive)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      <label>
        <span>Статус</span>
        <select
          onChange={(event) =>
            onStateChange(event.target.value as TaskStateFilter)
          }
          value={state}
        >
          <option value="open">В работе</option>
          <option value="completed">Выполненные</option>
          <option value="all">Все</option>
        </select>
      </label>
      <label>
        <span>Связь</span>
        <select
          onChange={(event) =>
            onLinkChange(event.target.value as TaskLinkFilter)
          }
          value={link}
        >
          <option value="all">Все задачи</option>
          <option value="client">По клиентам</option>
          <option value="deal">По сделкам</option>
          <option value="general">Без привязки</option>
        </select>
      </label>
      <label>
        <span>Тип</span>
        <select
          onChange={(event) =>
            onKindChange(event.target.value as Task["kind"] | "all")
          }
          value={kind}
        >
          <option value="all">Все действия</option>
          {Object.entries(TASK_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function CalendarView({
  snapshot,
  currentUser,
  onSnapshotChange,
  onOpenClient,
  onOpenDeal,
  loading = false,
}: WorkspaceFeatureProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(today);
  const [mode, setMode] = useState<CalendarMode>("month");
  const [assigneeId, setAssigneeId] = useState("all");
  const [stateFilter, setStateFilter] = useState<TaskStateFilter>("open");
  const [linkFilter, setLinkFilter] = useState<TaskLinkFilter>("all");
  const [kindFilter, setKindFilter] = useState<Task["kind"] | "all">("all");
  const [query, setQuery] = useState("");
  const [editorTask, setEditorTask] = useState<Task | null | undefined>(
    undefined,
  );
  const { notice, showNotice } = useNotice();
  const allTasks = useMemo(() => getWorkspaceTasks(snapshot), [snapshot]);
  const monthDays = useMemo(() => getMonthDays(cursor), [cursor]);

  useEffect(() => {
    if (currentUser?.role !== "manager") {
      setAssigneeId(currentUser?.id ?? "all");
    }
  }, [currentUser]);

  const filteredTasks = useMemo(() => {
    if (!snapshot || !currentUser) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return scopedTasks(allTasks, currentUser, assigneeId)
      .filter((task) => {
        if (stateFilter !== "all" && task.status !== stateFilter) return false;
        if (kindFilter !== "all" && task.kind !== kindFilter) return false;
        if (linkFilter === "client" && !task.clientId) return false;
        if (linkFilter === "deal" && !task.dealId) return false;
        if (linkFilter === "general" && (task.clientId || task.dealId)) {
          return false;
        }
        if (
          normalizedQuery &&
          !`${task.title} ${task.description}`
            .toLocaleLowerCase("ru")
            .includes(normalizedQuery)
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (left, right) =>
          (safeDate(left.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (safeDate(right.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER),
      );
  }, [
    allTasks,
    assigneeId,
    currentUser,
    kindFilter,
    linkFilter,
    query,
    snapshot,
    stateFilter,
  ]);

  if (loading || !snapshot) {
    return <FeatureSkeleton label="Загрузка календаря" />;
  }
  if (!currentUser) return <MissingIdentity />;

  const selectedKey = dateKey(selectedDate);
  const selectedTasks = filteredTasks.filter((task) => {
    const dueAt = safeDate(task.dueAt);
    return dueAt && dateKey(dueAt) === selectedKey;
  });
  const openTotal = scopedTasks(allTasks, currentUser, assigneeId).filter(
    taskIsOpen,
  );
  const overdueTotal = openTotal.filter((task) =>
    taskIsOverdue(task, today),
  ).length;
  const agendaGroups = filteredTasks.reduce<Array<[string, Task[]]>>(
    (groups, task) => {
      const dueAt = safeDate(task.dueAt);
      const key = dueAt ? dateKey(dueAt) : "none";
      const last = groups.at(-1);
      if (last?.[0] === key) {
        last[1].push(task);
      } else {
        groups.push([key, [task]]);
      }
      return groups;
    },
    [],
  );

  const tasksForDay = (day: Date) => {
    const key = dateKey(day);
    return filteredTasks.filter((task) => {
      const dueAt = safeDate(task.dueAt);
      return dueAt && dateKey(dueAt) === key;
    });
  };

  const selectToday = () => {
    setCursor(startOfMonth(today));
    setSelectedDate(today);
  };

  const saveTask = (task: Task) => {
    persistTask(snapshot, task, onSnapshotChange);
    setEditorTask(undefined);
    showNotice(
      snapshot.tasks.some((item) => item.id === task.id)
        ? "Изменения сохранены"
        : "Задача добавлена в календарь",
    );
  };

  return (
    <section className="wf-view wf-calendar-view">
      <FeatureHeader
        actions={
          <button
            className="wf-primary-button"
            onClick={() => setEditorTask(null)}
            type="button"
          >
            <Icon name="plus" />
            Новая задача
          </button>
        }
        description="Напоминания по клиентам и сделкам, сроки команды и быстрый перенос задач."
        eyebrow="Планирование"
        title="Календарь"
      />

      <div className="wf-calendar-summary" aria-label="Сводка задач">
        <span>
          <strong>{openTotal.length}</strong>
          в работе
        </span>
        <span className={overdueTotal ? "is-danger" : ""}>
          <strong>{overdueTotal}</strong>
          просрочено
        </span>
        <span>
          <strong>{tasksForDay(today).length}</strong>
          на сегодня
        </span>
      </div>

      <TaskFilters
        assigneeId={assigneeId}
        currentUser={currentUser}
        kind={kindFilter}
        link={linkFilter}
        onAssigneeChange={setAssigneeId}
        onKindChange={setKindFilter}
        onLinkChange={setLinkFilter}
        onQueryChange={setQuery}
        onStateChange={setStateFilter}
        query={query}
        snapshot={snapshot}
        state={stateFilter}
      />

      <div className="wf-calendar-toolbar">
        <div className="wf-calendar-navigation">
          <button
            aria-label="Предыдущий месяц"
            className="wf-icon-button"
            onClick={() => setCursor((value) => addMonths(value, -1))}
            type="button"
          >
            <Icon name="chevron-left" />
          </button>
          <button
            aria-label="Следующий месяц"
            className="wf-icon-button"
            onClick={() => setCursor((value) => addMonths(value, 1))}
            type="button"
          >
            <Icon name="chevron-right" />
          </button>
          <button
            className="wf-today-button"
            onClick={selectToday}
            type="button"
          >
            Сегодня
          </button>
          <h2>{MONTH_FORMATTER.format(cursor)}</h2>
        </div>
        <div aria-label="Режим календаря" className="wf-segmented" role="group">
          <button
            aria-pressed={mode === "month"}
            className={mode === "month" ? "is-active" : ""}
            onClick={() => setMode("month")}
            type="button"
          >
            Месяц
          </button>
          <button
            aria-pressed={mode === "agenda"}
            className={mode === "agenda" ? "is-active" : ""}
            onClick={() => setMode("agenda")}
            type="button"
          >
            Повестка
          </button>
        </div>
      </div>

      {mode === "month" ? (
        <div className="wf-calendar-layout">
          <section className="wf-month-card" aria-label="Календарь на месяц">
            <div className="wf-weekday-row" aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="wf-month-grid">
              {monthDays.map((day) => (
                <CalendarDay
                  date={day}
                  key={dateKey(day)}
                  month={cursor}
                  onSelect={(value) => {
                    setSelectedDate(value);
                    if (value.getMonth() !== cursor.getMonth()) {
                      setCursor(startOfMonth(value));
                    }
                  }}
                  selectedKey={selectedKey}
                  tasks={tasksForDay(day)}
                />
              ))}
            </div>
          </section>

          <aside className="wf-day-agenda" aria-label="Задачи выбранного дня">
            <header>
              <div>
                <span className="wf-eyebrow">Выбранный день</span>
                <h2>{DAY_FORMATTER.format(selectedDate)}</h2>
              </div>
              <button
                aria-label="Добавить задачу на выбранный день"
                className="wf-icon-button is-accent"
                onClick={() => setEditorTask(null)}
                type="button"
              >
                <Icon name="plus" />
              </button>
            </header>
            {selectedTasks.length ? (
              <div className="wf-day-task-list">
                {selectedTasks.map((task) => (
                  <TaskRow
                    currentUser={currentUser}
                    key={task.id}
                    onEdit={setEditorTask}
                    onNotice={showNotice}
                    onOpenClient={onOpenClient}
                    onOpenDeal={onOpenDeal}
                    onSnapshotChange={onSnapshotChange}
                    snapshot={snapshot}
                    task={task}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                action={
                  <button
                    className="wf-text-action"
                    onClick={() => setEditorTask(null)}
                    type="button"
                  >
                    Запланировать действие
                    <Icon name="arrow" />
                  </button>
                }
                description="На выбранную дату ничего не запланировано."
                title="Свободный день"
              />
            )}
          </aside>
        </div>
      ) : (
        <section className="wf-agenda-view">
          <header>
            <div>
              <span className="wf-eyebrow">Лента задач</span>
              <h2>Повестка</h2>
            </div>
            <span>
              {filteredTasks.length}{" "}
              {plural(filteredTasks.length, ["задача", "задачи", "задач"])}
            </span>
          </header>
          {agendaGroups.length ? (
            <div className="wf-agenda-groups">
              {agendaGroups.map(([key, tasks]) => {
                const groupDate =
                  key === "none"
                    ? null
                    : safeDate(`${key}T12:00:00`);
                return (
                  <section key={key}>
                    <header>
                      <time dateTime={key === "none" ? undefined : key}>
                        {groupDate ? DAY_FORMATTER.format(groupDate) : "Без даты"}
                      </time>
                      <span>{tasks.length}</span>
                    </header>
                    <div>
                      {tasks.map((task) => (
                        <TaskRow
                          currentUser={currentUser}
                          key={task.id}
                          onEdit={setEditorTask}
                          onNotice={showNotice}
                          onOpenClient={onOpenClient}
                          onOpenDeal={onOpenDeal}
                          onSnapshotChange={onSnapshotChange}
                          snapshot={snapshot}
                          task={task}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <EmptyState
              action={
                <button
                  className="wf-primary-button"
                  onClick={() => setEditorTask(null)}
                  type="button"
                >
                  <Icon name="plus" />
                  Создать задачу
                </button>
              }
              description="Измените фильтры или добавьте первое напоминание."
              title="Задач не найдено"
            />
          )}
        </section>
      )}

      {editorTask !== undefined ? (
        <TaskEditor
          currentUser={currentUser}
          onClose={() => setEditorTask(undefined)}
          onSave={saveTask}
          selectedDate={selectedDate}
          snapshot={snapshot}
          task={editorTask}
        />
      ) : null}
      <Notice message={notice} />
    </section>
  );
}

function StatisticsFilters({
  snapshot,
  currentUser,
  range,
  assigneeId,
  onRangeChange,
  onAssigneeChange,
}: {
  snapshot: CrmSnapshot;
  currentUser: User;
  range: RangePreset;
  assigneeId: string;
  onRangeChange: (range: RangePreset) => void;
  onAssigneeChange: (assigneeId: string) => void;
}) {
  return (
    <div className="wf-stat-filters">
      <label>
        <span>Период</span>
        <select
          onChange={(event) =>
            onRangeChange(event.target.value as RangePreset)
          }
          value={range}
        >
          <option value="7">7 дней</option>
          <option value="30">30 дней</option>
          <option value="90">90 дней</option>
          <option value="all">Всё время</option>
        </select>
      </label>
      {currentUser.role === "manager" ? (
        <label>
          <span>Сотрудник</span>
          <select
            onChange={(event) => onAssigneeChange(event.target.value)}
            value={assigneeId}
          >
            <option value="all">Вся команда</option>
            {snapshot.users
              .filter((user) => user.isActive)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function BarChart({
  points,
  valueFormatter = formatCompactMoney,
  emptyLabel,
}: {
  points: Array<{ label: string; value: number; secondary?: number }>;
  valueFormatter?: (value: number) => string;
  emptyLabel: string;
}) {
  const max = Math.max(...points.map((point) => point.value), 0);
  if (!points.length || max === 0) {
    return (
      <EmptyState
        description="Данные появятся после первых завершённых действий."
        title={emptyLabel}
      />
    );
  }

  return (
    <div className="wf-bar-chart" role="img" aria-label="График показателей">
      {points.map((point) => (
        <div className="wf-bar-column" key={point.label}>
          <span className="wf-bar-value">{valueFormatter(point.value)}</span>
          <div>
            <i
              style={{
                transform: `scaleY(${
                  point.value > 0 ? Math.max(point.value / max, 0.035) : 0
                })`,
              }}
            />
            {point.secondary ? (
              <b
                style={{
                  transform: `scaleY(${Math.max(
                    point.secondary > 0 ? point.secondary / max : 0,
                    point.secondary > 0 ? 0.025 : 0,
                  )})`,
                }}
              />
            ) : null}
          </div>
          <small>{point.label}</small>
        </div>
      ))}
    </div>
  );
}

function DrillPanel({
  state,
  onClose,
  onOpenClient,
  onOpenDeal,
}: {
  state: DrillState;
  onClose: () => void;
  onOpenClient: (clientId: string) => void;
  onOpenDeal: (dealId: string) => void;
}) {
  const titleId = useId();
  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="wf-dialog-backdrop"
      role="dialog"
    >
      <aside className="wf-drill-panel">
        <header>
          <div>
            <span className="wf-eyebrow">{state.eyebrow}</span>
            <h2 id={titleId}>{state.title}</h2>
            <p>
              {state.rows.length}{" "}
              {plural(state.rows.length, ["запись", "записи", "записей"])}
            </p>
          </div>
          <button
            aria-label="Закрыть"
            className="wf-dialog-close"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="wf-drill-list">
          {state.rows.length ? (
            state.rows.map((row) => {
              const open = () => {
                if (row.entity === "client" && row.entityId) {
                  onOpenClient(row.entityId);
                }
                if (row.entity === "deal" && row.entityId) {
                  onOpenDeal(row.entityId);
                }
              };
              return row.entity ? (
                <button key={row.id} onClick={open} type="button">
                  <span>
                    <strong>{row.primary}</strong>
                    <small>{row.secondary}</small>
                  </span>
                  <em>{row.meta}</em>
                  <Icon name="arrow" />
                </button>
              ) : (
                <article key={row.id}>
                  <span>
                    <strong>{row.primary}</strong>
                    <small>{row.secondary}</small>
                  </span>
                  <em>{row.meta}</em>
                </article>
              );
            })
          ) : (
            <EmptyState
              description="В выбранном периоде подходящих записей нет."
              title="Список пуст"
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function buildTimeBuckets(
  range: RangePreset,
  start: Date | null,
  end: Date,
  deals: Deal[],
  events: StatusEvent[],
) {
  const bucketCount = range === "7" ? 7 : range === "30" ? 6 : 6;
  const spanDays =
    range === "7" ? 1 : range === "30" ? 5 : range === "90" ? 15 : 30;
  const effectiveStart =
    start ?? addDays(startOfDay(end), -(bucketCount * spanDays - 1));

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = addDays(effectiveStart, index * spanDays);
    const bucketEnd = addDays(bucketStart, spanDays);
    const bucketDeals = deals.filter((deal) => {
      const closedAt = getDealDate(deal, events, "Закрыта успешно");
      const date = safeDate(closedAt);
      return (
        deal.status === "Закрыта успешно" &&
        date &&
        date.getTime() >= bucketStart.getTime() &&
        date.getTime() < bucketEnd.getTime()
      );
    });
    return {
      label:
        range === "7"
          ? new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(
              bucketStart,
            )
          : SHORT_DATE_FORMATTER.format(bucketStart),
      value: bucketDeals.reduce((sum, deal) => sum + deal.ourPrice, 0),
      secondary: bucketDeals.reduce((sum, deal) => sum + deal.margin, 0),
    };
  });
}

function interactionRows(
  interactions: Interaction[],
  snapshot: CrmSnapshot,
): DrillRow[] {
  return interactions.map((interaction) => {
    const client = snapshot.clients.find(
      (item) => item.id === interaction.clientId,
    );
    return {
      id: interaction.id,
      primary: interaction.subject,
      secondary: client?.companyName ?? interaction.kind,
      meta: formatDate(interaction.occurredAt, true),
      entity: "client",
      entityId: interaction.clientId,
    };
  });
}

export function StatisticsView({
  snapshot,
  currentUser,
  onOpenClient,
  onOpenDeal,
  loading = false,
}: WorkspaceFeatureProps) {
  const [tab, setTab] = useState<StatisticsTab>("overview");
  const [range, setRange] = useState<RangePreset>("30");
  const [assigneeId, setAssigneeId] = useState("all");
  const [drill, setDrill] = useState<DrillState | null>(null);
  const now = useMemo(() => new Date(), []);
  const allTasks = useMemo(() => getWorkspaceTasks(snapshot), [snapshot]);

  useEffect(() => {
    if (currentUser?.role !== "manager") {
      setAssigneeId(currentUser?.id ?? "all");
    }
  }, [currentUser]);

  if (loading || !snapshot) {
    return <FeatureSkeleton label="Загрузка статистики" />;
  }
  if (!currentUser) return <MissingIdentity />;

  const start = rangeStart(range, now);
  const end = addDays(startOfDay(now), 1);
  const allScopedDeals = scopedDeals(snapshot, currentUser, assigneeId);
  const allScopedInteractions = scopedInteractions(
    snapshot,
    currentUser,
    assigneeId,
  );
  const allScopedTasks = scopedTasks(allTasks, currentUser, assigneeId);
  const scopedDealIds = new Set(allScopedDeals.map((deal) => deal.id));
  const events = snapshot.statusEvents.filter(
    (event) =>
      event.entityType === "deal" &&
      scopedDealIds.has(event.entityId) &&
      withinRange(event.changedAt, start, end),
  );
  const deals = allScopedDeals.filter((deal) =>
    withinRange(recordCreatedAt(deal), start, end),
  );
  const interactions = allScopedInteractions.filter((interaction) =>
    withinRange(interaction.occurredAt, start, end),
  );
  const tasks = allScopedTasks.filter((task) =>
    withinRange(task.completedAt || task.createdAt, start, end),
  );
  const wonDeals = allScopedDeals.filter(
    (deal) =>
      deal.status === "Закрыта успешно" &&
      withinRange(
        getDealDate(deal, snapshot.statusEvents, "Закрыта успешно"),
        start,
        end,
      ),
  );
  const revenue = wonDeals.reduce((sum, deal) => sum + deal.ourPrice, 0);
  const wonMargin = wonDeals.reduce((sum, deal) => sum + deal.margin, 0);
  const activeDeals = allScopedDeals.filter(
    (deal) => !CLOSED_DEAL_STATUSES.has(deal.status),
  );
  const pipeline = activeDeals.reduce((sum, deal) => sum + deal.ourPrice, 0);
  const completedTasks = tasks.filter(taskIsCompleted);
  const overdueTasks = allScopedTasks.filter((task) => taskIsOverdue(task));
  const enteredDealIds = new Set(
    events
      .filter(
        (event) =>
          event.fromStatus === null || event.toStatus === "Новая заявка",
      )
      .map((event) => event.entityId),
  );
  const wonEventDealIds = new Set(
    events
      .filter((event) => event.toStatus === "Закрыта успешно")
      .map((event) => event.entityId),
  );
  const conversionWins = wonEventDealIds.size || wonDeals.length;
  const conversionBase = Math.max(
    enteredDealIds.size || deals.length,
    conversionWins,
  );
  const conversion = conversionBase
    ? (conversionWins / conversionBase) * 100
    : 0;
  const chartPoints = buildTimeBuckets(
    range,
    start,
    now,
    wonDeals,
    snapshot.statusEvents,
  );
  const targets = snapshot.targets.filter((target) => {
    if (target.metric !== "revenue") return false;
    if (currentUser.role === "manager" && assigneeId === "all") {
      return target.scope === "team";
    }
    return (
      target.scope === "user" &&
      target.subjectId ===
        (currentUser.role === "manager" ? assigneeId : currentUser.id)
    );
  });
  const revenueTarget = targets.at(-1)?.targetValue ?? 0;

  const dealRows = (items: Deal[]): DrillRow[] =>
    items.map((deal) => ({
      id: deal.id,
      primary: deal.title,
      secondary:
        snapshot.clients.find((client) => client.id === deal.clientId)
          ?.companyName ?? deal.status,
      meta: formatMoney(deal.ourPrice),
      entity: "deal",
      entityId: deal.id,
    }));

  const taskRows = (items: Task[]): DrillRow[] =>
    items.map((task) => ({
      id: task.id,
      primary: task.title,
      secondary:
        getTaskClient(snapshot, task)?.companyName ??
        TASK_KIND_LABELS[task.kind],
      meta: formatDate(task.dueAt, true),
      entity: task.dealId ? "deal" : task.clientId ? "client" : undefined,
      entityId: task.dealId ?? task.clientId ?? undefined,
    }));

  const openDrill = (
    title: string,
    eyebrow: string,
    rows: DrillRow[],
  ) => {
    setDrill({ title, eyebrow, rows });
  };

  const funnelRows = DEAL_PIPELINE.map((stage) => {
    const stageDeals = allScopedDeals.filter((deal) =>
      stage.statuses.includes(deal.status),
    );
    return {
      ...stage,
      deals: stageDeals,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, deal) => sum + deal.ourPrice, 0),
      margin: stageDeals.reduce((sum, deal) => sum + deal.margin, 0),
    };
  });
  const funnelBase = Math.max(funnelRows[0]?.count ?? 0, 1);
  const maxFunnelCount = Math.max(...funnelRows.map((row) => row.count), 1);

  const activityKinds = Object.entries(
    interactions.reduce<Record<string, Interaction[]>>((groups, item) => {
      (groups[item.kind] ??= []).push(item);
      return groups;
    }, {}),
  )
    .map(([kind, items]) => ({ kind, items, count: items.length }))
    .sort((left, right) => right.count - left.count);
  const maxActivity = Math.max(
    ...activityKinds.map((item) => item.count),
    completedTasks.length,
    1,
  );

  const teamRows = snapshot.users
    .filter((user) => user.isActive && user.role === "employee")
    .map((user) => {
      const userDeals = scopedDeals(snapshot, currentUser, user.id);
      const userInteractions = scopedInteractions(snapshot, currentUser, user.id)
        .filter((item) => withinRange(item.occurredAt, start, end));
      const userTasks = allTasks.filter((task) => task.assigneeId === user.id);
      const userWon = userDeals.filter(
        (deal) =>
          deal.status === "Закрыта успешно" &&
          withinRange(
            getDealDate(deal, snapshot.statusEvents, "Закрыта успешно"),
            start,
            end,
          ),
      );
      return {
        user,
        deals: userDeals,
        won: userWon.length,
        revenue: userWon.reduce((sum, deal) => sum + deal.ourPrice, 0),
        margin: userWon.reduce((sum, deal) => sum + deal.margin, 0),
        activities: userInteractions.length,
        overdue: userTasks.filter((task) => taskIsOverdue(task)).length,
      };
    })
    .sort((left, right) => right.revenue - left.revenue);
  const maxTeamRevenue = Math.max(...teamRows.map((row) => row.revenue), 1);

  const tabs: Array<{ id: StatisticsTab; label: string }> = [
    { id: "overview", label: "Обзор" },
    { id: "funnel", label: "Воронка" },
    { id: "sales", label: "Продажи" },
    { id: "activity", label: "Активность" },
    {
      id: "team",
      label: currentUser.role === "manager" ? "Команда" : "Мои KPI",
    },
  ];

  return (
    <section className="wf-view wf-statistics-view">
      <FeatureHeader
        actions={
          <StatisticsFilters
            assigneeId={assigneeId}
            currentUser={currentUser}
            onAssigneeChange={setAssigneeId}
            onRangeChange={setRange}
            range={range}
            snapshot={snapshot}
          />
        }
        description={
          currentUser.role === "manager"
            ? "Результаты команды, движение воронки и детализация до каждой записи."
            : "Личная динамика продаж, активности и выполнения задач."
        }
        eyebrow="Аналитика"
        title="Статистика"
      />

      <nav aria-label="Разделы статистики" className="wf-stat-tabs">
        {tabs.map((item) => (
          <button
            aria-current={tab === item.id ? "page" : undefined}
            className={tab === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="wf-stat-section">
          <div className="wf-metric-grid">
            <MetricCard
              caption={`${wonDeals.length} успешных сделок`}
              label="Выручка"
              onClick={() =>
                openDrill("Выручка за период", "Успешные сделки", dealRows(wonDeals))
              }
              tone="accent"
              value={formatCompactMoney(revenue)}
            />
            <MetricCard
              caption={`${activeDeals.length} активных сделок`}
              label="Воронка сейчас"
              onClick={() =>
                openDrill(
                  "Активная воронка",
                  "Сделки в работе",
                  dealRows(activeDeals),
                )
              }
              value={formatCompactMoney(pipeline)}
            />
            <MetricCard
              caption={`${formatCompactMoney(wonMargin)} валовой маржи`}
              label="Конверсия"
              onClick={() =>
                openDrill(
                  "Закрытые успешно",
                  "Конверсия",
                  dealRows(wonDeals),
                )
              }
              tone="good"
              value={formatPercent(conversion)}
            />
            <MetricCard
              caption="требуют реакции"
              label="Просроченные задачи"
              onClick={() =>
                openDrill(
                  "Просроченные задачи",
                  "Контроль сроков",
                  taskRows(overdueTasks),
                )
              }
              tone={overdueTasks.length ? "danger" : "good"}
              value={NUMBER_FORMATTER.format(overdueTasks.length)}
            />
          </div>

          <div className="wf-stat-overview-grid">
            <section className="wf-panel wf-chart-panel">
              <header className="wf-panel-heading">
                <div>
                  <span className="wf-eyebrow">Динамика</span>
                  <h2>Выручка и маржа</h2>
                </div>
                <div className="wf-chart-legend">
                  <span><i />Выручка</span>
                  <span><i />Маржа</span>
                </div>
              </header>
              <BarChart
                emptyLabel="Продаж за период нет"
                points={chartPoints}
              />
            </section>

            <section className="wf-panel wf-score-panel">
              <header className="wf-panel-heading">
                <div>
                  <span className="wf-eyebrow">Рабочий ритм</span>
                  <h2>Действия за период</h2>
                </div>
              </header>
              <dl>
                <button
                  onClick={() =>
                    openDrill(
                      "Все взаимодействия",
                      "Активность",
                      interactionRows(interactions, snapshot),
                    )
                  }
                  type="button"
                >
                  <dt>Контакты</dt>
                  <dd>{interactions.length}</dd>
                  <span>звонки, письма и встречи</span>
                </button>
                <button
                  onClick={() =>
                    openDrill(
                      "Выполненные задачи",
                      "Дисциплина",
                      taskRows(completedTasks),
                    )
                  }
                  type="button"
                >
                  <dt>Задачи</dt>
                  <dd>{completedTasks.length}</dd>
                  <span>завершено за период</span>
                </button>
                <div>
                  <dt>Маржа</dt>
                  <dd>{formatCompactMoney(wonMargin)}</dd>
                  <span>по успешным сделкам</span>
                </div>
              </dl>
            </section>
          </div>
        </div>
      ) : null}

      {tab === "funnel" ? (
        <section className="wf-stat-section wf-funnel-section">
          <header className="wf-section-intro">
            <div>
              <span className="wf-eyebrow">Текущее состояние</span>
              <h2>Коммерческая воронка</h2>
              <p>
                Нажмите на этап, чтобы открыть сделки, из которых рассчитан
                показатель.
              </p>
            </div>
            <dl>
              <div>
                <dt>В работе</dt>
                <dd>{activeDeals.length}</dd>
              </div>
              <div>
                <dt>Объём</dt>
                <dd>{formatCompactMoney(pipeline)}</dd>
              </div>
            </dl>
          </header>
          {allScopedDeals.length ? (
            <div className="wf-funnel-table" role="list">
              {funnelRows.map((row, index) => (
                <button
                  key={row.id}
                  onClick={() =>
                    openDrill(
                      row.label,
                      "Сделки этапа",
                      dealRows(row.deals),
                    )
                  }
                  role="listitem"
                  type="button"
                >
                  <span className="wf-stage-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="wf-stage-name">
                    <strong>{row.label}</strong>
                    <small>{row.statuses.join(" · ")}</small>
                  </span>
                  <span className="wf-stage-bar">
                    <i
                      style={{
                        transform: `scaleX(${Math.max(
                          row.count / maxFunnelCount,
                          row.count ? 0.04 : 0,
                        )})`,
                      }}
                    />
                  </span>
                  <span className="wf-stage-count">{row.count}</span>
                  <span className="wf-stage-value">
                    <strong>{formatCompactMoney(row.value)}</strong>
                    <small>{formatCompactMoney(row.margin)} маржи</small>
                  </span>
                  <span className="wf-stage-conversion">
                    {formatPercent((row.count / funnelBase) * 100)}
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Добавьте сделки или измените фильтр сотрудника."
              title="Воронка пока пуста"
            />
          )}
        </section>
      ) : null}

      {tab === "sales" ? (
        <div className="wf-stat-section wf-sales-grid">
          <section className="wf-panel wf-sales-hero">
            <header>
              <div>
                <span className="wf-eyebrow">Результат периода</span>
                <h2>{formatMoney(revenue)}</h2>
                <p>
                  {wonDeals.length}{" "}
                  {plural(wonDeals.length, ["сделка", "сделки", "сделок"])} ·{" "}
                  {formatMoney(wonMargin)} маржи
                </p>
              </div>
              <span className="wf-sales-mark">
                <Icon name="trend" />
              </span>
            </header>
            {revenueTarget > 0 ? (
              <div className="wf-target-progress">
                <header>
                  <span>Выполнение плана</span>
                  <strong>
                    {formatPercent((revenue / revenueTarget) * 100)}
                  </strong>
                </header>
                <i>
                  <b
                    style={{
                      transform: `scaleX(${Math.min(
                        revenue / revenueTarget,
                        1,
                      )})`,
                    }}
                  />
                </i>
                <footer>
                  <span>{formatCompactMoney(revenue)}</span>
                  <span>план {formatCompactMoney(revenueTarget)}</span>
                </footer>
              </div>
            ) : (
              <p className="wf-no-target">
                План продаж не задан. Руководитель может добавить его в данных
                команды.
              </p>
            )}
          </section>
          <section className="wf-panel wf-chart-panel">
            <header className="wf-panel-heading">
              <div>
                <span className="wf-eyebrow">По времени</span>
                <h2>Динамика продаж</h2>
              </div>
            </header>
            <BarChart
              emptyLabel="Продаж за период нет"
              points={chartPoints}
            />
          </section>
          <section className="wf-panel wf-won-list">
            <header className="wf-panel-heading">
              <div>
                <span className="wf-eyebrow">Закрыто успешно</span>
                <h2>Последние продажи</h2>
              </div>
              <span className="wf-panel-count">
                {wonDeals.length.toString().padStart(2, "0")}
              </span>
            </header>
            {wonDeals.length ? (
              <div>
                {wonDeals.slice(0, 8).map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => onOpenDeal(deal.id)}
                    type="button"
                  >
                    <span>
                      <strong>{deal.title}</strong>
                      <small>
                        {
                          snapshot.clients.find(
                            (client) => client.id === deal.clientId,
                          )?.companyName
                        }
                      </small>
                    </span>
                    <span>
                      <strong>{formatMoney(deal.ourPrice)}</strong>
                      <small>{formatMoney(deal.margin)} маржи</small>
                    </span>
                    <Icon name="arrow" />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Успешные сделки выбранного периода появятся здесь."
                title="Продаж пока нет"
              />
            )}
          </section>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="wf-stat-section wf-activity-grid">
          <section className="wf-panel wf-activity-bars">
            <header className="wf-panel-heading">
              <div>
                <span className="wf-eyebrow">Каналы</span>
                <h2>Структура активности</h2>
              </div>
              <span className="wf-panel-count">
                {interactions.length.toString().padStart(2, "0")}
              </span>
            </header>
            {activityKinds.length ? (
              <div>
                {activityKinds.map((item) => (
                  <button
                    key={item.kind}
                    onClick={() =>
                      openDrill(
                        item.kind,
                        "Взаимодействия",
                        interactionRows(item.items, snapshot),
                      )
                    }
                    type="button"
                  >
                    <span>{item.kind}</span>
                    <i>
                      <b
                        style={{
                          transform: `scaleX(${item.count / maxActivity})`,
                        }}
                      />
                    </i>
                    <strong>{item.count}</strong>
                    <Icon name="arrow" />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                description="За выбранный период взаимодействий не найдено."
                title="Активности пока нет"
              />
            )}
          </section>
          <section className="wf-panel wf-discipline-panel">
            <header className="wf-panel-heading">
              <div>
                <span className="wf-eyebrow">Дисциплина</span>
                <h2>Исполнение задач</h2>
              </div>
            </header>
            <div className="wf-discipline-score">
              <strong>
                {formatPercent(
                  tasks.length ? (completedTasks.length / tasks.length) * 100 : 0,
                )}
              </strong>
              <span>задач завершено</span>
              <i>
                <b
                  style={{
                    transform: `scaleX(${
                      tasks.length ? completedTasks.length / tasks.length : 0
                    })`,
                  }}
                />
              </i>
            </div>
            <dl>
              <button
                onClick={() =>
                  openDrill(
                    "Выполненные задачи",
                    "Дисциплина",
                    taskRows(completedTasks),
                  )
                }
                type="button"
              >
                <dt>Выполнено</dt>
                <dd>{completedTasks.length}</dd>
              </button>
              <button
                onClick={() =>
                  openDrill(
                    "Просроченные задачи",
                    "Контроль сроков",
                    taskRows(overdueTasks),
                  )
                }
                type="button"
              >
                <dt>Просрочено</dt>
                <dd className={overdueTasks.length ? "is-danger" : ""}>
                  {overdueTasks.length}
                </dd>
              </button>
            </dl>
          </section>
        </div>
      ) : null}

      {tab === "team" ? (
        <section className="wf-stat-section wf-team-stat">
          <header className="wf-section-intro">
            <div>
              <span className="wf-eyebrow">
                {currentUser.role === "manager" ? "Сравнение" : "Личный срез"}
              </span>
              <h2>
                {currentUser.role === "manager"
                  ? "Результаты команды"
                  : "Мои показатели"}
              </h2>
              <p>
                Выручка, активность и просрочки за выбранный период.
              </p>
            </div>
          </header>
          {teamRows.length ? (
            <div className="wf-team-stat-table">
              <div className="wf-team-stat-head" aria-hidden="true">
                <span>Сотрудник</span>
                <span>Выручка</span>
                <span>Сделки</span>
                <span>Активность</span>
                <span>Просрочено</span>
              </div>
              {teamRows
                .filter(
                  (row) =>
                    currentUser.role === "manager" ||
                    row.user.id === currentUser.id,
                )
                .map((row, index) => (
                  <button
                    key={row.user.id}
                    onClick={() =>
                      openDrill(
                        row.user.fullName,
                        "Сделки сотрудника",
                        dealRows(row.deals),
                      )
                    }
                    type="button"
                  >
                    <span className="wf-team-person">
                      <i>{row.user.initials || initials(row.user.fullName)}</i>
                      <span>
                        <strong>{row.user.fullName}</strong>
                        <small>{row.user.jobTitle}</small>
                      </span>
                    </span>
                    <span className="wf-team-revenue">
                      <strong>{formatCompactMoney(row.revenue)}</strong>
                      <i>
                        <b
                          style={{
                            transform: `scaleX(${row.revenue / maxTeamRevenue})`,
                          }}
                        />
                      </i>
                    </span>
                    <span>
                      <strong>{row.won}</strong>
                      <small>успешно</small>
                    </span>
                    <span>
                      <strong>{row.activities}</strong>
                      <small>контактов</small>
                    </span>
                    <span
                      className={row.overdue ? "is-danger" : "is-positive"}
                    >
                      <strong>{row.overdue}</strong>
                      <small>задач</small>
                    </span>
                    <span className="wf-rank">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon name="arrow" />
                  </button>
                ))}
            </div>
          ) : (
            <EmptyState
              description="Показатели появятся после первых сделок и контактов."
              title="Нет данных для сравнения"
            />
          )}
        </section>
      ) : null}

      {drill ? (
        <DrillPanel
          onClose={() => setDrill(null)}
          onOpenClient={onOpenClient}
          onOpenDeal={onOpenDeal}
          state={drill}
        />
      ) : null}
    </section>
  );
}
