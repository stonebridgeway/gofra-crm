import {
  CRM_SCHEMA_VERSION,
  type Client,
  type Contact,
  type CrmSnapshot,
  type Deal,
  type Dictionaries,
  type Interaction,
  type Session,
  type StatusEvent,
  type Target,
  type Task,
  type Team,
  type User,
  type UserRole,
} from "./domain";
import {
  DEMO_TEAM_ID,
  DEMO_USER_IDS,
  demoSession,
  demoSnapshot,
  demoTargets,
  demoTeams,
  demoUsers,
} from "./fixtures";

export const CRM_STORAGE_KEY = "gofra-crm-prototype:v2";
export const LEGACY_CRM_STORAGE_KEY = "gofra-crm-prototype:v1";

type JsonRecord = Record<string, unknown>;

const clone = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

const pause = (duration = 320) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): JsonRecord =>
  isRecord(value) ? value : {};

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNullableString = (
  value: unknown,
  fallback: string | null = null,
): string | null =>
  typeof value === "string" ? value : value === null ? null : fallback;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const unique = <T,>(values: readonly T[]): T[] => [...new Set(values)];

const initialsFromName = (fullName: string): string =>
  fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("ru-RU") ?? "")
    .join("");

const hashText = (value: string): string => {
  let hash = 2166136261;
  for (const symbol of value) {
    hash ^= symbol.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const importedUserId = (fullName: string): string =>
  `user-imported-${hashText(fullName.trim().toLocaleLowerCase("ru-RU"))}`;

const normalizeTeam = (value: unknown, now: string, index: number): Team => {
  const record = asRecord(value);
  const createdAt = asString(record.createdAt, now);

  return {
    ...record,
    id: asString(record.id, `team-imported-${index + 1}`),
    name: asString(record.name, `Команда ${index + 1}`),
    createdAt,
    updatedAt: asString(record.updatedAt, createdAt),
  } as Team;
};

const normalizeUser = (
  value: unknown,
  now: string,
  index: number,
  fallbackTeamId: string,
): User => {
  const record = asRecord(value);
  const fullName = asString(record.fullName, `Сотрудник ${index + 1}`);
  const createdAt = asString(record.createdAt, now);
  const role: UserRole =
    record.role === "manager" || record.role === "employee"
      ? record.role
      : "employee";

  return {
    ...record,
    id: asString(record.id, importedUserId(fullName)),
    teamId: asString(record.teamId, fallbackTeamId),
    fullName,
    email: asString(record.email),
    role,
    jobTitle: asString(
      record.jobTitle,
      role === "manager" ? "Руководитель отдела продаж" : "Менеджер по продажам",
    ),
    initials: asString(record.initials, initialsFromName(fullName)),
    isActive: asBoolean(record.isActive, true),
    createdAt,
    updatedAt: asString(record.updatedAt, createdAt),
  } as User;
};

const collectLegacyManagerNames = (source: JsonRecord): string[] =>
  unique(
    [
      ...asArray(source.clients),
      ...asArray(source.deals),
      ...asArray(source.interactions),
    ]
      .map((value) => asString(asRecord(value).managerName).trim())
      .filter(Boolean),
  );

const ensureRecordOwnersExist = (
  source: JsonRecord,
  users: User[],
  now: string,
  fallbackTeamId: string,
): void => {
  const records = [
    ...asArray(source.clients),
    ...asArray(source.contacts),
    ...asArray(source.deals),
    ...asArray(source.interactions),
  ];

  for (const value of records) {
    const record = asRecord(value);
    const ownerId = asString(record.ownerId);
    if (!ownerId || users.some((user) => user.id === ownerId)) continue;

    const fullName =
      asString(record.managerName).trim() || "Импортированный сотрудник";
    users.push({
      id: ownerId,
      teamId: fallbackTeamId,
      fullName,
      email: "",
      role: "employee",
      jobTitle: "Менеджер по продажам",
      initials: initialsFromName(fullName),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
};

const normalizeDictionaries = (
  value: unknown,
  fallback: Dictionaries,
): Dictionaries => {
  const record = asRecord(value);
  const pickStrings = (key: keyof Dictionaries): string[] => {
    const values = asArray(record[key]).filter(
      (item): item is string => typeof item === "string",
    );
    return values.length ? unique(values) : clone(fallback[key]) as string[];
  };

  return {
    potentials: pickStrings("potentials"),
    industries: pickStrings("industries"),
    productTypes: pickStrings("productTypes"),
    sources: pickStrings("sources"),
    interactionTypes:
      pickStrings("interactionTypes") as Dictionaries["interactionTypes"],
  };
};

const normalizeTask = (
  value: unknown,
  now: string,
  index: number,
  fallbackAssigneeId: string,
): Task => {
  const record = asRecord(value);
  const createdAt = asString(record.createdAt, now);
  const status =
    record.status === "completed" ||
    record.status === "cancelled" ||
    record.status === "open"
      ? record.status
      : "open";
  const kind =
    record.kind === "call" ||
    record.kind === "meeting" ||
    record.kind === "email" ||
    record.kind === "proposal" ||
    record.kind === "follow_up" ||
    record.kind === "reminder" ||
    record.kind === "other"
      ? record.kind
      : "other";
  const priority =
    record.priority === "low" ||
    record.priority === "normal" ||
    record.priority === "high"
      ? record.priority
      : "normal";

  return {
    ...record,
    id: asString(record.id, `task-imported-${index + 1}`),
    title: asString(record.title, "Задача без названия"),
    description: asString(record.description),
    kind,
    status,
    priority,
    dueAt: asNullableString(record.dueAt),
    completedAt: asNullableString(record.completedAt),
    assigneeId: asString(record.assigneeId, fallbackAssigneeId),
    createdById: asString(record.createdById, fallbackAssigneeId),
    clientId: asNullableString(record.clientId),
    dealId: asNullableString(record.dealId),
    contactId: asNullableString(record.contactId),
    createdAt,
    updatedAt: asString(record.updatedAt, createdAt),
  } as Task;
};

const normalizeStatusEvent = (
  value: unknown,
  now: string,
  index: number,
  fallbackUserId: string,
): StatusEvent => {
  const record = asRecord(value);
  const changedAt = asString(record.changedAt, now);

  return {
    ...record,
    id: asString(record.id, `status-event-imported-${index + 1}`),
    entityType: record.entityType === "deal" ? "deal" : "client",
    entityId: asString(record.entityId),
    fromStatus: asNullableString(record.fromStatus),
    toStatus: asNullableString(record.toStatus),
    changedById: asString(record.changedById, fallbackUserId),
    changedAt,
    createdAt: asString(record.createdAt, changedAt),
    updatedAt: asString(record.updatedAt, changedAt),
  } as StatusEvent;
};

const normalizeTarget = (
  value: unknown,
  now: string,
  index: number,
  fallbackTeamId: string,
): Target => {
  const record = asRecord(value);
  const createdAt = asString(record.createdAt, now);
  const metric =
    record.metric === "margin" ||
    record.metric === "deals_won" ||
    record.metric === "new_clients" ||
    record.metric === "activities" ||
    record.metric === "revenue"
      ? record.metric
      : "revenue";

  return {
    ...record,
    id: asString(record.id, `target-imported-${index + 1}`),
    scope: record.scope === "user" ? "user" : "team",
    subjectId: asString(record.subjectId, fallbackTeamId),
    metric,
    periodStart: asString(record.periodStart, "2026-07-01"),
    periodEnd: asString(record.periodEnd, "2026-07-31"),
    targetValue: asNumber(record.targetValue),
    unit: record.unit === "count" ? "count" : "RUB",
    createdAt,
    updatedAt: asString(record.updatedAt, createdAt),
  } as Target;
};

const createTasksFromLegacyRecords = (
  clients: readonly Client[],
  deals: readonly Deal[],
  interactions: readonly Interaction[],
  createdById: string,
): Task[] => {
  const clientTasks = clients
    .filter((client) => client.nextAction.trim())
    .map<Task>((client) => ({
      id: `task-legacy-client-${client.id}`,
      title: client.nextAction,
      description: `Мигрировано из следующего действия клиента «${client.companyName}».`,
      kind: "follow_up",
      status: "open",
      priority: "normal",
      dueAt: client.nextActionAt,
      completedAt: null,
      assigneeId: client.ownerId,
      createdById,
      clientId: client.id,
      dealId: null,
      contactId: null,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    }));

  const dealTasks = deals
    .filter((deal) => deal.nextAction.trim())
    .map<Task>((deal) => ({
      id: `task-legacy-deal-${deal.id}`,
      title: deal.nextAction,
      description: `Мигрировано из следующего действия сделки «${deal.title}».`,
      kind: "follow_up",
      status: "open",
      priority: "normal",
      dueAt: deal.nextActionAt,
      completedAt: null,
      assigneeId: deal.ownerId,
      createdById,
      clientId: deal.clientId,
      dealId: deal.id,
      contactId: deal.contactId,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    }));

  const interactionTasks = interactions
    .filter((interaction) => interaction.nextStep.trim())
    .map<Task>((interaction) => ({
      id: `task-legacy-interaction-${interaction.id}`,
      title: interaction.nextStep,
      description: `Мигрировано из следующего шага взаимодействия «${interaction.subject}».`,
      kind: "follow_up",
      status: "open",
      priority: "normal",
      dueAt: interaction.nextStepAt,
      completedAt: null,
      assigneeId: interaction.ownerId,
      createdById,
      clientId: interaction.clientId,
      dealId: null,
      contactId: interaction.contactId,
      createdAt: interaction.createdAt,
      updatedAt: interaction.updatedAt,
    }));

  return [...clientTasks, ...dealTasks, ...interactionTasks];
};

const createInitialStatusEvents = (
  clients: readonly Client[],
  deals: readonly Deal[],
): StatusEvent[] => [
  ...clients.map<StatusEvent>((client) => ({
    id: `status-legacy-client-${client.id}`,
    entityType: "client",
    entityId: client.id,
    fromStatus: null,
    toStatus: client.status,
    changedById: client.ownerId,
    changedAt: client.updatedAt,
    createdAt: client.updatedAt,
    updatedAt: client.updatedAt,
  })),
  ...deals.map<StatusEvent>((deal) => ({
    id: `status-legacy-deal-${deal.id}`,
    entityType: "deal",
    entityId: deal.id,
    fromStatus: null,
    toStatus: deal.status,
    changedById: deal.ownerId,
    changedAt: deal.updatedAt,
    createdAt: deal.updatedAt,
    updatedAt: deal.updatedAt,
  })),
];

/**
 * Upgrades an unversioned/v1 browser snapshot to schema v2.
 * Existing record IDs and legacy display fields are kept verbatim.
 */
export const migrateCrmSnapshot = (
  input: unknown,
  migratedAt = new Date().toISOString(),
): CrmSnapshot => {
  if (!isRecord(input)) {
    throw new TypeError("Снимок CRM имеет неверный формат.");
  }

  const source = input;
  const hasCoreCollections = [
    source.clients,
    source.contacts,
    source.deals,
    source.interactions,
  ].every(Array.isArray);
  if (!hasCoreCollections || !isRecord(source.dictionaries)) {
    throw new TypeError("В снимке CRM отсутствуют обязательные коллекции.");
  }

  const isV2 = source.schemaVersion === CRM_SCHEMA_VERSION;

  const teamsSource =
    isV2 && Array.isArray(source.teams) ? source.teams : demoTeams;
  const teams = teamsSource.map((team, index) =>
    normalizeTeam(team, migratedAt, index),
  );
  if (!teams.length) teams.push(clone(demoTeams[0]));

  const fallbackTeamId = teams[0]?.id ?? DEMO_TEAM_ID;
  const usersSource =
    isV2 && Array.isArray(source.users) ? source.users : demoUsers;
  const users = usersSource.map((user, index) =>
    normalizeUser(user, migratedAt, index, fallbackTeamId),
  );

  for (const managerName of collectLegacyManagerNames(source)) {
    if (
      users.some(
        (user) =>
          user.fullName.toLocaleLowerCase("ru-RU") ===
          managerName.toLocaleLowerCase("ru-RU"),
      )
    ) {
      continue;
    }

    users.push({
      id: importedUserId(managerName),
      teamId: fallbackTeamId,
      fullName: managerName,
      email: "",
      role: "employee",
      jobTitle: "Менеджер по продажам",
      initials: initialsFromName(managerName),
      isActive: true,
      createdAt: migratedAt,
      updatedAt: migratedAt,
    });
  }

  ensureRecordOwnersExist(source, users, migratedAt, fallbackTeamId);
  if (!users.length) users.push(clone(demoUsers[0]));

  const userById = new Map(users.map((user) => [user.id, user]));
  const userIdByName = new Map(
    users.map((user) => [
      user.fullName.toLocaleLowerCase("ru-RU"),
      user.id,
    ]),
  );

  const sourceSession = asRecord(source.session);
  const requestedCurrentUserId = asString(
    sourceSession.currentUserId,
    asString(source.currentUserId, DEMO_USER_IDS.sofia),
  );
  const currentUserId = userById.has(requestedCurrentUserId)
    ? requestedCurrentUserId
    : (users.find((user) => user.role === "manager")?.id ?? users[0].id);
  const currentUser = userById.get(currentUserId) ?? users[0];
  const requestedTeamId = asString(
    sourceSession.activeTeamId,
    currentUser.teamId,
  );
  const activeTeamId = teams.some((team) => team.id === requestedTeamId)
    ? requestedTeamId
    : fallbackTeamId;
  const session: Session = {
    ...sourceSession,
    id: asString(sourceSession.id, demoSession.id),
    currentUserId,
    activeTeamId,
    startedAt: asString(sourceSession.startedAt, migratedAt),
  } as Session;

  const resolveOwnerId = (
    record: JsonRecord,
    fallbackOwnerId = currentUserId,
  ): string => {
    const explicitOwnerId = asString(record.ownerId);
    if (explicitOwnerId && userById.has(explicitOwnerId)) {
      return explicitOwnerId;
    }

    const managerName = asString(record.managerName)
      .trim()
      .toLocaleLowerCase("ru-RU");
    return userIdByName.get(managerName) ?? fallbackOwnerId;
  };

  const clients = asArray(source.clients).map<Client>((value) => {
    const record = asRecord(value);
    const ownerId = resolveOwnerId(record);
    const lastContactAt = asNullableString(record.lastContactAt);
    const createdAt = asString(record.createdAt, lastContactAt ?? migratedAt);
    const updatedAt = asString(record.updatedAt, lastContactAt ?? createdAt);

    return {
      ...record,
      ownerId,
      managerName: asString(
        record.managerName,
        userById.get(ownerId)?.fullName ?? "",
      ),
      createdAt,
      updatedAt,
    } as unknown as Client;
  });
  const clientById = new Map(clients.map((client) => [client.id, client]));

  const contacts = asArray(source.contacts).map<Contact>((value) => {
    const record = asRecord(value);
    const client = clientById.get(asString(record.clientId));
    const ownerId = resolveOwnerId(record, client?.ownerId ?? currentUserId);
    const createdAt = asString(record.createdAt, client?.createdAt ?? migratedAt);

    return {
      ...record,
      ownerId,
      createdAt,
      updatedAt: asString(record.updatedAt, createdAt),
    } as unknown as Contact;
  });

  const deals = asArray(source.deals).map<Deal>((value) => {
    const record = asRecord(value);
    const client = clientById.get(asString(record.clientId));
    const ownerId = resolveOwnerId(record, client?.ownerId ?? currentUserId);
    const proposalDate = asNullableString(record.proposalDate);
    const createdAt = asString(
      record.createdAt,
      proposalDate ? `${proposalDate}T08:00:00.000Z` : migratedAt,
    );

    return {
      ...record,
      ownerId,
      managerName: asString(
        record.managerName,
        userById.get(ownerId)?.fullName ?? "",
      ),
      createdAt,
      updatedAt: asString(record.updatedAt, createdAt),
    } as unknown as Deal;
  });

  const interactions = asArray(source.interactions).map<Interaction>((value) => {
    const record = asRecord(value);
    const client = clientById.get(asString(record.clientId));
    const ownerId = resolveOwnerId(record, client?.ownerId ?? currentUserId);
    const occurredAt = asString(record.occurredAt, migratedAt);
    const createdAt = asString(record.createdAt, occurredAt);

    return {
      ...record,
      ownerId,
      managerName: asString(
        record.managerName,
        userById.get(ownerId)?.fullName ?? "",
      ),
      createdAt,
      updatedAt: asString(record.updatedAt, createdAt),
    } as unknown as Interaction;
  });

  const tasks = Array.isArray(source.tasks)
    ? source.tasks.map((task, index) =>
        normalizeTask(task, migratedAt, index, currentUserId),
      )
    : createTasksFromLegacyRecords(
        clients,
        deals,
        interactions,
        currentUserId,
      );

  const statusEvents = Array.isArray(source.statusEvents)
    ? source.statusEvents.map((event, index) =>
        normalizeStatusEvent(event, migratedAt, index, currentUserId),
      )
    : createInitialStatusEvents(clients, deals);

  const targetSource = Array.isArray(source.targets)
    ? source.targets
    : demoTargets;
  const targets = targetSource.map((target, index) =>
    normalizeTarget(target, migratedAt, index, activeTeamId),
  );

  return {
    schemaVersion: CRM_SCHEMA_VERSION,
    teams,
    users,
    session,
    clients,
    contacts,
    deals,
    interactions,
    tasks,
    statusEvents,
    targets,
    dictionaries: normalizeDictionaries(
      source.dictionaries,
      demoSnapshot.dictionaries,
    ),
  };
};

export interface CrmGateway {
  load(signal?: AbortSignal): Promise<CrmSnapshot>;
  save(snapshot: CrmSnapshot): Promise<void>;
  reset(): Promise<CrmSnapshot>;
}

class BrowserMockGateway implements CrmGateway {
  async load(signal?: AbortSignal): Promise<CrmSnapshot> {
    await pause();
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const stored = window.localStorage.getItem(CRM_STORAGE_KEY);
    if (stored) {
      try {
        const snapshot = migrateCrmSnapshot(JSON.parse(stored));
        window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(snapshot));
        return snapshot;
      } catch {
        window.localStorage.removeItem(CRM_STORAGE_KEY);
      }
    }

    const legacy = window.localStorage.getItem(LEGACY_CRM_STORAGE_KEY);
    if (legacy) {
      try {
        const snapshot = migrateCrmSnapshot(JSON.parse(legacy));
        window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(snapshot));
        return snapshot;
      } catch {
        // Keep the v1 value as a recoverable backup and fall back to demo data.
      }
    }

    return clone(demoSnapshot);
  }

  async save(snapshot: CrmSnapshot): Promise<void> {
    const normalized = migrateCrmSnapshot(snapshot);
    window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(normalized));
  }

  async reset(): Promise<CrmSnapshot> {
    const snapshot = clone(demoSnapshot);
    window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(snapshot));
    window.localStorage.removeItem(LEGACY_CRM_STORAGE_KEY);
    await pause(180);
    return snapshot;
  }
}

export const crmGateway: CrmGateway = new BrowserMockGateway();
