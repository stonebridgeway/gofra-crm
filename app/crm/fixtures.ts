import {
  CLIENT_STATUSES,
  CRM_SCHEMA_VERSION,
  DEAL_STATUSES,
  type Client,
  type Contact,
  type CrmSnapshot,
  type Deal,
  type Interaction,
  type Potential,
  type Session,
  type StatusEvent,
  type Target,
  type Task,
  type Team,
  type User,
} from "./domain";

export const DEMO_TEAM_ID = "team-gofra";
export const DEMO_USER_IDS = {
  sofia: "user-sofia",
  nikolai: "user-nikolai",
  timur: "user-timur",
} as const;

const DEMO_CREATED_AT = "2026-06-01T08:00:00.000Z";
const DEMO_UPDATED_AT = "2026-07-23T08:00:00.000Z";

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

export const demoDeals: Deal[] = DEAL_STATUSES.map((status, index) => {
  const ourPrice = 168000 + index * 21300;
  const purchasePrice = 114000 + index * 16700;
  const logistics = 12000 + (index % 4) * 3900;
  const margin = ourPrice - purchasePrice - logistics;

  return {
    id: `СД-${String(812 + index).padStart(4, "0")}`,
    clientId: demoClients[(index + 1) % demoClients.length].id,
    ownerId: managerIds[index % managerIds.length],
    createdAt: `2026-07-${String(1 + index).padStart(2, "0")}T08:30:00.000Z`,
    updatedAt: `2026-07-${String(8 + index).padStart(2, "0")}T12:00:00.000Z`,
    contactId:
      index < demoContacts.length ? demoContacts[index].id : null,
    title: `Поставка · ${dealProducts[index % dealProducts.length]}`,
    product: dealProducts[index % dealProducts.length],
    volume: `${18 + index * 3} тыс. шт.`,
    clientPrice: ourPrice + 18000,
    ourPrice,
    purchasePrice,
    logistics,
    margin,
    marginPercent: Math.round((margin / ourPrice) * 1000) / 10,
    status,
    proposalDate:
      index < 3 ? null : `2026-07-${String(4 + index).padStart(2, "0")}`,
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

export const demoInteractions: Interaction[] = Array.from(
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
