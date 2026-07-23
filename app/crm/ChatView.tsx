"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  createChatDemoSnapshot,
  createChatGateway,
  type ChatClientContext,
  type ChatConversation,
  type ChatMessage,
  type ChatSnapshot,
  type ChatStorageMode,
  type ChatUser,
} from "./chat-gateway";
import type { CrmSnapshot, User } from "./domain";
import "./chat.css";

export interface ChatViewProps {
  snapshot: CrmSnapshot;
  currentUser: User;
  onOpenClient?: (clientId: string) => void;
}

interface ConversationRow {
  conversation: ChatConversation;
  title: string;
  preview: string;
  timestamp: string;
  unread: number;
  avatarId: string;
  avatarLabel: string;
  online: boolean;
}

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(date);
};

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getDayKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatDayLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const dateStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const difference = Math.round((todayStart - dateStart) / 86_400_000);

  if (difference === 0) return "Сегодня";
  if (difference === 1) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
};

const getInitials = (value: string) => {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("ru");
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toLocaleUpperCase("ru");
};

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("ru").replace(/\s+/g, " ");

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const avatarTone = (value: string) => String(hashString(value) % 5);

const createId = (prefix: string) => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
};

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const getDirectPeer = (
  conversation: ChatConversation,
  currentUserId: string,
  users: Map<string, ChatUser>,
) => {
  const peerId = conversation.participantIds.find(
    (participantId) => participantId !== currentUserId,
  );
  return peerId ? users.get(peerId) : undefined;
};

const getConversationTitle = (
  conversation: ChatConversation,
  currentUserId: string,
  users: Map<string, ChatUser>,
) => {
  if (conversation.title) return conversation.title;
  const peer = getDirectPeer(conversation, currentUserId, users);
  return peer?.name ?? "Недоступный сотрудник";
};

const roleLabel = (user: ChatUser | undefined) => {
  if (!user) return "Профиль недоступен";
  if (user.online) return "В сети";
  if (user.title) return user.title;
  return user.role === "manager" ? "Руководитель" : "Сотрудник";
};

const toChatUser = (user: User, currentUserId: string): ChatUser => ({
  id: user.id,
  name: user.fullName,
  role: user.role,
  title: user.jobTitle,
  online: user.id === currentUserId,
});

const recoverInterruptedMessages = (snapshot: ChatSnapshot) => {
  let changed = false;
  const messages = snapshot.messages.map((message) => {
    if (message.status !== "sending") return message;
    changed = true;
    return { ...message, status: "failed" as const };
  });
  return changed ? { ...snapshot, messages } : snapshot;
};

export function ChatView({
  snapshot: crmSnapshot,
  currentUser: crmCurrentUser,
  onOpenClient,
}: ChatViewProps) {
  const currentUser = useMemo(
    () => toChatUser(crmCurrentUser, crmCurrentUser.id),
    [crmCurrentUser],
  );
  const visibleUsers = useMemo(
    () =>
      crmSnapshot.users
        .filter(
          (user) =>
            user.isActive && user.teamId === crmCurrentUser.teamId,
        )
        .map((user) => toChatUser(user, crmCurrentUser.id)),
    [crmCurrentUser.id, crmCurrentUser.teamId, crmSnapshot.users],
  );
  const clients = useMemo<ChatClientContext[]>(
    () =>
      crmSnapshot.clients.map((client) => ({
        id: client.id,
        name: client.companyName,
        subtitle:
          client.nextAction ||
          client.status ||
          "Карточка клиента",
      })),
    [crmSnapshot.clients],
  );
  const searchInputId = useId();
  const recipientSelectId = useId();
  const clientSelectId = useId();
  const composerId = useId();
  const gateway = useMemo(
    () =>
      createChatGateway({
        namespace: `team-${crmCurrentUser.teamId}`,
      }),
    [crmCurrentUser.teamId],
  );
  const seedRef = useRef({
    currentUser,
    visibleUsers,
    clients,
  });
  seedRef.current = { currentUser, visibleUsers, clients };

  const [snapshot, setSnapshot] = useState<ChatSnapshot | null>(null);
  const snapshotRef = useRef<ChatSnapshot | null>(null);
  const [storageMode, setStorageMode] = useState<ChatStorageMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [draft, setDraft] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newRecipientId, setNewRecipientId] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const loadChat = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await gateway.load(() =>
        createChatDemoSnapshot(
          seedRef.current.currentUser,
          seedRef.current.visibleUsers,
          seedRef.current.clients,
        ),
      );
      const recovered = recoverInterruptedMessages(result.snapshot);
      if (!mountedRef.current) return;
      snapshotRef.current = recovered;
      setSnapshot(recovered);
      setStorageMode(result.storageMode);
      setActiveConversationId((current) => {
        if (
          current &&
          recovered.conversations.some(
            (conversation) => conversation.id === current,
          )
        ) {
          return current;
        }
        return null;
      });
      if (recovered !== result.snapshot) {
        void gateway.save(recovered).then((mode) => {
          if (mountedRef.current) setStorageMode(mode);
        });
      }
    } catch {
      if (mountedRef.current) {
        setError("Не удалось открыть локальную историю чата.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    mountedRef.current = true;
    void loadChat();
    return () => {
      mountedRef.current = false;
    };
  }, [loadChat]);

  const persist = useCallback(
    (next: ChatSnapshot) => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const mode = await gateway.save(next);
          if (mountedRef.current) setStorageMode(mode);
        })
        .catch(() => {
          if (mountedRef.current) setStorageMode("memory");
        });
    },
    [gateway],
  );

  const commit = useCallback(
    (update: (current: ChatSnapshot) => ChatSnapshot) => {
      const current = snapshotRef.current;
      if (!current) return;
      const next = update(current);
      if (next === current) return;
      snapshotRef.current = next;
      setSnapshot(next);
      persist(next);
    },
    [persist],
  );

  const users = useMemo(() => {
    const map = new Map<string, ChatUser>();
    map.set(currentUser.id, currentUser);
    visibleUsers.forEach((user) => map.set(user.id, user));
    return map;
  }, [currentUser, visibleUsers]);

  const availableRecipients = useMemo(
    () =>
      visibleUsers.filter(
        (user, index, source) =>
          user.id !== currentUser.id &&
          source.findIndex((candidate) => candidate.id === user.id) === index,
      ),
    [currentUser.id, visibleUsers],
  );

  useEffect(() => {
    if (
      !newRecipientId ||
      !availableRecipients.some((user) => user.id === newRecipientId)
    ) {
      setNewRecipientId(availableRecipients[0]?.id ?? "");
    }
  }, [availableRecipients, newRecipientId]);

  const messagesByConversation = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    snapshot?.messages.forEach((message) => {
      const list = map.get(message.conversationId) ?? [];
      list.push(message);
      map.set(message.conversationId, list);
    });
    map.forEach((messages) =>
      messages.sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      ),
    );
    return map;
  }, [snapshot]);

  const conversationRows = useMemo<ConversationRow[]>(() => {
    if (!snapshot) return [];
    const normalizedQuery = normalize(query);

    return snapshot.conversations
      .filter((conversation) =>
        conversation.participantIds.includes(currentUser.id),
      )
      .map((conversation) => {
        const messages = messagesByConversation.get(conversation.id) ?? [];
        const latest = messages.at(-1);
        const title = getConversationTitle(
          conversation,
          currentUser.id,
          users,
        );
        const peer = getDirectPeer(conversation, currentUser.id, users);
        const preview = latest?.body ?? "Сообщений пока нет";
        const unread = messages.filter(
          (message) =>
            message.senderId !== currentUser.id &&
            !message.readBy.includes(currentUser.id),
        ).length;
        const searchable = normalize(
          [
            title,
            preview,
            conversation.client?.name ?? "",
            conversation.client?.subtitle ?? "",
            ...messages.slice(-8).map((message) => message.body),
          ].join(" "),
        );

        return {
          conversation,
          title,
          preview,
          timestamp: formatTime(
            latest?.createdAt ?? conversation.updatedAt,
          ),
          unread,
          avatarId: peer?.id ?? conversation.id,
          avatarLabel:
            conversation.kind === "group"
              ? conversation.title ?? "Команда"
              : peer?.name ?? title,
          online: conversation.kind === "direct" && Boolean(peer?.online),
          searchable,
        };
      })
      .filter(
        (row) =>
          !normalizedQuery ||
          row.searchable.includes(normalizedQuery),
      )
      .sort(
        (left, right) =>
          new Date(right.conversation.updatedAt).getTime() -
          new Date(left.conversation.updatedAt).getTime(),
      )
      .map(({ searchable: _searchable, ...row }) => row);
  }, [currentUser.id, messagesByConversation, query, snapshot, users]);

  const totalUnread = useMemo(() => {
    if (!snapshot) return 0;
    const visibleConversationIds = new Set(
      snapshot.conversations
        .filter((conversation) =>
          conversation.participantIds.includes(currentUser.id),
        )
        .map((conversation) => conversation.id),
    );
    return snapshot.messages.filter(
      (message) =>
        visibleConversationIds.has(message.conversationId) &&
        message.senderId !== currentUser.id &&
        !message.readBy.includes(currentUser.id),
    ).length;
  }, [currentUser.id, snapshot]);

  const activeConversation =
    snapshot?.conversations.find(
      (conversation) =>
        conversation.id === activeConversationId &&
        conversation.participantIds.includes(currentUser.id),
    ) ?? null;
  const activeMessages = activeConversation
    ? messagesByConversation.get(activeConversation.id) ?? []
    : [];
  const activePeer = activeConversation
    ? getDirectPeer(activeConversation, currentUser.id, users)
    : undefined;
  const activeTitle = activeConversation
    ? getConversationTitle(activeConversation, currentUser.id, users)
    : "";

  const activeUnreadSignature = activeMessages
    .filter(
      (message) =>
        message.senderId !== currentUser.id &&
        !message.readBy.includes(currentUser.id),
    )
    .map((message) => message.id)
    .join("|");

  useEffect(() => {
    if (!activeConversationId || !activeUnreadSignature) return;
    const unreadIds = new Set(activeUnreadSignature.split("|"));
    commit((current) => ({
      ...current,
      messages: current.messages.map((message) =>
        unreadIds.has(message.id)
          ? {
              ...message,
              readBy: [...new Set([...message.readBy, currentUser.id])],
            }
          : message,
      ),
    }));
  }, [
    activeConversationId,
    activeUnreadSignature,
    commit,
    currentUser.id,
  ]);

  const messagePositionSignature = activeMessages
    .map((message) => `${message.id}:${message.status}`)
    .join("|");

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    const frame = window.requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeConversationId, messagePositionSignature]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showNewConversation) {
        setShowNewConversation(false);
      } else {
        setActiveConversationId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showNewConversation]);

  const openConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setShowNewConversation(false);
    setDraft("");
  };

  const handleStartConversation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newRecipientId || !snapshotRef.current) return;

    const participantIds = [currentUser.id, newRecipientId].sort();
    const selectedClient = clients.find(
      (client) => client.id === newClientId,
    );
    const existing = snapshotRef.current.conversations.find(
      (conversation) =>
        conversation.kind === "direct" &&
        conversation.participantIds.length === 2 &&
        conversation.participantIds.every((id) =>
          participantIds.includes(id),
        ) &&
        (conversation.client?.id ?? "") === (selectedClient?.id ?? ""),
    );

    if (existing) {
      openConversation(existing.id);
      return;
    }

    const now = new Date().toISOString();
    const conversation: ChatConversation = {
      id: createId("conversation"),
      kind: "direct",
      participantIds,
      ...(selectedClient ? { client: selectedClient } : {}),
      createdAt: now,
      updatedAt: now,
    };
    commit((current) => ({
      ...current,
      conversations: [conversation, ...current.conversations],
    }));
    setActiveConversationId(conversation.id);
    setShowNewConversation(false);
    setNewClientId("");
    setDraft("");
  };

  const deliverMessage = useCallback(
    async (messageId: string) => {
      const pending = snapshotRef.current?.messages.find(
        (message) => message.id === messageId,
      );
      if (!pending) return;
      const conversation = snapshotRef.current?.conversations.find(
        (item) => item.id === pending.conversationId,
      );
      if (!conversation) return;

      try {
        await delay(460 + (hashString(messageId) % 420));
        const shouldFail =
          pending.sendAttempts === 1 &&
          hashString(`${messageId}:${pending.body}`) % 13 === 0;
        if (shouldFail) throw new Error("Simulated local delivery failure");
        if (!mountedRef.current) return;
        commit((current) => ({
          ...current,
          messages: current.messages.map((message) =>
            message.id === messageId
              ? { ...message, status: "sent" as const }
              : message,
          ),
        }));
        setLiveMessage("Сообщение отправлено");
      } catch {
        if (!mountedRef.current) return;
        commit((current) => ({
          ...current,
          messages: current.messages.map((message) =>
            message.id === messageId
              ? { ...message, status: "failed" as const }
              : message,
          ),
        }));
        setLiveMessage("Сообщение не отправлено");
      }
    },
    [commit],
  );

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeConversation) return;

    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: createId("message"),
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      body,
      createdAt: now,
      status: "sending",
      readBy: [currentUser.id],
      sendAttempts: 1,
    };
    commit((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === activeConversation.id
          ? { ...conversation, updatedAt: now }
          : conversation,
      ),
      messages: [...current.messages, message],
    }));
    setDraft("");
    setLiveMessage("Сообщение отправляется");
    void deliverMessage(message.id);
  };

  const retryMessage = (messageId: string) => {
    const currentMessage = snapshotRef.current?.messages.find(
      (message) => message.id === messageId,
    );
    if (!currentMessage || currentMessage.status !== "failed") return;
    const now = new Date().toISOString();
    commit((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === currentMessage.conversationId
          ? { ...conversation, updatedAt: now }
          : conversation,
      ),
      messages: current.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              status: "sending" as const,
              sendAttempts: message.sendAttempts + 1,
            }
          : message,
      ),
    }));
    setLiveMessage("Повторная отправка");
    void deliverMessage(messageId);
  };

  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  if (loading) {
    return <ChatSkeleton />;
  }

  if (error || !snapshot) {
    return (
      <section
        className="chat-view chat-error"
      >
        <div>
          <span className="chat-error-mark" aria-hidden="true">
            !
          </span>
          <h2>Чат временно недоступен</h2>
          <p>{error || "Локальная история не загрузилась."}</p>
          <button className="chat-primary-button" onClick={loadChat} type="button">
            Повторить
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Внутренний чат"
      className={[
        "chat-view",
        activeConversation ? "chat-has-active-thread" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-storage-mode={storageMode ?? undefined}
    >
      <aside className="chat-sidebar" aria-label="Диалоги">
        <header className="chat-sidebar-header">
          <div>
            <span className="chat-kicker">Команда</span>
            <div className="chat-title-row">
              <h2>Сообщения</h2>
              {totalUnread > 0 && (
                <span
                  aria-label={`Непрочитанных сообщений: ${totalUnread}`}
                  className="chat-total-unread"
                >
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
          </div>
          <button
            aria-expanded={showNewConversation}
            aria-label="Новый диалог"
            className="chat-icon-button chat-compose-button"
            onClick={() => setShowNewConversation((value) => !value)}
            type="button"
          >
            <ComposeIcon />
          </button>
        </header>

        <div className="chat-search">
          <label className="chat-visually-hidden" htmlFor={searchInputId}>
            Поиск по диалогам
          </label>
          <SearchIcon />
          <input
            id={searchInputId}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Сотрудник, клиент или сообщение"
            type="search"
            value={query}
          />
          {query && (
            <button
              aria-label="Очистить поиск"
              onClick={() => setQuery("")}
              type="button"
            >
              Сбросить
            </button>
          )}
        </div>

        {showNewConversation && (
          <form
            className="chat-new-conversation"
            onSubmit={handleStartConversation}
          >
            <div className="chat-new-conversation-heading">
              <strong>Новый диалог</strong>
              <button
                aria-label="Закрыть создание диалога"
                onClick={() => setShowNewConversation(false)}
                type="button"
              >
                Закрыть
              </button>
            </div>
            {availableRecipients.length ? (
              <>
                <label htmlFor={recipientSelectId}>Сотрудник</label>
                <select
                  id={recipientSelectId}
                  onChange={(event) => setNewRecipientId(event.target.value)}
                  required
                  value={newRecipientId}
                >
                  {availableRecipients.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                {clients.length > 0 && (
                  <>
                    <label htmlFor={clientSelectId}>Контекст клиента</label>
                    <select
                      id={clientSelectId}
                      onChange={(event) => setNewClientId(event.target.value)}
                      value={newClientId}
                    >
                      <option value="">Без привязки</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <button className="chat-primary-button" type="submit">
                  Начать переписку
                </button>
              </>
            ) : (
              <p>
                Нет доступных сотрудников. Состав команды задаётся правами
                текущего пользователя.
              </p>
            )}
          </form>
        )}

        {storageMode === "memory" && (
          <p className="chat-storage-warning" role="status">
            Браузер запретил локальное хранение. История сохранится только до
            закрытия вкладки.
          </p>
        )}

        <div className="chat-conversation-list">
          {conversationRows.length ? (
            conversationRows.map((row, index) => (
              <button
                aria-current={
                  activeConversationId === row.conversation.id
                    ? "true"
                    : undefined
                }
                className={
                  activeConversationId === row.conversation.id
                    ? "chat-conversation is-active"
                    : "chat-conversation"
                }
                key={row.conversation.id}
                onClick={() => openConversation(row.conversation.id)}
                style={{ "--chat-row-index": index } as React.CSSProperties}
                type="button"
              >
                <ChatAvatar
                  id={row.avatarId}
                  label={row.avatarLabel}
                  online={row.online}
                />
                <span className="chat-conversation-copy">
                  <span className="chat-conversation-topline">
                    <strong>{row.title}</strong>
                    <time>{row.timestamp}</time>
                  </span>
                  <span className="chat-conversation-preview">
                    {row.preview}
                  </span>
                  {row.conversation.client && (
                    <span className="chat-client-label">
                      <ClientIcon />
                      {row.conversation.client.name}
                    </span>
                  )}
                </span>
                {row.unread > 0 && (
                  <span
                    aria-label={`Непрочитанных: ${row.unread}`}
                    className="chat-unread"
                  >
                    {row.unread > 99 ? "99+" : row.unread}
                  </span>
                )}
              </button>
            ))
          ) : (
            <ChatListEmpty
              hasQuery={Boolean(query)}
              onClear={() => setQuery("")}
              onCreate={() => setShowNewConversation(true)}
            />
          )}
        </div>
      </aside>

      <main className="chat-thread">
        {activeConversation ? (
          <>
            <header className="chat-thread-header">
              <button
                aria-label="Вернуться к списку диалогов"
                className="chat-icon-button chat-mobile-back"
                onClick={() => setActiveConversationId(null)}
                type="button"
              >
                <BackIcon />
              </button>
              <ChatAvatar
                id={activePeer?.id ?? activeConversation.id}
                label={
                  activeConversation.kind === "group"
                    ? activeTitle
                    : activePeer?.name ?? activeTitle
                }
                online={Boolean(activePeer?.online)}
              />
              <div className="chat-thread-person">
                <h2>{activeTitle}</h2>
                <span>
                  {activeConversation.kind === "group"
                    ? `${activeConversation.participantIds.length} участника`
                    : roleLabel(activePeer)}
                </span>
              </div>
              <span
                className="chat-storage-status"
                title={
                  storageMode === "indexeddb"
                    ? "История сохраняется в IndexedDB"
                    : storageMode === "localStorage"
                      ? "История сохраняется в резервном хранилище"
                      : "История хранится до закрытия вкладки"
                }
              >
                <span aria-hidden="true" />
                На устройстве
              </span>
            </header>

            {activeConversation.client && (
              <div className="chat-client-context">
                <span className="chat-client-context-icon">
                  <ClientIcon />
                </span>
                <span>
                  <small>Контекст клиента</small>
                  <strong>{activeConversation.client.name}</strong>
                  {activeConversation.client.subtitle && (
                    <em>{activeConversation.client.subtitle}</em>
                  )}
                </span>
                {onOpenClient && (
                  <button
                    onClick={() =>
                      onOpenClient(activeConversation.client?.id ?? "")
                    }
                    type="button"
                  >
                    Открыть карточку
                  </button>
                )}
              </div>
            )}

            <div
              aria-label={`Переписка: ${activeTitle}`}
              className="chat-message-list"
              ref={messageListRef}
            >
              {activeMessages.length ? (
                <ol>
                  {activeMessages.map((message, index) => {
                    const previous = activeMessages[index - 1];
                    const showDay =
                      !previous ||
                      getDayKey(previous.createdAt) !==
                        getDayKey(message.createdAt);
                    const sender = users.get(message.senderId);
                    const outgoing = message.senderId === currentUser.id;
                    return (
                      <Fragment key={message.id}>
                        {showDay && (
                          <li className="chat-day-divider">
                            <span>{formatDayLabel(message.createdAt)}</span>
                          </li>
                        )}
                        <li
                          className={[
                            "chat-message",
                            outgoing ? "is-outgoing" : "is-incoming",
                            message.status === "failed" ? "is-failed" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {!outgoing && (
                            <ChatAvatar
                              compact
                              id={sender?.id ?? message.senderId}
                              label={sender?.name ?? "Сотрудник"}
                            />
                          )}
                          <div className="chat-message-content">
                            {!outgoing &&
                              activeConversation.kind === "group" && (
                                <span className="chat-message-author">
                                  {sender?.name ?? "Недоступный сотрудник"}
                                </span>
                              )}
                            <div className="chat-message-bubble">
                              <p>{message.body}</p>
                              <span className="chat-message-meta">
                                <time>{formatMessageTime(message.createdAt)}</time>
                                {outgoing && message.status === "sending" && (
                                  <span className="chat-sending">
                                    Отправляется
                                  </span>
                                )}
                                {outgoing && message.status === "sent" && (
                                  <SentIcon />
                                )}
                              </span>
                            </div>
                            {outgoing && message.status === "failed" && (
                              <button
                                className="chat-retry"
                                onClick={() => retryMessage(message.id)}
                                type="button"
                              >
                                <RetryIcon />
                                Не отправлено. Повторить
                              </button>
                            )}
                          </div>
                        </li>
                      </Fragment>
                    );
                  })}
                </ol>
              ) : (
                <div className="chat-thread-empty">
                  <span className="chat-empty-mark" aria-hidden="true">
                    <MessageIcon />
                  </span>
                  <h3>Начните диалог</h3>
                </div>
              )}
            </div>

            <form className="chat-composer" onSubmit={handleSend}>
              <label className="chat-visually-hidden" htmlFor={composerId}>
                Сообщение
              </label>
              <textarea
                id={composerId}
                maxLength={4_000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Напишите сообщение"
                rows={1}
                value={draft}
              />
              <button
                aria-label="Отправить сообщение"
                disabled={!draft.trim()}
                type="submit"
              >
                <SendIcon />
              </button>
              <span className="chat-composer-hint">
                Enter — отправить, Shift + Enter — новая строка
              </span>
            </form>
          </>
        ) : (
          <div className="chat-thread-placeholder">
            <span className="chat-placeholder-mark" aria-hidden="true">
              <MessageIcon />
            </span>
            <h2>Выберите диалог</h2>
          </div>
        )}
      </main>
      <span aria-live="polite" className="chat-visually-hidden">
        {liveMessage}
      </span>
    </section>
  );
}

function ChatAvatar({
  id,
  label,
  online = false,
  compact = false,
}: {
  id: string;
  label: string;
  online?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={[
        "chat-avatar",
        compact ? "is-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-tone={avatarTone(id)}
    >
      <span>{getInitials(label)}</span>
      {online && <i />}
    </span>
  );
}

function ChatListEmpty({
  hasQuery,
  onClear,
  onCreate,
}: {
  hasQuery: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="chat-list-empty">
      <span aria-hidden="true">
        {hasQuery ? <SearchIcon /> : <MessageIcon />}
      </span>
      <strong>{hasQuery ? "Ничего не найдено" : "Диалогов пока нет"}</strong>
      <p>
        {hasQuery
          ? "Попробуйте имя сотрудника, клиента или фразу из сообщения."
          : "Начните переписку с доступным сотрудником."}
      </p>
      <button onClick={hasQuery ? onClear : onCreate} type="button">
        {hasQuery ? "Очистить поиск" : "Новый диалог"}
      </button>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <section
      aria-label="Чат загружается"
      className="chat-view chat-skeleton"
      role="status"
    >
      <div className="chat-skeleton-sidebar">
        <span />
        <span />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <i />
            <span />
          </div>
        ))}
      </div>
      <div className="chat-skeleton-thread">
        <span />
        <div />
        <div />
        <div />
      </div>
    </section>
  );
}

function SvgIcon({
  children,
  viewBox = "0 0 24 24",
}: {
  children: ReactNode;
  viewBox?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      viewBox={viewBox}
    >
      {children}
    </svg>
  );
}

function SearchIcon() {
  return (
    <SvgIcon>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </SvgIcon>
  );
}

function ComposeIcon() {
  return (
    <SvgIcon>
      <path
        d="M13.2 5.1 18.9 10.8M5.2 18.8l1.2-5.2L16.8 3.2a1.7 1.7 0 0 1 2.4 0l1.6 1.6a1.7 1.7 0 0 1 0 2.4L10.4 17.6l-5.2 1.2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </SvgIcon>
  );
}

function BackIcon() {
  return (
    <SvgIcon>
      <path
        d="m15 5-7 7 7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

function SendIcon() {
  return (
    <SvgIcon>
      <path
        d="m4 4 17 8-17 8 2.6-6.2L14 12 6.6 10.2 4 4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </SvgIcon>
  );
}

function MessageIcon() {
  return (
    <SvgIcon>
      <path
        d="M5.5 17.5 3.8 21l4.4-1.7c1.2.5 2.5.7 3.8.7 5 0 9-3.6 9-8s-4-8-9-8-9 3.6-9 8c0 2.1 1 4 2.5 5.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M8 12h8M8 9h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </SvgIcon>
  );
}

function ClientIcon() {
  return (
    <SvgIcon>
      <path
        d="M4 20V7h10v13M14 11h6v9M8 10h2M8 14h2M8 18h2M17 14h1M17 17h1M2 20h20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}

function RetryIcon() {
  return (
    <SvgIcon>
      <path
        d="M19 8a8 8 0 1 0 .4 7M19 4v4h-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </SvgIcon>
  );
}

function SentIcon() {
  return (
    <SvgIcon viewBox="0 0 18 12">
      <path
        d="m1 6 3.2 3.2L12.4 1M6.5 7.5l1.7 1.7L16.4 1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </SvgIcon>
  );
}
