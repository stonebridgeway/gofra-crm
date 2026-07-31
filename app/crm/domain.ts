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

export const CRM_SCHEMA_VERSION = 3 as const;
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

/**
 * Статусы, из которых достоверно следует, что КП уже уходило клиенту.
 * «Проиграна», «Отложена» и «Отменена» сюда не входят: сделка может
 * закрыться на любой стадии, в том числе до расчёта.
 */
export const SENT_IMPLYING_STATUSES: readonly DealStatus[] = [
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
];

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

/**
 * Вехи процесса расчёта, образца и КП. Дорожка идёт параллельно статусу сделки:
 * образец могут делать, пока считается цена, поэтому порядок не навязывается.
 */
export const DEAL_PROCESS_STEPS = [
  "specReceived",
  "calculationRequested",
  "calculationReceived",
  "sampleProduced",
  "sampleSent",
  "sampleApproved",
  "quoteSent",
] as const;

export type DealProcessStep = (typeof DEAL_PROCESS_STEPS)[number];

export const DEAL_PROCESS_STEP_LABELS: Record<DealProcessStep, string> = {
  specReceived: "ТЗ получено",
  calculationRequested: "Расчёт запрошен",
  calculationReceived: "Расчёт получен",
  sampleProduced: "Образец изготовлен",
  sampleSent: "Образец отправлен",
  sampleApproved: "Образец согласован",
  quoteSent: "КП отправлено",
};

/** Вехи образца: исключаются целиком, если образец в сделке не нужен. */
export const SAMPLE_STEPS: readonly DealProcessStep[] = [
  "sampleProduced",
  "sampleSent",
  "sampleApproved",
];

export interface DealProcessMilestone {
  /** ISO-дата факта. null — веха не пройдена. */
  completedAt: string | null;
  completedById: string | null;
  note: string;
}

export interface DealProcess {
  steps: Record<DealProcessStep, DealProcessMilestone>;
  /** Ответ клиента ожидается до этой даты, ISO. Ставится вместе с отправкой КП. */
  replyExpectedAt: string | null;
  /** Образец не требуется: три вехи образца скрыты и не участвуют в счётчике. */
  sampleSkipped: boolean;
  updatedAt: string | null;
}

const createEmptyMilestone = (): DealProcessMilestone => ({
  completedAt: null,
  completedById: null,
  note: "",
});

export const createEmptyDealProcess = (): DealProcess => ({
  steps: {
    specReceived: createEmptyMilestone(),
    calculationRequested: createEmptyMilestone(),
    calculationReceived: createEmptyMilestone(),
    sampleProduced: createEmptyMilestone(),
    sampleSent: createEmptyMilestone(),
    sampleApproved: createEmptyMilestone(),
    quoteSent: createEmptyMilestone(),
  },
  replyExpectedAt: null,
  sampleSkipped: false,
  updatedAt: null,
});

/** Вехи, которые реально учитываются: без образца их четыре, с образцом семь. */
export const getActiveProcessSteps = (
  process: DealProcess,
): readonly DealProcessStep[] =>
  process.sampleSkipped
    ? DEAL_PROCESS_STEPS.filter((step) => !SAMPLE_STEPS.includes(step))
    : DEAL_PROCESS_STEPS;

/** Счётчик для индикатора в карточке, по образцу getDealBriefCompletion. */
export const getDealProcessCompletion = (
  process: DealProcess,
): { filled: number; total: number } => {
  const steps = getActiveProcessSteps(process);

  return {
    filled: steps.filter((step) => process.steps[step].completedAt !== null)
      .length,
    total: steps.length,
  };
};

/** Какие вехи считаются пройденными, если сделка добралась до статуса. */
export const getImpliedProcessSteps = (
  status: DealStatus,
): readonly DealProcessStep[] => {
  if (SENT_IMPLYING_STATUSES.includes(status)) {
    return [
      "specReceived",
      "calculationRequested",
      "calculationReceived",
      "quoteSent",
    ];
  }
  if (status === "Считаем цену") {
    return ["specReceived", "calculationRequested"];
  }
  if (status === "Уточняем ТЗ") {
    return ["specReceived"];
  }

  return [];
};

export const QUOTE_STATUSES = [
  "Черновик",
  "Отправлено",
  "Принято",
  "Отклонено",
  "Заменено",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/**
 * Версия коммерческого предложения. После отправки замораживается:
 * изменение цены оформляется новой версией с обязательной причиной.
 */
export interface Quote extends TimestampedEntity {
  id: string;
  dealId: string;
  version: number;
  status: QuoteStatus;
  /** Выручка, RUB — сумма, которую платит клиент. */
  revenue: number;
  /** Себестоимость, RUB — закупка у производителя. */
  cost: number;
  /** Логистика, RUB. */
  logistics: number;
  /** Объём партии, свободный текст: «24 тыс. шт.» — как в брифе. */
  volume: string;
  /** Срок действия КП, ISO-дата. */
  validUntil: string | null;
  /** Причина изменения. Обязательна начиная со второй версии. */
  changeReason: string;
  sentAt: string | null;
  authorId: string;
  comment: string;
}

export const getQuoteMargin = (
  quote: Pick<Quote, "revenue" | "cost" | "logistics">,
): number => quote.revenue - quote.cost - quote.logistics;

/** Процент от выручки, один знак после запятой. При нулевой выручке — 0. */
export const getQuoteMarginPercent = (
  quote: Pick<Quote, "revenue" | "cost" | "logistics">,
): number => {
  if (quote.revenue === 0) return 0;

  return Math.round((getQuoteMargin(quote) / quote.revenue) * 1000) / 10;
};

/**
 * Однозначные термины вместо прежней «Нашей цены»: она не отличалась
 * от «Цены клиенту» ничем понятным.
 */
export const ECONOMICS_LABELS = {
  revenue: "Выручка",
  cost: "Себестоимость",
  logistics: "Логистика",
  margin: "Маржа",
} as const;

export interface DealEconomics {
  revenue: number;
  cost: number;
  logistics: number;
  margin: number;
  marginPercent: number;
}

export const EMPTY_DEAL_ECONOMICS: DealEconomics = {
  revenue: 0,
  cost: 0,
  logistics: 0,
  margin: 0,
  marginPercent: 0,
};

/**
 * Единственная точка чтения денег сделки: экраны не джойнят КП вручную.
 * У сделки без активного КП возвращает нули — воронка продолжает считаться.
 */
export const getDealEconomics = (
  deal: { activeQuoteId: string | null },
  quotes: readonly Quote[],
): DealEconomics => {
  if (!deal.activeQuoteId) return EMPTY_DEAL_ECONOMICS;

  const quote = quotes.find((candidate) => candidate.id === deal.activeQuoteId);
  if (!quote) return EMPTY_DEAL_ECONOMICS;

  return {
    revenue: quote.revenue,
    cost: quote.cost,
    logistics: quote.logistics,
    margin: getQuoteMargin(quote),
    marginPercent: getQuoteMarginPercent(quote),
  };
};

export interface Deal extends OwnedEntity {
  id: string;
  clientId: string;
  contactId: string | null;
  title: string;
  product: string;
  volume: string;
  status: DealStatus;
  brief: DealBrief;
  /** Дорожка вех расчёта, образца и КП. */
  process: DealProcess;
  /** Активная версия КП — источник денег сделки. */
  activeQuoteId: string | null;
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
  quotes: Quote[];
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
