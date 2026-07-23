export type ChatUserRole = "employee" | "manager";

export interface ChatUser {
  id: string;
  name: string;
  role: ChatUserRole;
  title?: string;
  online?: boolean;
}

export interface ChatClientContext {
  id: string;
  name: string;
  subtitle?: string;
}

export type ChatConversationKind = "direct" | "group";

export interface ChatConversation {
  id: string;
  kind: ChatConversationKind;
  participantIds: string[];
  title?: string;
  client?: ChatClientContext;
  createdAt: string;
  updatedAt: string;
}

export type ChatMessageStatus = "sending" | "sent" | "failed";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  status: ChatMessageStatus;
  readBy: string[];
  sendAttempts: number;
}

export interface ChatSnapshot {
  version: 1;
  conversations: ChatConversation[];
  messages: ChatMessage[];
}

export type ChatStorageMode = "indexeddb" | "localStorage" | "memory";

export interface ChatLoadResult {
  snapshot: ChatSnapshot;
  storageMode: ChatStorageMode;
}

export interface ChatGateway {
  load(seed: () => ChatSnapshot): Promise<ChatLoadResult>;
  save(snapshot: ChatSnapshot): Promise<ChatStorageMode>;
  clear(): Promise<void>;
}

export interface CreateChatGatewayOptions {
  namespace?: string;
}

const DATABASE_NAME = "gofra-crm-chat";
const DATABASE_VERSION = 1;
const STORE_NAME = "snapshots";
const DEFAULT_NAMESPACE = "internal";
const LOCAL_STORAGE_PREFIX = "gofra-crm:chat:v1:";

const memoryStore = new Map<string, ChatSnapshot>();

const cloneSnapshot = (snapshot: ChatSnapshot): ChatSnapshot => {
  if (typeof structuredClone === "function") {
    return structuredClone(snapshot);
  }
  return JSON.parse(JSON.stringify(snapshot)) as ChatSnapshot;
};

const cleanNamespace = (value: string) => {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized || DEFAULT_NAMESPACE;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isClientContext = (value: unknown): value is ChatClientContext => {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<ChatClientContext>;
  return (
    typeof context.id === "string" &&
    typeof context.name === "string" &&
    (context.subtitle === undefined || typeof context.subtitle === "string")
  );
};

const isConversation = (value: unknown): value is ChatConversation => {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Partial<ChatConversation>;
  return (
    typeof conversation.id === "string" &&
    (conversation.kind === "direct" || conversation.kind === "group") &&
    isStringArray(conversation.participantIds) &&
    (conversation.title === undefined || typeof conversation.title === "string") &&
    (conversation.client === undefined ||
      isClientContext(conversation.client)) &&
    typeof conversation.createdAt === "string" &&
    typeof conversation.updatedAt === "string"
  );
};

const isMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    typeof message.conversationId === "string" &&
    typeof message.senderId === "string" &&
    typeof message.body === "string" &&
    typeof message.createdAt === "string" &&
    (message.status === "sending" ||
      message.status === "sent" ||
      message.status === "failed") &&
    isStringArray(message.readBy) &&
    typeof message.sendAttempts === "number"
  );
};

const isSnapshot = (value: unknown): value is ChatSnapshot => {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ChatSnapshot>;
  return (
    snapshot.version === 1 &&
    Array.isArray(snapshot.conversations) &&
    snapshot.conversations.every(isConversation) &&
    Array.isArray(snapshot.messages) &&
    snapshot.messages.every(isMessage)
  );
};

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed")),
      { once: true },
    );
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed")),
      { once: true },
    );
  });

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.addEventListener(
      "upgradeneeded",
      () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      },
      { once: true },
    );
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB could not be opened")),
      { once: true },
    );
    request.addEventListener(
      "blocked",
      () => reject(new Error("IndexedDB upgrade was blocked")),
      { once: true },
    );
  });

const readIndexedDb = async (namespace: string) => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const value = await requestResult(
      transaction.objectStore(STORE_NAME).get(namespace),
    );
    await transactionDone(transaction);
    return value;
  } finally {
    database.close();
  }
};

const writeIndexedDb = async (
  namespace: string,
  snapshot: ChatSnapshot,
) => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(snapshot, namespace);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
};

const deleteIndexedDb = async (namespace: string) => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(namespace);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
};

const readLocalStorage = (key: string) => {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as unknown) : undefined;
};

const writeLocalStorage = (key: string, snapshot: ChatSnapshot) => {
  if (typeof localStorage === "undefined") {
    throw new Error("localStorage is unavailable");
  }
  localStorage.setItem(key, JSON.stringify(snapshot));
};

export function createChatGateway(
  options: CreateChatGatewayOptions = {},
): ChatGateway {
  const namespace = cleanNamespace(options.namespace ?? DEFAULT_NAMESPACE);
  const localStorageKey = `${LOCAL_STORAGE_PREFIX}${namespace}`;

  const save = async (snapshot: ChatSnapshot): Promise<ChatStorageMode> => {
    const safeSnapshot = cloneSnapshot(snapshot);
    memoryStore.set(namespace, safeSnapshot);

    let indexedDbSaved = false;
    let localStorageSaved = false;

    try {
      await writeIndexedDb(namespace, safeSnapshot);
      indexedDbSaved = true;
    } catch {
      indexedDbSaved = false;
    }

    try {
      writeLocalStorage(localStorageKey, safeSnapshot);
      localStorageSaved = true;
    } catch {
      localStorageSaved = false;
    }

    if (indexedDbSaved) return "indexeddb";
    if (localStorageSaved) return "localStorage";
    return "memory";
  };

  return {
    async load(seed) {
      try {
        const indexedValue = await readIndexedDb(namespace);
        if (isSnapshot(indexedValue)) {
          const snapshot = cloneSnapshot(indexedValue);
          memoryStore.set(namespace, snapshot);
          return { snapshot, storageMode: "indexeddb" };
        }
      } catch {
        // Private browsing and restrictive browser policies can disable IndexedDB.
      }

      try {
        const localValue = readLocalStorage(localStorageKey);
        if (isSnapshot(localValue)) {
          const snapshot = cloneSnapshot(localValue);
          memoryStore.set(namespace, snapshot);
          try {
            await writeIndexedDb(namespace, snapshot);
          } catch {
            // localStorage remains the active source when IndexedDB cannot recover.
          }
          return { snapshot, storageMode: "localStorage" };
        }
      } catch {
        // Invalid or inaccessible local data falls through to the memory copy.
      }

      const memoryValue = memoryStore.get(namespace);
      if (memoryValue) {
        return {
          snapshot: cloneSnapshot(memoryValue),
          storageMode: "memory",
        };
      }

      const snapshot = cloneSnapshot(seed());
      const storageMode = await save(snapshot);
      return { snapshot, storageMode };
    },

    save,

    async clear() {
      memoryStore.delete(namespace);
      try {
        await deleteIndexedDb(namespace);
      } catch {
        // Clearing one storage is still useful when another one is unavailable.
      }
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(localStorageKey);
        }
      } catch {
        // No action is required for an inaccessible fallback.
      }
    },
  };
}

const isoMinutesAgo = (minutes: number, now: number) =>
  new Date(now - minutes * 60_000).toISOString();

const uniqueUsers = (users: ChatUser[]) => {
  const seen = new Set<string>();
  return users.filter((user) => {
    if (!user.id || seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
};

const fallbackClients: ChatClientContext[] = [
  {
    id: "demo-client-baltic",
    name: "Балтийская упаковка",
    subtitle: "Запрос на пятислойный гофрокартон",
  },
  {
    id: "demo-client-north",
    name: "Северный картон",
    subtitle: "Тестовая поставка",
  },
];

export function createChatDemoSnapshot(
  currentUser: ChatUser,
  visibleUsers: ChatUser[],
  clients: ChatClientContext[] = [],
): ChatSnapshot {
  const now = Date.now();
  const teammates = uniqueUsers(visibleUsers).filter(
    (user) => user.id !== currentUser.id,
  );
  const contexts = clients.length ? clients : fallbackClients;
  const conversations: ChatConversation[] = [];
  const messages: ChatMessage[] = [];

  const addMessage = (
    conversationId: string,
    id: string,
    senderId: string,
    body: string,
    minutesAgo: number,
    readBy: string[],
    status: ChatMessageStatus = "sent",
    sendAttempts = 1,
  ) => {
    messages.push({
      id,
      conversationId,
      senderId,
      body,
      createdAt: isoMinutesAgo(minutesAgo, now),
      status,
      readBy,
      sendAttempts,
    });
  };

  const first = teammates[0];
  if (first) {
    const id = `direct:${[currentUser.id, first.id].sort().join(":")}:demo`;
    conversations.push({
      id,
      kind: "direct",
      participantIds: [currentUser.id, first.id],
      client: contexts[0],
      createdAt: isoMinutesAgo(198, now),
      updatedAt: isoMinutesAgo(7, now),
    });
    addMessage(
      id,
      `${id}:1`,
      first.id,
      "Получил расчёт по коробам. Маржа держится в согласованном диапазоне.",
      198,
      [first.id, currentUser.id],
    );
    addMessage(
      id,
      `${id}:2`,
      currentUser.id,
      "Хорошо. Прикреплю расчёт к карточке клиента и отправлю КП.",
      184,
      [first.id, currentUser.id],
    );
    addMessage(
      id,
      `${id}:3`,
      first.id,
      "Проверь срок производства: клиенту нужен ответ до 16:00.",
      7,
      [first.id],
    );
  }

  const second = teammates[1];
  if (second) {
    const id = `direct:${[currentUser.id, second.id].sort().join(":")}:demo`;
    conversations.push({
      id,
      kind: "direct",
      participantIds: [currentUser.id, second.id],
      client: contexts[1],
      createdAt: isoMinutesAgo(1_560, now),
      updatedAt: isoMinutesAgo(83, now),
    });
    addMessage(
      id,
      `${id}:1`,
      second.id,
      "На тестовую поставку подтвердили слот в четверг утром.",
      122,
      [second.id, currentUser.id],
    );
    addMessage(
      id,
      `${id}:2`,
      currentUser.id,
      "Передаю финальные параметры в производство.",
      83,
      [currentUser.id],
      "failed",
      1,
    );
  }

  if (teammates.length >= 2) {
    const participants = [
      currentUser.id,
      ...teammates.slice(0, 3).map((user) => user.id),
    ];
    const id = `group:commercial:${participants.sort().join(":")}`;
    conversations.push({
      id,
      kind: "group",
      participantIds: participants,
      title: "Коммерческий отдел",
      createdAt: isoMinutesAgo(4_320, now),
      updatedAt: isoMinutesAgo(310, now),
    });
    addMessage(
      id,
      `${id}:1`,
      teammates[1].id,
      "Обновил статусы по активным КП. Две компании ждут образцы.",
      344,
      participants,
    );
    addMessage(
      id,
      `${id}:2`,
      teammates[0].id,
      "Увидел. Заберу проверку спецификаций после планёрки.",
      310,
      participants,
    );
  }

  return {
    version: 1,
    conversations,
    messages,
  };
}
