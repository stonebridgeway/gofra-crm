export const CLIENT_STATUSES = [
  "Новый лид",
  "Нужно проверить",
  "Подходит",
  "Не подходит",
  "Контакт найден",
  "Первый контакт",
  "Есть интерес",
  "Запросили потребность",
  "Нужно КП",
  "КП отправлено",
  "Переговоры",
  "Тестовая поставка",
  "Активный клиент",
  "Спящий клиент",
  "Отказ",
  "Черный список",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const DEAL_STATUSES = [
  "Новая заявка",
  "Уточняем ТЗ",
  "Считаем цену",
  "КП отправлено",
  "Переговоры",
  "Согласование условий",
  "Счет выставлен",
  "Ожидаем оплату",
  "Оплачено",
  "В закупке / производстве",
  "Готово к отгрузке",
  "Отгружено",
  "Закрыта успешно",
  "Проиграна",
  "Отложена",
  "Отменена",
] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];
export type Potential = "A" | "B" | "C" | "D";

export const CRM_SCHEMA_VERSION = 2 as const;
export type CrmSchemaVersion = typeof CRM_SCHEMA_VERSION;

export interface TimestampedEntity {
  createdAt: string;
  updatedAt: string;
}

export type UserRole = "manager" | "employee";

export interface Team extends TimestampedEntity {
  id: string;
  name: string;
}

export interface User extends TimestampedEntity {
  id: string;
  teamId: string;
  fullName: string;
  email: string;
  role: UserRole;
  jobTitle: string;
  initials: string;
  isActive: boolean;
}

export interface Session {
  id: string;
  currentUserId: string;
  activeTeamId: string;
  startedAt: string;
}

export interface OwnedEntity extends TimestampedEntity {
  ownerId: string;
}

export type PipelineGroup = {
  id: string;
  label: string;
  statuses: readonly string[];
  closed?: boolean;
};

export const CLIENT_PIPELINE: readonly PipelineGroup[] = [
  { id: "unassigned", label: "Без статуса", statuses: ["Без статуса"] },
  {
    id: "selection",
    label: "Отбор",
    statuses: ["Новый лид", "Нужно проверить", "Подходит"],
  },
  {
    id: "contact",
    label: "Контакт",
    statuses: ["Контакт найден", "Первый контакт"],
  },
  {
    id: "need",
    label: "Потребность",
    statuses: ["Есть интерес", "Запросили потребность"],
  },
  {
    id: "offer",
    label: "Предложение",
    statuses: ["Нужно КП", "КП отправлено"],
  },
  {
    id: "negotiation",
    label: "Переговоры",
    statuses: ["Переговоры", "Тестовая поставка"],
  },
  {
    id: "clients",
    label: "Клиенты",
    statuses: ["Активный клиент", "Спящий клиент"],
  },
  {
    id: "closed",
    label: "Закрыто",
    statuses: ["Не подходит", "Отказ", "Черный список"],
    closed: true,
  },
] as const;

export const DEAL_PIPELINE: readonly PipelineGroup[] = [
  { id: "incoming", label: "Входящие", statuses: ["Новая заявка"] },
  {
    id: "calculation",
    label: "Расчёт",
    statuses: ["Уточняем ТЗ", "Считаем цену"],
  },
  {
    id: "proposal",
    label: "Предложение",
    statuses: ["КП отправлено", "Переговоры", "Согласование условий"],
  },
  {
    id: "payment",
    label: "Оплата",
    statuses: ["Счет выставлен", "Ожидаем оплату", "Оплачено"],
  },
  {
    id: "execution",
    label: "Исполнение",
    statuses: [
      "В закупке / производстве",
      "Готово к отгрузке",
      "Отгружено",
    ],
  },
  { id: "won", label: "Результат", statuses: ["Закрыта успешно"] },
  {
    id: "closed",
    label: "Закрыто",
    statuses: ["Проиграна", "Отложена", "Отменена"],
    closed: true,
  },
] as const;

export interface Client extends OwnedEntity {
  id: string;
  companyName: string;
  inn: string;
  region: string;
  city: string;
  industry: string;
  produces: string;
  mayPurchase: string;
  potential: Potential;
  status: ClientStatus | null;
  source: string;
  managerName: string;
  lastContactAt: string | null;
  nextAction: string;
  nextActionAt: string | null;
  comment: string;
}

export interface Contact extends OwnedEntity {
  id: string;
  clientId: string;
  fullName: string;
  role: string;
  phone: string;
  email: string;
  comment: string;
}

export interface Deal extends OwnedEntity {
  id: string;
  clientId: string;
  contactId: string | null;
  title: string;
  product: string;
  volume: string;
  clientPrice: number;
  ourPrice: number;
  purchasePrice: number;
  logistics: number;
  margin: number;
  marginPercent: number;
  status: DealStatus;
  proposalDate: string | null;
  nextAction: string;
  nextActionAt: string | null;
  managerName: string;
  comment: string;
}

export type InteractionKind =
  | "Звонок"
  | "Email"
  | "WhatsApp"
  | "Telegram"
  | "Встреча"
  | "Повторный звонок"
  | "Отправка КП"
  | "Получение ТЗ"
  | "Другое";

export interface Interaction extends OwnedEntity {
  id: string;
  occurredAt: string;
  clientId: string;
  contactId: string | null;
  kind: InteractionKind;
  subject: string;
  result: string;
  nextStep: string;
  nextStepAt: string | null;
  managerName: string;
  comment: string;
}

export type TaskKind =
  | "call"
  | "meeting"
  | "email"
  | "proposal"
  | "follow_up"
  | "reminder"
  | "other";

export type TaskStatus = "open" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";

/**
 * A task is the canonical source for calendar entries and reminders.
 * The legacy nextAction/nextStep fields remain on CRM records for display
 * compatibility, but new calendar features should read and write this entity.
 */
export interface Task extends TimestampedEntity {
  id: string;
  title: string;
  description: string;
  kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  assigneeId: string;
  createdById: string;
  clientId: string | null;
  dealId: string | null;
  contactId: string | null;
}

/** Reminder is a compatibility alias; tasks remain the single persisted model. */
export type Reminder = Task;

export type StatusEntityType = "client" | "deal";

export interface StatusEvent extends TimestampedEntity {
  id: string;
  entityType: StatusEntityType;
  entityId: string;
  fromStatus: string | null;
  toStatus: string | null;
  changedById: string;
  changedAt: string;
}

export type TargetScope = "user" | "team";
export type TargetMetric =
  | "revenue"
  | "margin"
  | "deals_won"
  | "new_clients"
  | "activities";
export type TargetUnit = "RUB" | "count";

export interface Target extends TimestampedEntity {
  id: string;
  scope: TargetScope;
  subjectId: string;
  metric: TargetMetric;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  unit: TargetUnit;
}

export interface Dictionaries {
  potentials: string[];
  industries: string[];
  productTypes: string[];
  sources: string[];
  interactionTypes: InteractionKind[];
}

export interface CrmSnapshot {
  schemaVersion: CrmSchemaVersion;
  teams: Team[];
  users: User[];
  session: Session;
  clients: Client[];
  contacts: Contact[];
  deals: Deal[];
  interactions: Interaction[];
  tasks: Task[];
  statusEvents: StatusEvent[];
  targets: Target[];
  dictionaries: Dictionaries;
}

export type AppModule =
  | "dashboard"
  | "clients"
  | "deals"
  | "contacts"
  | "activity"
  | "calendar"
  | "statistics"
  | "chat"
  | "import"
  | "dictionaries";
