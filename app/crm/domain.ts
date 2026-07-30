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

/** Вид упаковки — верхний уровень технического брифа. */
export const PACKAGING_TYPES = [
  "Гофроящик",
  "Лоток",
  "Обечайка",
  "Короб с крышкой",
  "Вкладыш / решётка",
  "Листовой гофрокартон",
  "Другое",
] as const;

/** Конструкции FEFCO, которые встречаются в заявках чаще всего. */
export const FEFCO_CODES = [
  "0201",
  "0203",
  "0215",
  "0300",
  "0310",
  "0401",
  "0402",
  "0409",
  "0426",
  "0427",
  "0470",
  "0711",
] as const;

export const CARDBOARD_GRADES = [
  "Т-21",
  "Т-22",
  "Т-23",
  "Т-24",
  "П-31",
  "П-32",
  "П-33",
  "П-34",
] as const;

export const FLUTE_PROFILES = [
  "E (микрогофра)",
  "B",
  "C",
  "BC",
  "BE",
  "T (наногофра)",
] as const;

export const PRINT_METHODS = [
  "Без печати",
  "Флексопечать",
  "Офсет (кашировка)",
  "Цифровая печать",
  "Трафарет",
] as const;

export const COATINGS = [
  "Без покрытия",
  "Лак",
  "Ламинация",
  "Влагостойкая пропитка",
  "Парафинирование",
] as const;

export const PACKING_METHODS = [
  "Не уточнено",
  "Вручную",
  "На линии",
  "Смешанно",
] as const;

export type PackingMethod = (typeof PACKING_METHODS)[number];

/** Материалы, которые нужно получить от клиента до расчёта цены. */
export const BRIEF_ASSET_KINDS = [
  "drawing",
  "photo",
  "spec",
  "sample",
] as const;

export type BriefAssetKind = (typeof BRIEF_ASSET_KINDS)[number];

export const BRIEF_ASSET_LABELS: Record<BriefAssetKind, string> = {
  drawing: "Чертёж",
  photo: "Фотография",
  spec: "ТЗ",
  sample: "Образец",
};

export type BriefAssetStatus = "missing" | "requested" | "received";

export const BRIEF_ASSET_STATUS_LABELS: Record<BriefAssetStatus, string> = {
  missing: "Нет",
  requested: "Запрошен",
  received: "Получен",
};

export interface BriefAsset {
  status: BriefAssetStatus;
  /** Ссылка на файл или пометка, где материал лежит: хранилища файлов нет. */
  note: string;
}

/** Габариты в миллиметрах: длина × ширина × высота. */
export interface BriefDimensions {
  length: number | null;
  width: number | null;
  height: number | null;
}

/**
 * Технический бриф сделки: то, без чего нельзя считать цену гофроупаковки.
 * Живёт на сделке, заполняется на статусах «Уточняем ТЗ» и «Считаем цену».
 */
export interface DealBrief {
  packagingType: string;
  fefco: string;
  innerDimensions: BriefDimensions;
  outerDimensions: BriefDimensions;
  cardboardGrade: string;
  fluteProfile: string;
  printMethod: string;
  printColors: number | null;
  coating: string;
  /** Объём одной партии, свободный текст: «24 тыс. шт.». */
  batchVolume: string;
  monthlyVolume: string;
  annualVolume: string;
  packingMethod: PackingMethod;
  loadRequirement: string;
  storageRequirement: string;
  palletizing: string;
  currentSupplier: string;
  /** Текущая цена клиента за единицу, RUB. */
  currentPrice: number | null;
  clientProblem: string;
  assets: Record<BriefAssetKind, BriefAsset>;
  updatedAt: string | null;
}

export const createEmptyDimensions = (): BriefDimensions => ({
  length: null,
  width: null,
  height: null,
});

export const createEmptyDealBrief = (): DealBrief => ({
  packagingType: "",
  fefco: "",
  innerDimensions: createEmptyDimensions(),
  outerDimensions: createEmptyDimensions(),
  cardboardGrade: "",
  fluteProfile: "",
  printMethod: "",
  printColors: null,
  coating: "",
  batchVolume: "",
  monthlyVolume: "",
  annualVolume: "",
  packingMethod: "Не уточнено",
  loadRequirement: "",
  storageRequirement: "",
  palletizing: "",
  currentSupplier: "",
  currentPrice: null,
  clientProblem: "",
  assets: {
    drawing: { status: "missing", note: "" },
    photo: { status: "missing", note: "" },
    spec: { status: "missing", note: "" },
    sample: { status: "missing", note: "" },
  },
  updatedAt: null,
});

export const hasDimensions = (dimensions: BriefDimensions): boolean =>
  dimensions.length !== null ||
  dimensions.width !== null ||
  dimensions.height !== null;

/**
 * Заполненность брифа для индикатора в карточке сделки:
 * 19 полей плюс четыре материала от клиента.
 */
export const getDealBriefCompletion = (
  brief: DealBrief,
): { filled: number; total: number } => {
  const text = [
    brief.packagingType,
    brief.fefco,
    brief.cardboardGrade,
    brief.fluteProfile,
    brief.printMethod,
    brief.coating,
    brief.batchVolume,
    brief.monthlyVolume,
    brief.annualVolume,
    brief.loadRequirement,
    brief.storageRequirement,
    brief.palletizing,
    brief.currentSupplier,
    brief.clientProblem,
  ].filter((value) => value.trim().length > 0).length;

  const checks = [
    hasDimensions(brief.innerDimensions),
    hasDimensions(brief.outerDimensions),
    // Без печати количество красок уточнять не нужно.
    brief.printMethod === "Без печати" || brief.printColors !== null,
    brief.packingMethod !== "Не уточнено",
    brief.currentPrice !== null,
    ...BRIEF_ASSET_KINDS.map(
      (kind) => brief.assets[kind].status === "received",
    ),
  ].filter(Boolean).length;

  return { filled: text + checks, total: 23 };
};

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
  brief: DealBrief;
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
export type TaskSource =
  | "manual"
  | "client"
  | "deal"
  | "interaction"
  | "imported";

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

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
  source: TaskSource;
  sourceId: string | null;
  checklist: TaskChecklistItem[];
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
