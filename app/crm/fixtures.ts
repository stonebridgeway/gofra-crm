import {
  CLIENT_STATUSES,
  DEAL_STATUSES,
  type Client,
  type Contact,
  type CrmSnapshot,
  type Deal,
  type Interaction,
  type Potential,
} from "./domain";

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
    managerName: managers[index % managers.length],
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

export const demoSnapshot: CrmSnapshot = {
  clients: demoClients,
  contacts: demoContacts,
  deals: demoDeals,
  interactions: demoInteractions,
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
