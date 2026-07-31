import {
  CLIENT_STATUSES,
  CRM_SCHEMA_VERSION,
  DEAL_STATUSES,
  createEmptyDealBrief,
  createEmptyDealProcess,
  type Client,
  type Contact,
  type CrmSnapshot,
  type Deal,
  type DealBrief,
  type DealProcess,
  type Interaction,
  type Quote,
  type Potential,
  type Session,
  type StatusEvent,
  type Target,
  type Task,
  type Team,
  type User,
} from "./domain.ts";

export const DEMO_TEAM_ID = "team-gofra";
export const DEMO_USER_IDS = {
  sofia: "user-sofia",
  nikolai: "user-nikolai",
  timur: "user-timur",
  maria: "user-maria",
} as const;

const DEMO_CREATED_AT = "2026-06-01T08:00:00.000Z";
const DEMO_UPDATED_AT = "2026-07-23T08:00:00.000Z";

/**
 * Данные команды зафиксированы на конец июля 2026 года, а рабочий стол
 * менеджера показывает списки на сегодня. Поэтому записи Марии строятся
 * относительно текущей даты — иначе все пять списков были бы пустыми.
 */
const offsetDate = (days: number, hour = 9, minute = 0) => {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + days,
    hour,
    minute,
  );
};

const offsetIso = (days: number, hour = 9, minute = 0) =>
  offsetDate(days, hour, minute).toISOString();

const offsetDay = (days: number) => {
  const date = offsetDate(days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

export const demoTeams: Team[] = [
  {
    id: DEMO_TEAM_ID,
    name: "Команда ГОФРА",
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_UPDATED_AT,
  },
];

export const demoUsers: User[] = [
  {
    id: DEMO_USER_IDS.sofia,
    teamId: DEMO_TEAM_ID,
    fullName: "Софья Романова",
    email: "sofia@gofra.demo",
    role: "manager",
    jobTitle: "Руководитель отдела продаж",
    initials: "СР",
    isActive: true,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_UPDATED_AT,
  },
  {
    id: DEMO_USER_IDS.nikolai,
    teamId: DEMO_TEAM_ID,
    fullName: "Николай Ветров",
    email: "nikolai@gofra.demo",
    role: "employee",
    jobTitle: "Менеджер по продажам",
    initials: "НВ",
    isActive: true,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_UPDATED_AT,
  },
  {
    id: DEMO_USER_IDS.timur,
    teamId: DEMO_TEAM_ID,
    fullName: "Тимур Агапов",
    email: "timur@gofra.demo",
    role: "employee",
    jobTitle: "Менеджер по продажам",
    initials: "ТА",
    isActive: true,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_UPDATED_AT,
  },
  {
    id: DEMO_USER_IDS.maria,
    teamId: DEMO_TEAM_ID,
    fullName: "Мария Кольцова",
    email: "maria@gofra.demo",
    role: "employee",
    jobTitle: "Менеджер по продажам",
    initials: "МК",
    isActive: true,
    createdAt: "2026-07-06T08:00:00.000Z",
    updatedAt: DEMO_UPDATED_AT,
  },
];

export const demoSession: Session = {
  id: "session-demo",
  currentUserId: DEMO_USER_IDS.sofia,
  activeTeamId: DEMO_TEAM_ID,
  startedAt: DEMO_UPDATED_AT,
};

const companies = [
  "Северная мануфактура",
  "Линия вкуса",
  "Балтийские напитки",
  "ТерраФорм",
  "Волга Молоко",
  "Уральский кондитер",
  "Чистый дом",
  "МаркетХаб",
  "Вектор Фарм",
  "АгроПтица",
  "ПромСнаб Групп",
  "Каспий Фуд",
  "Лесная кухня",
  "Белая ферма",
  "Орбита Косметикс",
  "Городской склад",
  "Новая пекарня",
] as const;

const cities = [
  ["Москва", "Москва"],
  ["Санкт-Петербург", "Санкт-Петербург"],
  ["Самарская область", "Самара"],
  ["Свердловская область", "Екатеринбург"],
  ["Республика Татарстан", "Казань"],
  ["Новосибирская область", "Новосибирск"],
] as const;

const industries = [
  "Пищевая промышленность",
  "Напитки",
  "Молочная продукция",
  "Кондитерка",
  "Бытовая химия",
  "Фармацевтика",
] as const;

const managers = [
  "Софья Романова",
  "Николай Ветров",
  "Тимур Агапов",
] as const;

const managerIds = [
  DEMO_USER_IDS.sofia,
  DEMO_USER_IDS.nikolai,
  DEMO_USER_IDS.timur,
] as const;

const sources = [
  "2ГИС",
  "Сайт компании",
  "Холодный звонок",
  "Выставка",
  "Рекомендация",
] as const;

const potentials: Potential[] = ["A", "B", "C", "D"];

const clientsFromStatuses: Client[] = CLIENT_STATUSES.map((status, index) => {
  const [region, city] = cities[index % cities.length];
  const closed = ["Не подходит", "Отказ", "Черный список"].includes(status);

  return {
    id: `КЛ-${String(1042 + index).padStart(4, "0")}`,
    companyName: companies[index],
    inn: `${7705001000 + index * 137}`,
    region,
    city,
    industry: industries[index % industries.length],
    produces:
      index % 2 === 0
        ? "Продукты повседневного спроса"
        : "Товары в индивидуальной упаковке",
    mayPurchase:
      index % 3 === 0
        ? "Гофроящики с печатью"
        : index % 3 === 1
          ? "Гофрокартон листовой"
          : "Транспортная упаковка",
    potential: potentials[index % potentials.length],
    status,
    source: sources[index % sources.length],
    ownerId: managerIds[index % managerIds.length],
    managerName: managers[index % managers.length],
    createdAt: `2026-06-${String(2 + index).padStart(2, "0")}T08:00:00.000Z`,
    updatedAt: `2026-07-${String(9 + (index % 12)).padStart(2, "0")}T10:30:00.000Z`,
    lastContactAt: `2026-07-${String(9 + (index % 12)).padStart(2, "0")}T10:30:00.000Z`,
    nextAction: closed
      ? ""
      : [
          "Уточнить объём на квартал",
          "Запросить техническое задание",
          "Согласовать тестовый образец",
          "Отправить расчёт логистики",
        ][index % 4],
    nextActionAt: closed
      ? null
      : `2026-07-${String(23 + (index % 6)).padStart(2, "0")}T${
          9 + (index % 7)
        }:00:00.000Z`,
    comment:
      index % 2 === 0
        ? "Важны сроки поставки и стабильность партии."
        : "Нужен расчёт под несколько типоразмеров.",
  };
});

const MARIA_NAME = "Мария Кольцова";

/**
 * Портфель Марии собран так, чтобы её рабочий стол показал все пять списков:
 * просроченное действие, задачу на сегодня, сделку без следующего шага,
 * молчание после КП и приближающийся повторный заказ.
 */
const mariaClients: Client[] = [
  {
    id: "КЛ-1061",
    companyName: "Ижевский комбинат",
    inn: "1831045720",
    region: "Удмуртская Республика",
    city: "Ижевск",
    industry: "Пищевая промышленность",
    produces: "Полуфабрикаты глубокой заморозки",
    mayPurchase: "Гофроящики с печатью",
    potential: "B",
    status: "Переговоры",
    source: "Выставка",
    ownerId: DEMO_USER_IDS.maria,
    managerName: MARIA_NAME,
    createdAt: offsetIso(-38),
    updatedAt: offsetIso(-6, 14),
    lastContactAt: offsetIso(-6, 14),
    nextAction: "Позвонить по итогам тестового образца",
    nextActionAt: offsetIso(-2, 11),
    comment: "Ждут подтверждение по срокам печати.",
  },
  {
    id: "КЛ-1062",
    companyName: "Сибирская пекарня",
    inn: "5405317889",
    region: "Новосибирская область",
    city: "Новосибирск",
    industry: "Кондитерка",
    produces: "Хлеб и кондитерские изделия",
    mayPurchase: "Лотки и транспортная упаковка",
    potential: "A",
    status: "Активный клиент",
    source: "Рекомендация",
    ownerId: DEMO_USER_IDS.maria,
    managerName: MARIA_NAME,
    createdAt: offsetIso(-52),
    updatedAt: offsetIso(-3, 10),
    lastContactAt: offsetIso(-3, 10),
    nextAction: "Согласовать объём на август",
    nextActionAt: offsetIso(0, 11),
    comment: "Просят зафиксировать цену до конца квартала.",
  },
  {
    id: "КЛ-1063",
    companyName: "Дальний порт",
    inn: "2540198443",
    region: "Приморский край",
    city: "Владивосток",
    industry: "Логистика",
    produces: "Комплектация и перегрузка партий",
    mayPurchase: "Транспортная упаковка",
    potential: "A",
    status: "Активный клиент",
    source: "Сайт компании",
    ownerId: DEMO_USER_IDS.maria,
    managerName: MARIA_NAME,
    createdAt: offsetIso(-96),
    updatedAt: offsetIso(-44, 12),
    lastContactAt: offsetIso(-44, 12),
    nextAction: "",
    nextActionAt: null,
    comment: "Закупает партиями примерно раз в полтора месяца.",
  },
  {
    id: "КЛ-1064",
    companyName: "Невская кофейня",
    inn: "7813554021",
    region: "Санкт-Петербург",
    city: "Санкт-Петербург",
    industry: "Напитки",
    produces: "Обжарка и фасовка кофе",
    mayPurchase: "Упаковка с печатью",
    potential: "B",
    status: "КП отправлено",
    source: "2ГИС",
    ownerId: DEMO_USER_IDS.maria,
    managerName: MARIA_NAME,
    createdAt: offsetIso(-29),
    updatedAt: offsetIso(-7, 15),
    lastContactAt: offsetIso(-8, 11),
    nextAction: "",
    nextActionAt: null,
    comment: "После отправки КП ответа пока нет.",
  },
];

export const demoClients: Client[] = [
  {
    ...clientsFromStatuses[0],
    id: "КЛ-1041",
    companyName: "Полярная логистика",
    status: null,
    nextAction: "Назначить ответственного и проверить реквизиты",
    nextActionAt: "2026-07-23T11:00:00.000Z",
  },
  ...clientsFromStatuses,
  ...mariaClients,
];

export const demoContacts: Contact[] = demoClients
  .slice(0, 12)
  .map((client, index) => ({
    id: `КТ-${String(index + 1).padStart(4, "0")}`,
    clientId: client.id,
    ownerId: client.ownerId,
    createdAt: `2026-06-${String(8 + index).padStart(2, "0")}T09:00:00.000Z`,
    updatedAt: `2026-07-${String(10 + (index % 10)).padStart(2, "0")}T11:00:00.000Z`,
    fullName: [
      "Варвара Антонова",
      "Павел Гришин",
      "Алина Волкова",
      "Роман Крылов",
      "Ольга Селезнёва",
      "Денис Титов",
    ][index % 6],
    role: index % 2 === 0 ? "Руководитель закупок" : "Менеджер по снабжению",
    phone: `+7 9${21 + index} ${347 + index}-${18 + index}-${42 + index}`,
    email: `contact${index + 1}@${client.companyName
      .toLowerCase()
      .replaceAll(" ", "-")
      .replaceAll("ё", "e")}.ru`,
    comment:
      index % 3 === 0 ? "Предпочитает связь по телефону до 14:00." : "",
  }));

const dealProducts = [
  "Гофроящик 600×400",
  "Листовой гофрокартон",
  "Лоток с печатью",
  "Архивный короб",
] as const;

type BriefSeed = {
  packagingType: string;
  fefco: string;
  inner: [number, number, number];
  outer: [number, number, number];
  cardboardGrade: string;
  fluteProfile: string;
  printMethod: string;
  printColors: number | null;
  coating: string;
  packingMethod: DealBrief["packingMethod"];
  loadRequirement: string;
  storageRequirement: string;
  palletizing: string;
  currentSupplier: string;
  currentPrice: number;
  clientProblem: string;
};

/** По одному техническому сценарию на каждый демонстрационный товар. */
const briefSeeds: BriefSeed[] = [
  {
    packagingType: "Гофроящик",
    fefco: "0201",
    inner: [600, 400, 400],
    outer: [608, 408, 406],
    cardboardGrade: "Т-23",
    fluteProfile: "C",
    printMethod: "Флексопечать",
    printColors: 2,
    coating: "Без покрытия",
    packingMethod: "Вручную",
    loadRequirement: "Штабелирование в 4 яруса, до 18 кг на короб",
    storageRequirement: "Сухой склад, до 70% влажности",
    palletizing: "Паллета 1200×800, 480 шт., стрейч-обмотка",
    currentSupplier: "Упак-Регион",
    currentPrice: 34.8,
    clientProblem: "Короба рвутся по фальцу при перегрузке.",
  },
  {
    packagingType: "Листовой гофрокартон",
    fefco: "",
    inner: [1200, 800, 0],
    outer: [1200, 800, 0],
    cardboardGrade: "П-32",
    fluteProfile: "BC",
    printMethod: "Без печати",
    printColors: null,
    coating: "Без покрытия",
    packingMethod: "На линии",
    loadRequirement: "Прокладка между ярусами, до 900 кг на паллету",
    storageRequirement: "Хранение на паллетах, без прямого солнца",
    palletizing: "Паллета 1200×800, пачки по 250 листов",
    currentSupplier: "КартонТорг",
    currentPrice: 96,
    clientProblem: "Поставщик срывает сроки в сезон.",
  },
  {
    packagingType: "Лоток",
    fefco: "0427",
    inner: [400, 300, 120],
    outer: [406, 306, 124],
    cardboardGrade: "Т-24",
    fluteProfile: "E (микрогофра)",
    printMethod: "Офсет (кашировка)",
    printColors: 4,
    coating: "Лак",
    packingMethod: "На линии",
    loadRequirement: "Нагрузка до 12 кг, штабель 6 ярусов",
    storageRequirement: "Отапливаемый склад, товар пищевой",
    palletizing: "Паллета 1200×800, 720 шт., термоусадка",
    currentSupplier: "Полиграф-Пак",
    currentPrice: 41.2,
    clientProblem: "Печать плывёт, оттенок гуляет от партии к партии.",
  },
  {
    packagingType: "Короб с крышкой",
    fefco: "0402",
    inner: [325, 245, 260],
    outer: [331, 251, 264],
    cardboardGrade: "Т-22",
    fluteProfile: "B",
    printMethod: "Трафарет",
    printColors: 1,
    coating: "Без покрытия",
    packingMethod: "Вручную",
    loadRequirement: "Архивное хранение, до 15 кг, штабель 5 ярусов",
    storageRequirement: "Стеллажное хранение, сухое помещение",
    palletizing: "Паллета 1200×800, 200 шт., без обмотки",
    currentSupplier: "Своё производство",
    currentPrice: 62,
    clientProblem: "Крышка не держит форму под весом документов.",
  },
];

/**
 * Заполненность брифа растёт вместе с продвижением сделки: на входящих
 * заявках почти ничего нет, на расчёте — половина, дальше бриф закрыт.
 */
const buildDemoBrief = (index: number, updatedAt: string): DealBrief => {
  const seed = briefSeeds[index % briefSeeds.length];
  const brief = createEmptyDealBrief();
  if (index === 0) return brief;

  brief.packagingType = seed.packagingType;
  brief.clientProblem = seed.clientProblem;
  brief.batchVolume = `${18 + index * 3} тыс. шт.`;
  brief.assets.spec = {
    status: index > 1 ? "received" : "requested",
    note: index > 1 ? "ТЗ во вложении к письму от клиента" : "Запросили у технолога",
  };
  brief.updatedAt = updatedAt;
  if (index < 2) return brief;

  brief.fefco = seed.fefco;
  brief.innerDimensions = {
    length: seed.inner[0],
    width: seed.inner[1],
    height: seed.inner[2] || null,
  };
  brief.cardboardGrade = seed.cardboardGrade;
  brief.fluteProfile = seed.fluteProfile;
  brief.printMethod = seed.printMethod;
  brief.printColors = seed.printColors;
  brief.monthlyVolume = `${6 + index} тыс. шт.`;
  brief.currentSupplier = seed.currentSupplier;
  brief.currentPrice = seed.currentPrice;
  brief.assets.photo = { status: "received", note: "Фото образца с производства" };
  if (index < 5) return brief;

  brief.outerDimensions = {
    length: seed.outer[0],
    width: seed.outer[1],
    height: seed.outer[2] || null,
  };
  brief.coating = seed.coating;
  brief.annualVolume = `${(6 + index) * 12} тыс. шт.`;
  brief.packingMethod = seed.packingMethod;
  brief.loadRequirement = seed.loadRequirement;
  brief.storageRequirement = seed.storageRequirement;
  brief.palletizing = seed.palletizing;
  brief.assets.drawing = { status: "received", note: "Чертёж в PDF от клиента" };
  brief.assets.sample = {
    status: index < 8 ? "requested" : "received",
    note: index < 8 ? "Образец обещали передать с курьером" : "Образец на складе",
  };

  return brief;
};

/**
 * Деньги демо-сделок из списка статусов. Живут отдельно от сделки, потому что
 * источником правды стали версии КП: у первой сделки их нет вовсе — это ветка
 * «КП ещё не рассчитано».
 */
const generatedDealMoney = (index: number) =>
  index === 0
    ? { revenue: 0, cost: 0, logistics: 0 }
    : {
        revenue: 168000 + index * 21300,
        cost: 114000 + index * 16700,
        logistics: 12000 + (index % 4) * 3900,
      };

const generatedDealId = (index: number) =>
  `СД-${String(812 + index).padStart(4, "0")}`;

/** Дата КП у сгенерированных сделок: первые три ещё не считались. */
const generatedProposalDate = (index: number) =>
  index < 3 ? null : `2026-07-${String(4 + index).padStart(2, "0")}`;

const demoMilestone = (completedAt: string | null, ownerId: string) => ({
  completedAt,
  completedById: completedAt === null ? null : ownerId,
  note: "",
});

const buildDemoProcess = (options: {
  ownerId: string;
  specReceivedAt: string | null;
  calculationAt: string | null;
  quoteSentAt: string | null;
  replyExpectedAt?: string | null;
  sampleSkipped?: boolean;
}): DealProcess => {
  const process = createEmptyDealProcess();
  const { ownerId } = options;

  process.steps.specReceived = demoMilestone(options.specReceivedAt, ownerId);
  process.steps.calculationRequested = demoMilestone(
    options.calculationAt,
    ownerId,
  );
  process.steps.calculationReceived = demoMilestone(
    options.calculationAt,
    ownerId,
  );
  process.steps.quoteSent = demoMilestone(options.quoteSentAt, ownerId);
  process.replyExpectedAt = options.replyExpectedAt ?? null;
  process.sampleSkipped = options.sampleSkipped ?? false;
  process.updatedAt = options.quoteSentAt ?? options.specReceivedAt;

  return process;
};

const dealsFromStatuses: Deal[] = DEAL_STATUSES.map((status, index) => {
  const money = generatedDealMoney(index);
  const dealId = generatedDealId(index);
  const ownerId = managerIds[index % managerIds.length];
  const createdAt = `2026-07-${String(1 + index).padStart(2, "0")}T08:30:00.000Z`;
  const proposalDate = generatedProposalDate(index);

  return {
    id: dealId,
    clientId: demoClients[(index + 1) % demoClients.length].id,
    ownerId,
    createdAt,
    updatedAt: `2026-07-${String(8 + index).padStart(2, "0")}T12:00:00.000Z`,
    contactId:
      index < demoContacts.length ? demoContacts[index].id : null,
    title: `Поставка · ${dealProducts[index % dealProducts.length]}`,
    product: dealProducts[index % dealProducts.length],
    volume: `${18 + index * 3} тыс. шт.`,
    status,
    brief: buildDemoBrief(
      index,
      `2026-07-${String(8 + index).padStart(2, "0")}T12:00:00.000Z`,
    ),
    process: buildDemoProcess({
      ownerId,
      specReceivedAt: createdAt,
      calculationAt: proposalDate === null ? null : createdAt,
      quoteSentAt: proposalDate,
    }),
    activeQuoteId: money.revenue === 0 ? null : `КП-${dealId}-1`,
    nextAction:
      index > 12
        ? "Зафиксировать причину закрытия"
        : [
            "Получить размеры и марку картона",
            "Согласовать цену",
            "Подтвердить график поставки",
          ][index % 3],
    nextActionAt:
      index > 12
        ? null
        : `2026-07-${String(23 + (index % 7)).padStart(2, "0")}T12:00:00.000Z`,
    managerName: managers[index % managers.length],
    comment: index % 2 === 0 ? "Клиент ждёт два варианта расчёта." : "",
  };
});

const briefFrom = (
  patch: Partial<Omit<DealBrief, "assets">> & {
    assets?: Partial<DealBrief["assets"]>;
  },
): DealBrief => {
  const base = createEmptyDealBrief();
  return { ...base, ...patch, assets: { ...base.assets, ...patch.assets } };
};

const mariaDeals: Deal[] = [
  {
    id: "СД-0830",
    clientId: "КЛ-1061",
    contactId: null,
    ownerId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-31),
    updatedAt: offsetIso(-11, 16),
    title: "Поставка · Гофроящик 400×300",
    product: "Гофроящик 400×300",
    volume: "24 тыс. шт.",
    status: "Согласование условий",
    brief: briefFrom({
      packagingType: "Гофроящик",
      fefco: "0201",
      innerDimensions: { length: 400, width: 300, height: 250 },
      outerDimensions: { length: 406, width: 306, height: 254 },
      cardboardGrade: "Т-23",
      fluteProfile: "B",
      printMethod: "Флексопечать",
      printColors: 1,
      coating: "Без покрытия",
      batchVolume: "24 тыс. шт.",
      monthlyVolume: "8 тыс. шт.",
      annualVolume: "96 тыс. шт.",
      packingMethod: "Вручную",
      loadRequirement: "До 16 кг на короб, штабель 5 ярусов",
      storageRequirement: "Сухой склад без отопления",
      palletizing: "Паллета 1200×800, 540 шт., стрейч",
      currentSupplier: "Упак-Регион",
      currentPrice: 33.5,
      clientProblem: "Текущий поставщик поднял цену на 12% без предупреждения.",
      assets: {
        drawing: { status: "received", note: "Чертёж PDF, письмо от 12 числа" },
        photo: { status: "received", note: "Фото короба на линии" },
        spec: { status: "received", note: "ТЗ согласовано с технологом" },
        sample: { status: "received", note: "Образец на складе" },
      },
      updatedAt: offsetIso(-12, 11),
    }),
    process: buildDemoProcess({
      ownerId: DEMO_USER_IDS.maria,
      specReceivedAt: offsetIso(-31),
      calculationAt: offsetIso(-24),
      quoteSentAt: offsetIso(-19),
    }),
    activeQuoteId: "КП-СД-0830-1",
    nextAction: "",
    nextActionAt: null,
    managerName: MARIA_NAME,
    comment: "Обсуждение зависло на условиях отсрочки.",
  },
  {
    id: "СД-0831",
    clientId: "КЛ-1064",
    contactId: null,
    ownerId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-21),
    updatedAt: offsetIso(-7, 15),
    title: "Поставка · Упаковка с печатью",
    product: "Упаковка с печатью",
    volume: "12 тыс. шт.",
    status: "КП отправлено",
    brief: briefFrom({
      packagingType: "Лоток",
      fefco: "0427",
      innerDimensions: { length: 380, width: 280, height: 110 },
      cardboardGrade: "Т-24",
      fluteProfile: "E (микрогофра)",
      printMethod: "Офсет (кашировка)",
      printColors: 4,
      coating: "Лак",
      batchVolume: "12 тыс. шт.",
      monthlyVolume: "4 тыс. шт.",
      packingMethod: "На линии",
      loadRequirement: "До 10 кг, штабель 6 ярусов",
      currentSupplier: "Полиграф-Пак",
      currentPrice: 44,
      clientProblem: "Нужна стабильная печать под фирменный цвет.",
      assets: {
        photo: { status: "received", note: "Фото текущего лотка" },
        spec: { status: "received", note: "ТЗ на печать от маркетолога" },
        drawing: { status: "requested", note: "Ждём развёртку от клиента" },
      },
      updatedAt: offsetIso(-8, 14),
    }),
    process: buildDemoProcess({
      ownerId: DEMO_USER_IDS.maria,
      specReceivedAt: offsetIso(-21),
      calculationAt: offsetIso(-12),
      quoteSentAt: offsetIso(-7),
      // Дата, которую назвал клиент, уже прошла — сделка попадает
      // в рабочий список «КП без ответа».
      replyExpectedAt: offsetIso(-4),
    }),
    activeQuoteId: "КП-СД-0831-1",
    nextAction: "Напомнить о коммерческом предложении",
    nextActionAt: offsetIso(2, 10),
    managerName: MARIA_NAME,
    comment: "КП ушло клиенту, ответа не было.",
  },
  {
    id: "СД-0832",
    clientId: "КЛ-1063",
    contactId: null,
    ownerId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-72),
    updatedAt: offsetIso(-44, 12),
    title: "Поставка · Транспортная упаковка",
    product: "Транспортная упаковка",
    volume: "30 тыс. шт.",
    status: "Закрыта успешно",
    brief: briefFrom({
      packagingType: "Гофроящик",
      fefco: "0203",
      innerDimensions: { length: 800, width: 400, height: 400 },
      outerDimensions: { length: 810, width: 410, height: 408 },
      cardboardGrade: "П-32",
      fluteProfile: "BC",
      printMethod: "Без печати",
      coating: "Влагостойкая пропитка",
      batchVolume: "30 тыс. шт.",
      monthlyVolume: "10 тыс. шт.",
      annualVolume: "120 тыс. шт.",
      packingMethod: "На линии",
      loadRequirement: "До 25 кг, штабель 4 яруса, транспортировка фурами",
      storageRequirement: "Открытый навес, нужна влагостойкость",
      palletizing: "Паллета 1200×1000, 300 шт., обвязка лентой",
      currentSupplier: "Своё производство",
      currentPrice: 78,
      clientProblem: "Ящики размокали при перевозке зимой.",
      assets: {
        drawing: { status: "received", note: "Чертёж согласован с производством" },
        photo: { status: "received", note: "Фото паллеты после отгрузки" },
        spec: { status: "received", note: "ТЗ подписано" },
        sample: { status: "received", note: "Образец утверждён клиентом" },
      },
      updatedAt: offsetIso(-52, 10),
    }),
    process: buildDemoProcess({
      ownerId: DEMO_USER_IDS.maria,
      specReceivedAt: offsetIso(-72),
      calculationAt: offsetIso(-64),
      quoteSentAt: offsetIso(-58),
    }),
    // Три версии КП: цена поднималась дважды, обе причины в истории.
    activeQuoteId: "КП-СД-0832-3",
    nextAction: "",
    nextActionAt: null,
    managerName: MARIA_NAME,
    comment: "Регулярная отгрузка, цикл около полутора месяцев.",
  },
  {
    id: "СД-0833",
    clientId: "КЛ-1062",
    contactId: null,
    ownerId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-16),
    updatedAt: offsetIso(-3, 10),
    title: "Поставка · Лоток с печатью",
    product: "Лоток с печатью",
    volume: "18 тыс. шт.",
    status: "Переговоры",
    brief: briefFrom({
      packagingType: "Лоток",
      innerDimensions: { length: 300, width: 200, height: 90 },
      cardboardGrade: "Т-22",
      printMethod: "Флексопечать",
      printColors: 2,
      batchVolume: "18 тыс. шт.",
      clientProblem: "Лотки мнутся при выкладке в торговом зале.",
      assets: {
        spec: { status: "requested", note: "Клиент готовит ТЗ на печать" },
      },
      updatedAt: offsetIso(-4, 9),
    }),
    process: buildDemoProcess({
      ownerId: DEMO_USER_IDS.maria,
      specReceivedAt: offsetIso(-16),
      calculationAt: offsetIso(-11),
      quoteSentAt: offsetIso(-9),
      replyExpectedAt: offsetIso(2),
    }),
    activeQuoteId: "КП-СД-0833-1",
    nextAction: "Подтвердить график отгрузок на август",
    nextActionAt: offsetIso(3, 12),
    managerName: MARIA_NAME,
    comment: "",
  },
];

export const demoDeals: Deal[] = [...dealsFromStatuses, ...mariaDeals];

const demoQuote = (
  dealId: string,
  version: number,
  patch: Pick<Quote, "revenue" | "cost" | "logistics" | "volume"> &
    Partial<Quote>,
): Quote => ({
  id: `КП-${dealId}-${version}`,
  dealId,
  version,
  status: "Отправлено",
  validUntil: null,
  changeReason: "",
  sentAt: null,
  authorId: "",
  comment: "",
  createdAt: DEMO_CREATED_AT,
  updatedAt: DEMO_UPDATED_AT,
  ...patch,
});

const generatedQuotes: Quote[] = DEAL_STATUSES.flatMap((_, index) => {
  const money = generatedDealMoney(index);
  if (money.revenue === 0) return [];

  const dealId = generatedDealId(index);
  const proposalDate = generatedProposalDate(index);
  const createdAt = `2026-07-${String(1 + index).padStart(2, "0")}T08:30:00.000Z`;

  return [
    demoQuote(dealId, 1, {
      ...money,
      volume: `${18 + index * 3} тыс. шт.`,
      status: proposalDate === null ? "Черновик" : "Отправлено",
      sentAt: proposalDate,
      authorId: managerIds[index % managerIds.length],
      createdAt,
      updatedAt: createdAt,
    }),
  ];
});

/**
 * История версий КП по сделке СД-0832: цена росла дважды, и каждая правка
 * объяснена — ради этого история версий и заводилась.
 */
const mariaQuotes: Quote[] = [
  demoQuote("СД-0830", 1, {
    revenue: 394000,
    cost: 268000,
    logistics: 21000,
    volume: "24 тыс. шт.",
    sentAt: offsetIso(-19),
    validUntil: offsetDay(11),
    authorId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-20),
    updatedAt: offsetIso(-19),
  }),
  demoQuote("СД-0831", 1, {
    revenue: 249000,
    cost: 171000,
    logistics: 14000,
    volume: "12 тыс. шт.",
    sentAt: offsetIso(-7),
    validUntil: offsetDay(7),
    authorId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-8),
    updatedAt: offsetIso(-7),
  }),
  demoQuote("СД-0832", 1, {
    revenue: 452000,
    cost: 318000,
    logistics: 26000,
    volume: "26 тыс. шт.",
    status: "Заменено",
    sentAt: offsetIso(-66),
    authorId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-67),
    updatedAt: offsetIso(-59),
  }),
  demoQuote("СД-0832", 2, {
    revenue: 470000,
    cost: 324000,
    logistics: 33000,
    volume: "28 тыс. шт.",
    status: "Заменено",
    changeReason: "Клиент увеличил тираж",
    sentAt: offsetIso(-62),
    authorId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-63),
    updatedAt: offsetIso(-59),
  }),
  demoQuote("СД-0832", 3, {
    revenue: 498000,
    cost: 327000,
    logistics: 40000,
    volume: "30 тыс. шт.",
    changeReason: "Скидка под объём",
    sentAt: offsetIso(-58),
    validUntil: offsetDay(14),
    authorId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-59),
    updatedAt: offsetIso(-58),
  }),
  demoQuote("СД-0833", 1, {
    revenue: 312000,
    cost: 214000,
    logistics: 17000,
    volume: "18 тыс. шт.",
    sentAt: offsetIso(-9),
    validUntil: offsetDay(5),
    authorId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-10),
    updatedAt: offsetIso(-9),
  }),
];

export const demoQuotes: Quote[] = [...generatedQuotes, ...mariaQuotes];

const interactionsFromTemplate: Interaction[] = Array.from(
  { length: 14 },
  (_, index) => ({
    id: `ИВ-${String(3201 + index).padStart(4, "0")}`,
    occurredAt: `2026-07-${String(22 - (index % 9)).padStart(2, "0")}T${
      9 + (index % 7)
    }:15:00.000Z`,
    clientId: demoClients[index % demoClients.length].id,
    ownerId: managerIds[index % managerIds.length],
    createdAt: `2026-07-${String(22 - (index % 9)).padStart(2, "0")}T${
      9 + (index % 7)
    }:15:00.000Z`,
    updatedAt: `2026-07-${String(22 - (index % 9)).padStart(2, "0")}T${
      9 + (index % 7)
    }:15:00.000Z`,
    contactId:
      index < demoContacts.length ? demoContacts[index].id : null,
    kind: [
      "Звонок",
      "Email",
      "Встреча",
      "Отправка КП",
      "WhatsApp",
    ][index % 5] as Interaction["kind"],
    subject: [
      "Первичное знакомство",
      "Уточнение потребности",
      "Обсуждение образца",
      "Согласование условий",
    ][index % 4],
    result:
      index % 3 === 0
        ? "Получили вводные для расчёта"
        : "Договорились вернуться с ответом",
    nextStep: [
      "Подготовить КП",
      "Позвонить после внутреннего согласования",
      "Отправить образец",
    ][index % 3],
    nextStepAt: `2026-07-${String(23 + (index % 6)).padStart(2, "0")}T10:00:00.000Z`,
    managerName: managers[index % managers.length],
    comment: index % 2 === 0 ? "Контакт подтверждён." : "",
  }),
);

const mariaInteractions: Interaction[] = [
  {
    id: "ИВ-3301",
    occurredAt: offsetIso(-8, 11),
    clientId: "КЛ-1064",
    contactId: null,
    ownerId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-8, 11),
    updatedAt: offsetIso(-8, 11),
    kind: "Звонок",
    subject: "Уточнение потребности",
    result: "Собрали требования к печати и тиражу",
    nextStep: "Подготовить и отправить КП",
    nextStepAt: null,
    managerName: MARIA_NAME,
    comment: "КП отправлено следом.",
  },
  {
    id: "ИВ-3302",
    occurredAt: offsetIso(-7, 15),
    clientId: "КЛ-1064",
    contactId: null,
    ownerId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-7, 15),
    updatedAt: offsetIso(-7, 15),
    kind: "Отправка КП",
    subject: "Коммерческое предложение",
    result: "КП отправлено на почту",
    nextStep: "Уточнить решение по коммерческому предложению",
    nextStepAt: offsetIso(-4, 10),
    managerName: MARIA_NAME,
    comment: "Ответа пока нет.",
  },
  {
    id: "ИВ-3303",
    occurredAt: offsetIso(-44, 12),
    clientId: "КЛ-1063",
    contactId: null,
    ownerId: DEMO_USER_IDS.maria,
    createdAt: offsetIso(-44, 12),
    updatedAt: offsetIso(-44, 12),
    kind: "Встреча",
    subject: "Согласование условий",
    result: "Отгрузили партию, договорились о следующем цикле",
    nextStep: "Вернуться к обсуждению перед новым заказом",
    nextStepAt: offsetIso(1, 10),
    managerName: MARIA_NAME,
    comment: "",
  },
];

export const demoInteractions: Interaction[] = [
  ...interactionsFromTemplate,
  ...mariaInteractions,
];

const clientTasks: Task[] = demoClients
  .filter((client) => client.nextAction)
  .map((client, index) => {
    const completed = index === 0;

    return {
      id: `ЗД-КЛ-${String(index + 1).padStart(4, "0")}`,
      title: client.nextAction,
      description: `Следующее действие по клиенту «${client.companyName}».`,
      kind: index % 3 === 0 ? "call" : index % 3 === 1 ? "email" : "follow_up",
      status: completed ? "completed" : "open",
      priority: index % 5 === 0 ? "high" : "normal",
      dueAt: client.nextActionAt,
      completedAt: completed ? "2026-07-23T11:12:00.000Z" : null,
      assigneeId: client.ownerId,
      createdById: DEMO_USER_IDS.sofia,
      source: "client",
      sourceId: client.id,
      checklist:
        index < 3
          ? [
              {
                id: `ЧЛ-КЛ-${index + 1}-1`,
                title: "Проверить историю контактов",
                completed,
              },
              {
                id: `ЧЛ-КЛ-${index + 1}-2`,
                title: "Зафиксировать результат",
                completed: false,
              },
            ]
          : [],
      clientId: client.id,
      dealId: null,
      contactId: null,
      createdAt: client.createdAt,
      updatedAt: completed ? "2026-07-23T11:12:00.000Z" : client.updatedAt,
    };
  });

const dealTasks: Task[] = demoDeals
  .filter((deal) => deal.nextAction)
  .map((deal, index) => ({
    id: `ЗД-СД-${String(index + 1).padStart(4, "0")}`,
    title: deal.nextAction,
    description: `Следующий шаг по сделке «${deal.title}».`,
    kind: index % 3 === 0 ? "proposal" : index % 3 === 1 ? "call" : "follow_up",
    status: "open",
    priority: index % 4 === 0 ? "high" : "normal",
    dueAt: deal.nextActionAt,
    completedAt: null,
    assigneeId: deal.ownerId,
    createdById: DEMO_USER_IDS.sofia,
    source: "deal",
    sourceId: deal.id,
    checklist:
      index < 2
        ? [
            {
              id: `ЧЛ-СД-${index + 1}-1`,
              title: "Проверить расчёт",
              completed: index === 0,
            },
            {
              id: `ЧЛ-СД-${index + 1}-2`,
              title: "Отправить материалы клиенту",
              completed: false,
            },
          ]
        : [],
    clientId: deal.clientId,
    dealId: deal.id,
    contactId: deal.contactId,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  }));

const interactionTasks: Task[] = demoInteractions
  .slice(0, 6)
  .map((interaction, index) => ({
    id: `ЗД-ИВ-${String(index + 1).padStart(4, "0")}`,
    title: interaction.nextStep,
    description: `Продолжение после взаимодействия «${interaction.subject}».`,
    kind: index % 2 === 0 ? "follow_up" : "call",
    status: "open",
    priority: index === 1 ? "high" : "normal",
    dueAt: interaction.nextStepAt,
    completedAt: null,
    assigneeId: interaction.ownerId,
    createdById: interaction.ownerId,
    source: "interaction",
    sourceId: interaction.id,
    checklist: [],
    clientId: interaction.clientId,
    dealId: null,
    contactId: interaction.contactId,
    createdAt: interaction.createdAt,
    updatedAt: interaction.updatedAt,
  }));

export const demoTasks: Task[] = [
  ...clientTasks,
  ...dealTasks,
  ...interactionTasks,
  {
    id: "ЗД-НАП-0001",
    title: "Сверить просроченные задачи команды",
    description: "Ежедневное напоминание руководителя перед планёркой.",
    kind: "reminder",
    status: "open",
    priority: "high",
    dueAt: "2026-07-23T08:30:00.000Z",
    completedAt: null,
    assigneeId: DEMO_USER_IDS.sofia,
    createdById: DEMO_USER_IDS.sofia,
    source: "manual",
    sourceId: null,
    checklist: [
      {
        id: "ЧЛ-НАП-0001-1",
        title: "Проверить просроченные",
        completed: false,
      },
      {
        id: "ЧЛ-НАП-0001-2",
        title: "Распределить ответственных",
        completed: false,
      },
    ],
    clientId: null,
    dealId: null,
    contactId: null,
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-20T08:00:00.000Z",
  },
];

const clientStatusEvents: StatusEvent[] = demoClients.map((client, index) => ({
  id: `СТ-КЛ-${String(index + 1).padStart(4, "0")}`,
  entityType: "client",
  entityId: client.id,
  fromStatus:
    index <= 1 ? null : (CLIENT_STATUSES[index - 2] ?? null),
  toStatus: client.status,
  changedById: client.ownerId,
  changedAt: client.updatedAt,
  createdAt: client.updatedAt,
  updatedAt: client.updatedAt,
}));

const dealStatusEvents: StatusEvent[] = demoDeals.map((deal, index) => ({
  id: `СТ-СД-${String(index + 1).padStart(4, "0")}`,
  entityType: "deal",
  entityId: deal.id,
  fromStatus: index === 0 ? null : (DEAL_STATUSES[index - 1] ?? null),
  toStatus: deal.status,
  changedById: deal.ownerId,
  changedAt: deal.updatedAt,
  createdAt: deal.updatedAt,
  updatedAt: deal.updatedAt,
}));

export const demoStatusEvents: StatusEvent[] = [
  ...clientStatusEvents,
  ...dealStatusEvents,
];

export const demoTargets: Target[] = [
  {
    id: "ЦЕЛЬ-КОМ-ВЫРУЧКА-2026-07",
    scope: "team",
    subjectId: DEMO_TEAM_ID,
    metric: "revenue",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    targetValue: 8_000_000,
    unit: "RUB",
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
  },
  {
    id: "ЦЕЛЬ-КОМ-МАРЖА-2026-07",
    scope: "team",
    subjectId: DEMO_TEAM_ID,
    metric: "margin",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    targetValue: 1_600_000,
    unit: "RUB",
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
  },
  {
    id: "ЦЕЛЬ-КОМ-СДЕЛКИ-2026-07",
    scope: "team",
    subjectId: DEMO_TEAM_ID,
    metric: "deals_won",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    targetValue: 12,
    unit: "count",
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
  },
  ...demoUsers.flatMap<Target>((user) => [
    {
      id: `ЦЕЛЬ-${user.id}-ВЫРУЧКА-2026-07`,
      scope: "user",
      subjectId: user.id,
      metric: "revenue",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      targetValue: user.role === "manager" ? 1_500_000 : 3_250_000,
      unit: "RUB",
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z",
    },
    {
      id: `ЦЕЛЬ-${user.id}-АКТИВНОСТИ-2026-07`,
      scope: "user",
      subjectId: user.id,
      metric: "activities",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      targetValue: user.role === "manager" ? 45 : 80,
      unit: "count",
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z",
    },
  ]),
];

export const demoSnapshot: CrmSnapshot = {
  schemaVersion: CRM_SCHEMA_VERSION,
  teams: demoTeams,
  users: demoUsers,
  session: demoSession,
  clients: demoClients,
  contacts: demoContacts,
  deals: demoDeals,
  quotes: demoQuotes,
  interactions: demoInteractions,
  tasks: demoTasks,
  statusEvents: demoStatusEvents,
  targets: demoTargets,
  dictionaries: {
    potentials: ["A", "B", "C", "D"],
    industries: [
      "Пищевая промышленность",
      "Напитки",
      "Молочная продукция",
      "Мясная продукция",
      "Кондитерка",
      "Мебель",
      "Бытовая химия",
      "Косметика",
      "Фармацевтика",
      "Стройматериалы",
      "Электроника",
      "Товары для маркетплейсов",
      "Логистика",
      "Складской оператор",
      "Производство",
      "Другое",
    ],
    productTypes: [
      "Гофрокартон листовой",
      "Гофролисты",
      "Коробки",
      "Гофроящики",
      "Лотки",
      "Архивные короба",
      "Транспортная упаковка",
      "Упаковка с печатью",
      "Нестандартная упаковка",
      "Другое",
    ],
    sources: [
      "Банковская выписка",
      "2ГИС",
      "Яндекс Карты",
      "Сайт компании",
      "Холодный звонок",
      "Рекомендация",
      "Выставка",
      "Закупочная площадка",
      "Реклама",
      "Другое",
    ],
    interactionTypes: [
      "Звонок",
      "Email",
      "WhatsApp",
      "Telegram",
      "Встреча",
      "Повторный звонок",
      "Отправка КП",
      "Получение ТЗ",
      "Другое",
    ],
  },
};
