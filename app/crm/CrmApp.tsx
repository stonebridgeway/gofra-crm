"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { crmGateway } from "./crm-gateway";
import {
  CLIENT_PIPELINE,
  CLIENT_STATUSES,
  DEAL_PIPELINE,
  DEAL_STATUSES,
  type AppModule,
  type Client,
  type ClientStatus,
  type Contact,
  type CrmSnapshot,
  type Deal,
  type DealStatus,
  type Interaction,
  type InteractionKind,
  type PipelineGroup,
  type Potential,
} from "./domain";

type ViewMode = "board" | "list";
type DrawerTarget =
  | { kind: "client"; id: string }
  | { kind: "deal"; id: string }
  | null;
type MoveIntent =
  | {
      kind: "client" | "deal";
      id: string;
      title: string;
      statuses: readonly string[];
    }
  | null;
type CreateKind = "client" | "deal" | "contact" | "interaction" | null;

const MODULES: Array<{
  id: AppModule;
  short: string;
  label: string;
  eyebrow: string;
}> = [
  {
    id: "clients",
    short: "КЛ",
    label: "Клиенты",
    eyebrow: "Воронка клиентов",
  },
  {
    id: "deals",
    short: "СД",
    label: "Сделки",
    eyebrow: "Коммерческая воронка",
  },
  {
    id: "contacts",
    short: "КТ",
    label: "Контакты",
    eyebrow: "Контактные лица",
  },
  {
    id: "activity",
    short: "ИВ",
    label: "История",
    eyebrow: "Взаимодействия",
  },
  {
    id: "import",
    short: "ИМ",
    label: "Импорт",
    eyebrow: "Загрузка лидов",
  },
  {
    id: "dictionaries",
    short: "СП",
    label: "Справочники",
    eyebrow: "Настройки CRM",
  },
];

const managers = ["Софья Романова", "Николай Ветров", "Тимур Агапов"];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string | null, withTime = false) => {
  if (!value) return "Не назначено";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};

const getDueState = (value: string | null) => {
  if (!value) return { className: "due-neutral", label: "Без даты" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { className: "due-neutral", label: "Дата не указана" };
  }
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diff = Math.round(
    (startTarget.getTime() - startToday.getTime()) / 86_400_000,
  );

  if (diff < 0) {
    return {
      className: "due-overdue",
      label: `Просрочено на ${Math.abs(diff)} дн.`,
    };
  }
  if (diff === 0) return { className: "due-today", label: "Сегодня" };
  if (diff === 1) return { className: "due-soon", label: "Завтра" };
  return { className: "due-neutral", label: formatDate(value) };
};

const nextClientStatus = (status: ClientStatus | null) => {
  if (!status) return CLIENT_STATUSES[0];
  const linear = CLIENT_STATUSES.filter(
    (value) =>
      !["Не подходит", "Спящий клиент", "Отказ", "Черный список"].includes(
        value,
      ),
  );
  const index = linear.indexOf(status);
  return index >= 0 && index < linear.length - 1 ? linear[index + 1] : null;
};

const nextDealStatus = (status: DealStatus) => {
  const linear = DEAL_STATUSES.filter(
    (value) => !["Проиграна", "Отложена", "Отменена"].includes(value),
  );
  const index = linear.indexOf(status);
  return index >= 0 && index < linear.length - 1 ? linear[index + 1] : null;
};

const searchIncludes = (query: string, values: Array<string | null>) => {
  const normalized = query.trim().toLocaleLowerCase("ru");
  if (!normalized) return true;
  return values.some((value) =>
    (value ?? "").toLocaleLowerCase("ru").includes(normalized),
  );
};

export function CrmApp() {
  const [activeModule, setActiveModule] = useState<AppModule>("clients");
  const [snapshot, setSnapshot] = useState<CrmSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerTarget>(null);
  const [moveIntent, setMoveIntent] = useState<MoveIntent>(null);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [createClientId, setCreateClientId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await crmGateway.load();
      setSnapshot(next);
    } catch (loadError) {
      if (
        !(loadError instanceof DOMException && loadError.name === "AbortError")
      ) {
        setError("Не удалось открыть демо-данные. Попробуйте ещё раз.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void crmGateway
      .load(controller.signal)
      .then((next) => setSnapshot(next))
      .catch((loadError) => {
        if (
          !(
            loadError instanceof DOMException &&
            loadError.name === "AbortError"
          )
        ) {
          setError("Не удалось открыть демо-данные. Попробуйте ещё раз.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrawer(null);
      setMoveIntent(null);
      setCreateKind(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };

  const commit = (next: CrmSnapshot, message?: string) => {
    setSnapshot(next);
    void crmGateway.save(next).catch(() => {
      setError("Не удалось сохранить изменение в локальном демо-режиме.");
    });
    if (message) notify(message);
  };

  const moveClient = (id: string, status: ClientStatus) => {
    if (!snapshot) return;
    commit(
      {
        ...snapshot,
        clients: snapshot.clients.map((client) =>
          client.id === id ? { ...client, status } : client,
        ),
      },
      `Клиент перемещён: ${status}`,
    );
    setMoveIntent(null);
  };

  const moveDeal = (id: string, status: DealStatus) => {
    if (!snapshot) return;
    commit(
      {
        ...snapshot,
        deals: snapshot.deals.map((deal) =>
          deal.id === id ? { ...deal, status } : deal,
        ),
      },
      `Сделка перемещена: ${status}`,
    );
    setMoveIntent(null);
  };

  const requestClientMove = (
    client: Client,
    statuses: readonly string[] = CLIENT_STATUSES,
  ) => {
    setMoveIntent({
      kind: "client",
      id: client.id,
      title: client.companyName,
      statuses,
    });
  };

  const requestDealMove = (
    deal: Deal,
    statuses: readonly string[] = DEAL_STATUSES,
  ) => {
    setMoveIntent({
      kind: "deal",
      id: deal.id,
      title: deal.title,
      statuses,
    });
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot || !createKind) return;
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();

    if (createKind === "client") {
      const companyName = String(form.get("companyName") ?? "").trim();
      if (!companyName) return;
      const client: Client = {
        id: `КЛ-${Date.now().toString().slice(-4)}`,
        companyName,
        inn: String(form.get("inn") ?? ""),
        region: String(form.get("region") ?? ""),
        city: String(form.get("city") ?? ""),
        industry: String(form.get("industry") ?? "Другое"),
        produces: "",
        mayPurchase: String(form.get("mayPurchase") ?? ""),
        potential: String(form.get("potential") ?? "B") as Potential,
        status: String(form.get("status") ?? "Новый лид") as ClientStatus,
        source: String(form.get("source") ?? "Другое"),
        managerName: String(form.get("manager") ?? managers[0]),
        lastContactAt: null,
        nextAction: String(form.get("nextAction") ?? ""),
        nextActionAt: null,
        comment: "",
      };
      commit(
        { ...snapshot, clients: [client, ...snapshot.clients] },
        "Клиент добавлен в демо-режиме",
      );
    }

    if (createKind === "deal") {
      const title = String(form.get("title") ?? "").trim();
      const clientId = String(form.get("clientId") ?? "");
      if (!title || !clientId) return;
      const ourPrice = Number(form.get("ourPrice") ?? 0);
      const deal: Deal = {
        id: `СД-${Date.now().toString().slice(-4)}`,
        clientId,
        contactId: null,
        title,
        product: String(form.get("product") ?? ""),
        volume: String(form.get("volume") ?? ""),
        clientPrice: ourPrice,
        ourPrice,
        purchasePrice: Math.round(ourPrice * 0.68),
        logistics: Math.round(ourPrice * 0.08),
        margin: Math.round(ourPrice * 0.24),
        marginPercent: 24,
        status: String(form.get("status") ?? "Новая заявка") as DealStatus,
        proposalDate: null,
        nextAction: String(form.get("nextAction") ?? ""),
        nextActionAt: null,
        managerName: String(form.get("manager") ?? managers[0]),
        comment: "",
      };
      commit(
        { ...snapshot, deals: [deal, ...snapshot.deals] },
        "Сделка добавлена в демо-режиме",
      );
    }

    if (createKind === "contact") {
      const fullName = String(form.get("fullName") ?? "").trim();
      const clientId = String(
        form.get("clientId") ?? createClientId ?? "",
      );
      if (!fullName || !clientId) return;
      const contact: Contact = {
        id: `КТ-${Date.now().toString().slice(-4)}`,
        clientId,
        fullName,
        role: String(form.get("role") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        comment: "",
      };
      commit(
        { ...snapshot, contacts: [contact, ...snapshot.contacts] },
        "Контакт добавлен",
      );
    }

    if (createKind === "interaction") {
      const clientId = String(
        form.get("clientId") ?? createClientId ?? "",
      );
      const subject = String(form.get("subject") ?? "").trim();
      if (!clientId || !subject) return;
      const interaction: Interaction = {
        id: `ИВ-${Date.now().toString().slice(-4)}`,
        occurredAt: now,
        clientId,
        contactId: null,
        kind: String(form.get("kind") ?? "Звонок") as InteractionKind,
        subject,
        result: String(form.get("result") ?? ""),
        nextStep: String(form.get("nextStep") ?? ""),
        nextStepAt: null,
        managerName: String(form.get("manager") ?? managers[0]),
        comment: "",
      };
      commit(
        {
          ...snapshot,
          interactions: [interaction, ...snapshot.interactions],
        },
        "Взаимодействие записано",
      );
    }

    setCreateKind(null);
    setCreateClientId(null);
  };

  const openCreate = (kind: Exclude<CreateKind, null>, clientId?: string) => {
    setCreateKind(kind);
    setCreateClientId(clientId ?? null);
  };

  const resetDemo = async () => {
    setLoading(true);
    const next = await crmGateway.reset();
    setSnapshot(next);
    setLoading(false);
    notify("Демо-данные восстановлены");
  };

  const activeMeta = MODULES.find((item) => item.id === activeModule)!;

  return (
    <div className="crm-app">
      <aside className="side-nav" aria-label="Разделы CRM">
        <div className="brand-block">
          <span className="brand-mark">ГФ</span>
          <span className="brand-copy">
            <strong>ГОФРА</strong>
            <small>CRM workspace</small>
          </span>
        </div>
        <nav className="module-nav">
          {MODULES.map((module) => (
            <button
              className={module.id === activeModule ? "is-active" : ""}
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              type="button"
            >
              <span className="nav-short">{module.short}</span>
              <span>{module.label}</span>
            </button>
          ))}
        </nav>
        <div className="demo-user">
          <span>СР</span>
          <div>
            <strong>Софья Романова</strong>
            <small>Руководитель продаж</small>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p>{activeMeta.eyebrow}</p>
            <h1>{activeMeta.label}</h1>
          </div>
          <label className="global-search">
            <span>Поиск по CRM</span>
            <input
              aria-label="Поиск по всей CRM"
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Компания, ИНН, контакт, телефон"
              type="search"
              value={globalSearch}
            />
          </label>
          <button className="ghost-button" onClick={resetDemo} type="button">
            Сбросить демо
          </button>
        </header>

        <div className="prototype-note" role="note">
          <div>
            <strong>Frontend-only прототип</strong>
            <span>
              Все сущности и статусы из таблицы уже в интерфейсе. Изменения
              сохраняются только в этом браузере.
            </span>
          </div>
          <span className="prototype-badge">API-ready</span>
        </div>

        {loading ? (
          <WorkspaceSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : snapshot ? (
          <>
            {activeModule === "clients" && (
              <ClientsView
                clients={snapshot.clients}
                globalSearch={globalSearch}
                onAdvance={(client) => {
                  const status = nextClientStatus(client.status);
                  if (status) moveClient(client.id, status);
                }}
                onCreate={() => openCreate("client")}
                onOpen={(client) =>
                  setDrawer({ kind: "client", id: client.id })
                }
                onRequestMove={requestClientMove}
              />
            )}
            {activeModule === "deals" && (
              <DealsView
                clients={snapshot.clients}
                deals={snapshot.deals}
                globalSearch={globalSearch}
                onAdvance={(deal) => {
                  const status = nextDealStatus(deal.status);
                  if (status) moveDeal(deal.id, status);
                }}
                onCreate={() => openCreate("deal")}
                onOpen={(deal) => setDrawer({ kind: "deal", id: deal.id })}
                onRequestMove={requestDealMove}
              />
            )}
            {activeModule === "contacts" && (
              <ContactsView
                clients={snapshot.clients}
                contacts={snapshot.contacts}
                globalSearch={globalSearch}
                onCreate={() => openCreate("contact")}
                onLog={(contact) =>
                  openCreate("interaction", contact.clientId)
                }
                onOpenClient={(clientId) =>
                  setDrawer({ kind: "client", id: clientId })
                }
              />
            )}
            {activeModule === "activity" && (
              <ActivityView
                clients={snapshot.clients}
                globalSearch={globalSearch}
                interactions={snapshot.interactions}
                onCreate={() => openCreate("interaction")}
                onOpenClient={(clientId) =>
                  setDrawer({ kind: "client", id: clientId })
                }
              />
            )}
            {activeModule === "import" && (
              <ImportView
                onCommit={(status) => {
                  const importClients: Client[] = [
                    "Медовый край",
                    "Речной терминал",
                    "Формула заботы",
                  ].map((companyName, index) => ({
                    ...snapshot.clients[index],
                    id: `КЛ-IM${index + 1}`,
                    companyName,
                    status,
                    inn: `${7812007000 + index * 93}`,
                  }));
                  commit(
                    {
                      ...snapshot,
                      clients: [...importClients, ...snapshot.clients],
                    },
                    "Три лида добавлены в клиентский прототип",
                  );
                }}
              />
            )}
            {activeModule === "dictionaries" && (
              <DictionariesView snapshot={snapshot} />
            )}
          </>
        ) : null}
      </main>

      {drawer && snapshot && (
        <RecordDrawer
          drawer={drawer}
          snapshot={snapshot}
          onAddContact={(clientId) => openCreate("contact", clientId)}
          onAddInteraction={(clientId) =>
            openCreate("interaction", clientId)
          }
          onClose={() => setDrawer(null)}
          onMoveClient={requestClientMove}
          onMoveDeal={requestDealMove}
        />
      )}

      {moveIntent && (
        <StatusPicker
          intent={moveIntent}
          onChoose={(status) => {
            if (moveIntent.kind === "client") {
              moveClient(moveIntent.id, status as ClientStatus);
            } else {
              moveDeal(moveIntent.id, status as DealStatus);
            }
          }}
          onClose={() => setMoveIntent(null)}
        />
      )}

      {createKind && snapshot && (
        <CreateDialog
          clientId={createClientId}
          kind={createKind}
          onClose={() => {
            setCreateKind(null);
            setCreateClientId(null);
          }}
          onSubmit={handleCreate}
          snapshot={snapshot}
        />
      )}

      <div aria-live="polite" className={`toast ${toast ? "is-visible" : ""}`}>
        {toast}
      </div>
    </div>
  );
}

type BoardItem = { id: string; status: string | null };

function PipelineBoard<T extends BoardItem>({
  groups,
  items,
  showClosed,
  renderCard,
  onGroupDrop,
}: {
  groups: readonly PipelineGroup[];
  items: T[];
  showClosed: boolean;
  renderCard: (item: T) => ReactNode;
  onGroupDrop: (item: T, statuses: readonly string[]) => void;
}) {
  const visibleGroups = groups.filter((group) => showClosed || !group.closed);
  const [mobileGroup, setMobileGroup] = useState(visibleGroups[0]?.id ?? "");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const itemsForGroup = (group: PipelineGroup) =>
    items.filter((item) =>
      group.statuses.includes(item.status ?? "Без статуса"),
    );

  const handleDrop = (
    event: DragEvent<HTMLElement>,
    group: PipelineGroup,
  ) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/crm-record");
    const item = items.find((candidate) => candidate.id === id);
    setDraggingId(null);
    if (item) onGroupDrop(item, group.statuses);
  };

  return (
    <>
      <div className="mobile-stage-tabs" aria-label="Этапы воронки">
        {visibleGroups.map((group) => (
          <button
            className={mobileGroup === group.id ? "is-active" : ""}
            key={group.id}
            onClick={() => setMobileGroup(group.id)}
            type="button"
          >
            {group.label}
            <span>{itemsForGroup(group).length}</span>
          </button>
        ))}
      </div>
      <div className="kanban-board">
        {visibleGroups.map((group) => {
          const groupItems = itemsForGroup(group);
          return (
            <section
              className={`kanban-column ${
                mobileGroup === group.id ? "is-mobile-active" : ""
              } ${draggingId ? "is-dragging" : ""}`}
              key={group.id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => handleDrop(event, group)}
            >
              <header className="column-header">
                <div>
                  <h3>{group.label}</h3>
                  <span>{groupItems.length}</span>
                </div>
                <div className="substatus-list">
                  {group.statuses.map((status) => (
                    <span key={status}>{status}</span>
                  ))}
                </div>
              </header>
              <div className="column-stack">
                {groupItems.length ? (
                  groupItems.map((item) => (
                    <div
                      draggable
                      key={item.id}
                      onDragEnd={() => setDraggingId(null)}
                      onDragStart={(event) => {
                        setDraggingId(item.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/crm-record",
                          item.id,
                        );
                      }}
                    >
                      {renderCard(item)}
                    </div>
                  ))
                ) : (
                  <div className="column-empty">
                    <strong>Пока пусто</strong>
                    <span>Перетащите карточку или измените её статус.</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function ClientsView({
  clients,
  globalSearch,
  onAdvance,
  onCreate,
  onOpen,
  onRequestMove,
}: {
  clients: Client[];
  globalSearch: string;
  onAdvance: (client: Client) => void;
  onCreate: () => void;
  onOpen: (client: Client) => void;
  onRequestMove: (client: Client, statuses?: readonly string[]) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [potential, setPotential] = useState("all");
  const [status, setStatus] = useState("all");
  const [showClosed, setShowClosed] = useState(false);

  const filtered = useMemo(
    () =>
      clients.filter(
        (client) =>
          searchIncludes(globalSearch, [
            client.companyName,
            client.inn,
            client.city,
            client.region,
            client.industry,
          ]) &&
          (potential === "all" || client.potential === potential) &&
          (status === "all" ||
            (status === "unassigned"
              ? client.status === null
              : client.status === status)),
      ),
    [clients, globalSearch, potential, status],
  );

  const potentialA = clients.filter((client) => client.potential === "A").length;
  const needsAction = clients.filter((client) => {
    if (!client.nextActionAt) return false;
    return new Date(client.nextActionAt) <= new Date();
  }).length;

  return (
    <section className="module-view">
      <div className="metric-strip">
        <Metric label="Клиенты в прототипе" value={clients.length} />
        <Metric label="Потенциал A" value={potentialA} />
        <Metric label="Действия сегодня" value={needsAction} tone="attention" />
        <Metric label="Статусы доступны" value={CLIENT_STATUSES.length} />
      </div>
      <div className="view-toolbar">
        <div className="filter-cluster">
          <label>
            Потенциал
            <select
              onChange={(event) => setPotential(event.target.value)}
              value={potential}
            >
              <option value="all">Все</option>
              {["A", "B", "C", "D"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Точный статус
            <select
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="all">Все статусы</option>
              <option value="unassigned">Без статуса</option>
              {CLIENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="check-filter">
            <input
              checked={showClosed}
              onChange={(event) => setShowClosed(event.target.checked)}
              type="checkbox"
            />
            Показать закрытые
          </label>
          <span className="result-count">Найдено: {filtered.length}</span>
        </div>
        <div className="toolbar-actions">
          <ViewSwitch onChange={setViewMode} value={viewMode} />
          <button className="primary-button" onClick={onCreate} type="button">
            Добавить клиента
          </button>
        </div>
      </div>

      {viewMode === "board" ? (
        <PipelineBoard
          groups={CLIENT_PIPELINE}
          items={filtered}
          onGroupDrop={(client, statuses) =>
            onRequestMove(client, statuses)
          }
          renderCard={(client) => (
            <ClientCard
              client={client}
              onAdvance={() => onAdvance(client)}
              onOpen={() => onOpen(client)}
              onStatus={() => onRequestMove(client)}
            />
          )}
          showClosed={showClosed}
        />
      ) : (
        <ClientTable
          clients={filtered}
          onOpen={onOpen}
          onStatus={onRequestMove}
        />
      )}
    </section>
  );
}

function ClientCard({
  client,
  onAdvance,
  onOpen,
  onStatus,
}: {
  client: Client;
  onAdvance: () => void;
  onOpen: () => void;
  onStatus: () => void;
}) {
  const due = getDueState(client.nextActionAt);
  const canAdvance = Boolean(nextClientStatus(client.status));
  return (
    <article className="record-card">
      <button className="card-open" onClick={onOpen} type="button">
        <div className="card-heading">
          <div>
            <span className="record-id">{client.id}</span>
            <h4>{client.companyName}</h4>
          </div>
          <span className={`potential potential-${client.potential}`}>
            {client.potential}
          </span>
        </div>
        <span className="exact-status">{client.status ?? "Без статуса"}</span>
        <dl className="card-facts">
          <div>
            <dt>Регион</dt>
            <dd>
              {client.city}, {client.region}
            </dd>
          </div>
          <div>
            <dt>Отрасль</dt>
            <dd>{client.industry}</dd>
          </div>
        </dl>
        <div className="next-action">
          <span className={due.className}>{due.label}</span>
          <strong>{client.nextAction || "Добавить следующий шаг"}</strong>
        </div>
      </button>
      <footer className="card-footer">
        <span className="manager-chip">
          {client.managerName
            .split(" ")
            .map((part) => part[0])
            .join("")}
        </span>
        <span>{client.managerName}</span>
        <div>
          <button onClick={onStatus} type="button">
            Статус
          </button>
          {canAdvance && (
            <button onClick={onAdvance} type="button">
              Продвинуть
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

function ClientTable({
  clients,
  onOpen,
  onStatus,
}: {
  clients: Client[];
  onOpen: (client: Client) => void;
  onStatus: (client: Client) => void;
}) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Клиент</th>
            <th>ИНН</th>
            <th>Город</th>
            <th>Потенциал</th>
            <th>Точный статус</th>
            <th>Следующее действие</th>
            <th>Менеджер</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>
                <button
                  className="table-link"
                  onClick={() => onOpen(client)}
                  type="button"
                >
                  <strong>{client.companyName}</strong>
                  <small>{client.id}</small>
                </button>
              </td>
              <td className="mono">{client.inn}</td>
              <td>{client.city}</td>
              <td>
                <span className={`potential potential-${client.potential}`}>
                  {client.potential}
                </span>
              </td>
              <td>
                <span className="exact-status">
                  {client.status ?? "Без статуса"}
                </span>
              </td>
              <td>
                <strong>{client.nextAction || "Не назначено"}</strong>
                <small>{formatDate(client.nextActionAt)}</small>
              </td>
              <td>{client.managerName}</td>
              <td>
                <button
                  className="text-button"
                  onClick={() => onStatus(client)}
                  type="button"
                >
                  Изменить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!clients.length && <TableEmpty />}
    </div>
  );
}

function DealsView({
  clients,
  deals,
  globalSearch,
  onAdvance,
  onCreate,
  onOpen,
  onRequestMove,
}: {
  clients: Client[];
  deals: Deal[];
  globalSearch: string;
  onAdvance: (deal: Deal) => void;
  onCreate: () => void;
  onOpen: (deal: Deal) => void;
  onRequestMove: (deal: Deal, statuses?: readonly string[]) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [status, setStatus] = useState("all");
  const [showClosed, setShowClosed] = useState(false);
  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const filtered = useMemo(
    () =>
      deals.filter((deal) => {
        const client = clientMap.get(deal.clientId);
        return (
          searchIncludes(globalSearch, [
            deal.title,
            deal.product,
            client?.companyName ?? "",
            deal.managerName,
          ]) &&
          (status === "all" || deal.status === status)
        );
      }),
    [clientMap, deals, globalSearch, status],
  );

  const pipeline = deals
    .filter((deal) => !["Проиграна", "Отложена", "Отменена"].includes(deal.status))
    .reduce((sum, deal) => sum + deal.ourPrice, 0);
  const margin = deals.reduce((sum, deal) => sum + deal.margin, 0);

  return (
    <section className="module-view">
      <div className="metric-strip">
        <Metric label="Сделки" value={deals.length} />
        <Metric label="В работе" value={formatMoney(pipeline)} />
        <Metric label="Плановая маржа" value={formatMoney(margin)} tone="good" />
        <Metric label="Статусы доступны" value={DEAL_STATUSES.length} />
      </div>
      <div className="view-toolbar">
        <div className="filter-cluster">
          <label>
            Точный статус
            <select
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="all">Все статусы</option>
              {DEAL_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="check-filter">
            <input
              checked={showClosed}
              onChange={(event) => setShowClosed(event.target.checked)}
              type="checkbox"
            />
            Показать закрытые
          </label>
          <span className="result-count">Найдено: {filtered.length}</span>
        </div>
        <div className="toolbar-actions">
          <ViewSwitch onChange={setViewMode} value={viewMode} />
          <button className="primary-button" onClick={onCreate} type="button">
            Добавить сделку
          </button>
        </div>
      </div>

      {viewMode === "board" ? (
        <PipelineBoard
          groups={DEAL_PIPELINE}
          items={filtered}
          onGroupDrop={(deal, statuses) => onRequestMove(deal, statuses)}
          renderCard={(deal) => (
            <DealCard
              clientName={
                clientMap.get(deal.clientId)?.companyName ?? "Клиент не найден"
              }
              deal={deal}
              onAdvance={() => onAdvance(deal)}
              onOpen={() => onOpen(deal)}
              onStatus={() => onRequestMove(deal)}
            />
          )}
          showClosed={showClosed}
        />
      ) : (
        <DealTable
          clientMap={clientMap}
          deals={filtered}
          onOpen={onOpen}
          onStatus={onRequestMove}
        />
      )}
    </section>
  );
}

function DealCard({
  deal,
  clientName,
  onAdvance,
  onOpen,
  onStatus,
}: {
  deal: Deal;
  clientName: string;
  onAdvance: () => void;
  onOpen: () => void;
  onStatus: () => void;
}) {
  const due = getDueState(deal.nextActionAt);
  return (
    <article className="record-card deal-card">
      <button className="card-open" onClick={onOpen} type="button">
        <span className="record-id">{deal.id}</span>
        <h4>{deal.title}</h4>
        <p className="company-line">{clientName}</p>
        <span className="exact-status">{deal.status}</span>
        <dl className="deal-numbers">
          <div>
            <dt>Сумма</dt>
            <dd>{formatMoney(deal.ourPrice)}</dd>
          </div>
          <div>
            <dt>Маржа</dt>
            <dd className="positive">
              {formatMoney(deal.margin)} · {deal.marginPercent}%
            </dd>
          </div>
        </dl>
        <div className="next-action">
          <span className={due.className}>{due.label}</span>
          <strong>{deal.nextAction || "Добавить следующий шаг"}</strong>
        </div>
      </button>
      <footer className="card-footer">
        <span className="manager-chip">
          {deal.managerName
            .split(" ")
            .map((part) => part[0])
            .join("")}
        </span>
        <span>{deal.managerName}</span>
        <div>
          <button onClick={onStatus} type="button">
            Статус
          </button>
          {nextDealStatus(deal.status) && (
            <button onClick={onAdvance} type="button">
              Продвинуть
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

function DealTable({
  deals,
  clientMap,
  onOpen,
  onStatus,
}: {
  deals: Deal[];
  clientMap: Map<string, Client>;
  onOpen: (deal: Deal) => void;
  onStatus: (deal: Deal) => void;
}) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Сделка</th>
            <th>Клиент</th>
            <th>Товар / объём</th>
            <th>Сумма</th>
            <th>Маржа</th>
            <th>Точный статус</th>
            <th>Следующий шаг</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id}>
              <td>
                <button
                  className="table-link"
                  onClick={() => onOpen(deal)}
                  type="button"
                >
                  <strong>{deal.title}</strong>
                  <small>{deal.id}</small>
                </button>
              </td>
              <td>{clientMap.get(deal.clientId)?.companyName}</td>
              <td>
                <strong>{deal.product}</strong>
                <small>{deal.volume}</small>
              </td>
              <td className="mono">{formatMoney(deal.ourPrice)}</td>
              <td className="positive">
                {formatMoney(deal.margin)} · {deal.marginPercent}%
              </td>
              <td>
                <span className="exact-status">{deal.status}</span>
              </td>
              <td>
                <strong>{deal.nextAction}</strong>
                <small>{formatDate(deal.nextActionAt)}</small>
              </td>
              <td>
                <button
                  className="text-button"
                  onClick={() => onStatus(deal)}
                  type="button"
                >
                  Изменить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!deals.length && <TableEmpty />}
    </div>
  );
}

function ContactsView({
  clients,
  contacts,
  globalSearch,
  onCreate,
  onLog,
  onOpenClient,
}: {
  clients: Client[];
  contacts: Contact[];
  globalSearch: string;
  onCreate: () => void;
  onLog: (contact: Contact) => void;
  onOpenClient: (id: string) => void;
}) {
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const filtered = contacts.filter((contact) =>
    searchIncludes(globalSearch, [
      contact.fullName,
      contact.role,
      contact.phone,
      contact.email,
      clientMap.get(contact.clientId)?.companyName ?? "",
    ]),
  );

  return (
    <section className="module-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Единая контактная база</span>
          <h2>Лица, принимающие решения</h2>
          <p>
            Контакты связаны с клиентами, сделками и историей взаимодействий.
          </p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          Добавить контакт
        </button>
      </div>
      <div className="table-shell contacts-table">
        <table>
          <thead>
            <tr>
              <th>Контакт</th>
              <th>Компания</th>
              <th>Должность</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Комментарий</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <strong>{contact.fullName}</strong>
                  <small>{contact.id}</small>
                </td>
                <td>
                  <button
                    className="table-link"
                    onClick={() => onOpenClient(contact.clientId)}
                    type="button"
                  >
                    {clientMap.get(contact.clientId)?.companyName}
                  </button>
                </td>
                <td>{contact.role}</td>
                <td className="mono">{contact.phone}</td>
                <td>{contact.email}</td>
                <td>{contact.comment || "—"}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => onLog(contact)}
                    type="button"
                  >
                    Записать контакт
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <TableEmpty />}
      </div>
    </section>
  );
}

function ActivityView({
  clients,
  interactions,
  globalSearch,
  onCreate,
  onOpenClient,
}: {
  clients: Client[];
  interactions: Interaction[];
  globalSearch: string;
  onCreate: () => void;
  onOpenClient: (id: string) => void;
}) {
  const [kind, setKind] = useState("all");
  const [mode, setMode] = useState<"feed" | "table">("feed");
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const filtered = interactions.filter(
    (interaction) =>
      (kind === "all" || interaction.kind === kind) &&
      searchIncludes(globalSearch, [
        interaction.subject,
        interaction.result,
        interaction.managerName,
        clientMap.get(interaction.clientId)?.companyName ?? "",
      ]),
  );

  return (
    <section className="module-view">
      <div className="view-toolbar">
        <div className="filter-cluster">
          <label>
            Тип контакта
            <select onChange={(event) => setKind(event.target.value)} value={kind}>
              <option value="all">Все типы</option>
              {[
                "Звонок",
                "Email",
                "WhatsApp",
                "Telegram",
                "Встреча",
                "Повторный звонок",
                "Отправка КП",
                "Получение ТЗ",
                "Другое",
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <span className="result-count">Событий: {filtered.length}</span>
        </div>
        <div className="toolbar-actions">
          <div className="view-switch" aria-label="Вид истории">
            <button
              className={mode === "feed" ? "is-active" : ""}
              onClick={() => setMode("feed")}
              type="button"
            >
              Лента
            </button>
            <button
              className={mode === "table" ? "is-active" : ""}
              onClick={() => setMode("table")}
              type="button"
            >
              Таблица
            </button>
          </div>
          <button className="primary-button" onClick={onCreate} type="button">
            Добавить взаимодействие
          </button>
        </div>
      </div>

      {mode === "feed" ? (
        <div className="activity-layout">
          <div className="activity-feed">
            {filtered.map((interaction) => (
              <article className="activity-item" key={interaction.id}>
                <div className="activity-rail">
                  <span>{interaction.kind.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="activity-content">
                  <header>
                    <div>
                      <span className="exact-status">{interaction.kind}</span>
                      <h3>{interaction.subject}</h3>
                    </div>
                    <time>{formatDate(interaction.occurredAt, true)}</time>
                  </header>
                  <button
                    className="company-button"
                    onClick={() => onOpenClient(interaction.clientId)}
                    type="button"
                  >
                    {clientMap.get(interaction.clientId)?.companyName}
                  </button>
                  <p>{interaction.result}</p>
                  <div className="activity-next">
                    <span>Следующий шаг</span>
                    <strong>{interaction.nextStep}</strong>
                    <time>{formatDate(interaction.nextStepAt)}</time>
                  </div>
                  <footer>{interaction.managerName}</footer>
                </div>
              </article>
            ))}
          </div>
          <aside className="activity-summary">
            <span className="section-kicker">Контроль ритма</span>
            <strong>{filtered.length}</strong>
            <p>взаимодействий в выбранном представлении</p>
            <dl>
              <div>
                <dt>Звонки</dt>
                <dd>
                  {filtered.filter((item) => item.kind === "Звонок").length}
                </dd>
              </div>
              <div>
                <dt>Встречи</dt>
                <dd>
                  {filtered.filter((item) => item.kind === "Встреча").length}
                </dd>
              </div>
              <div>
                <dt>Следующие шаги</dt>
                <dd>{filtered.filter((item) => item.nextStepAt).length}</dd>
              </div>
            </dl>
          </aside>
        </div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Компания</th>
                <th>Тип</th>
                <th>Тема</th>
                <th>Итог</th>
                <th>Следующий шаг</th>
                <th>Ответственный</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((interaction) => (
                <tr key={interaction.id}>
                  <td className="mono">
                    {formatDate(interaction.occurredAt, true)}
                  </td>
                  <td>{clientMap.get(interaction.clientId)?.companyName}</td>
                  <td>
                    <span className="exact-status">{interaction.kind}</span>
                  </td>
                  <td>{interaction.subject}</td>
                  <td>{interaction.result}</td>
                  <td>
                    <strong>{interaction.nextStep}</strong>
                    <small>{formatDate(interaction.nextStepAt)}</small>
                  </td>
                  <td>{interaction.managerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ImportView({
  onCommit,
}: {
  onCommit: (status: ClientStatus) => void;
}) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<ClientStatus>("Новый лид");

  const preview = [
    {
      company: "Медовый край",
      inn: "7728041927",
      region: "Москва",
      state: "Готово",
    },
    {
      company: "Речной терминал",
      inn: "7816034512",
      region: "Санкт-Петербург",
      state: "Предупреждение",
    },
    {
      company: "Формула заботы",
      inn: "6671039475",
      region: "Свердловская область",
      state: "Готово",
    },
    {
      company: "Повторная строка",
      inn: "7728041927",
      region: "Москва",
      state: "Дубль",
    },
  ];

  return (
    <section className="module-view import-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Импорт лидов</span>
          <h2>Проверка данных до загрузки</h2>
          <p>
            CSV, TSV и вставка из Google Sheets. XLSX будет передан будущему
            backend-обработчику.
          </p>
        </div>
        <span className="prototype-badge">Frontend simulation</span>
      </div>
      <ol className="import-steps">
        {["Файл", "Сопоставление", "Проверка", "Результат"].map(
          (label, index) => (
            <li
              className={step >= index + 1 ? "is-active" : ""}
              key={label}
            >
              <span>{index + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>

      <div className="import-panel">
        {step === 1 && (
          <div className="drop-zone">
            <span className="drop-mark">CSV</span>
            <h3>{fileName || "Перетащите таблицу с лидами"}</h3>
            <p>До 10 МБ · CSV, TSV или XLSX</p>
            <label className="primary-button file-button">
              Выбрать файл
              <input
                accept=".csv,.tsv,.xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setFileName(file.name);
                }}
                type="file"
              />
            </label>
            <button
              className="text-button"
              onClick={() => setFileName("demo-leads.csv")}
              type="button"
            >
              Использовать демо-файл
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Сопоставление</span>
                <h3>{fileName}</h3>
              </div>
              <span>20 полей CRM доступно</span>
            </div>
            <div className="mapping-grid">
              {[
                ["Название компании", "Компания"],
                ["ИНН", "ИНН"],
                ["Регион", "Область"],
                ["Город", "Город"],
                ["Отрасль", "Категория"],
                ["Потенциал", "Приоритет"],
              ].map(([field, source]) => (
                <label key={field}>
                  <span>{field}</span>
                  <select defaultValue={source}>
                    <option>{source}</option>
                    <option>Не импортировать</option>
                  </select>
                </label>
              ))}
            </div>
            <label className="wide-field">
              Стартовый статус
              <select
                onChange={(event) =>
                  setStatus(event.target.value as ClientStatus)
                }
                value={status}
              >
                {CLIENT_STATUSES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <small>
                Все 16 клиентских статусов доступны при импорте.
              </small>
            </label>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Проверка</span>
                <h3>4 строки · 2 готовы · 1 предупреждение · 1 дубль</h3>
              </div>
              <button className="text-button" type="button">
                Скачать ошибки
              </button>
            </div>
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Компания</th>
                    <th>ИНН</th>
                    <th>Регион</th>
                    <th>Статус строки</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={`${row.inn}-${row.company}`}>
                      <td>{row.company}</td>
                      <td className="mono">{row.inn}</td>
                      <td>{row.region}</td>
                      <td>
                        <span
                          className={`row-state row-state-${row.state
                            .toLowerCase()
                            .replace(" ", "-")}`}
                        >
                          {row.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="import-success">
            <span>3 / 4</span>
            <h3>Партия готова</h3>
            <p>
              Три лида добавлены в локальный прототип со статусом «{status}».
              Дубль пропущен.
            </p>
            <button
              className="ghost-button"
              onClick={() => {
                setStep(1);
                setFileName("");
              }}
              type="button"
            >
              Новый импорт
            </button>
          </div>
        )}

        {step < 4 && (
          <footer className="import-actions">
            <button
              className="ghost-button"
              disabled={step === 1}
              onClick={() => setStep((current) => current - 1)}
              type="button"
            >
              Назад
            </button>
            <button
              className="primary-button"
              disabled={step === 1 && !fileName}
              onClick={() => {
                if (step === 3) {
                  onCommit(status);
                }
                setStep((current) => current + 1);
              }}
              type="button"
            >
              {step === 3 ? "Импортировать 3 строки" : "Продолжить"}
            </button>
          </footer>
        )}
      </div>
    </section>
  );
}

function DictionariesView({ snapshot }: { snapshot: CrmSnapshot }) {
  const initial = useMemo(
    () => ({
      clientStatuses: [...CLIENT_STATUSES],
      dealStatuses: [...DEAL_STATUSES],
      potentials: [...snapshot.dictionaries.potentials],
      industries: [...snapshot.dictionaries.industries],
      productTypes: [...snapshot.dictionaries.productTypes],
      sources: [...snapshot.dictionaries.sources],
      interactionTypes: [...snapshot.dictionaries.interactionTypes],
    }),
    [snapshot],
  );
  const [activeKey, setActiveKey] =
    useState<keyof typeof initial>("clientStatuses");
  const [values, setValues] = useState(initial);
  const [disabledItems, setDisabledItems] = useState<string[]>([]);

  const tabs: Array<[keyof typeof initial, string]> = [
    ["clientStatuses", "Статусы клиентов"],
    ["dealStatuses", "Статусы сделок"],
    ["potentials", "Потенциал"],
    ["industries", "Отрасли"],
    ["productTypes", "Типы товара"],
    ["sources", "Источники"],
    ["interactionTypes", "Типы контактов"],
  ];
  const current = values[activeKey];

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    setValues((state) => ({ ...state, [activeKey]: next }));
  };

  return (
    <section className="module-view dictionaries-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Справочники</span>
          <h2>Единые значения для форм и воронок</h2>
          <p>
            Все значения из листа «Справочники» представлены в прототипе.
          </p>
        </div>
        <button
          className="ghost-button"
          onClick={() => {
            setValues(initial);
            setDisabledItems([]);
          }}
          type="button"
        >
          Восстановить значения
        </button>
      </div>
      <div className="dictionary-shell">
        <nav className="dictionary-tabs" aria-label="Типы справочников">
          {tabs.map(([key, label]) => (
            <button
              className={key === activeKey ? "is-active" : ""}
              key={key}
              onClick={() => setActiveKey(key)}
              type="button"
            >
              <span>{label}</span>
              <small>{values[key].length}</small>
            </button>
          ))}
        </nav>
        <div className="dictionary-list">
          <header>
            <div>
              <span className="section-kicker">Активный справочник</span>
              <h3>{tabs.find(([key]) => key === activeKey)?.[1]}</h3>
            </div>
            <span>{current.length} значений</span>
          </header>
          <ol>
            {current.map((value, index) => {
              const disabled = disabledItems.includes(value);
              return (
                <li className={disabled ? "is-disabled" : ""} key={value}>
                  <span className="dictionary-order">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{value}</strong>
                  <span className="dictionary-state">
                    {disabled ? "Выключено" : "Активно"}
                  </span>
                  <div>
                    <button
                      aria-label={`Поднять ${value}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      type="button"
                    >
                      Выше
                    </button>
                    <button
                      aria-label={`Опустить ${value}`}
                      disabled={index === current.length - 1}
                      onClick={() => move(index, 1)}
                      type="button"
                    >
                      Ниже
                    </button>
                    <button
                      onClick={() =>
                        setDisabledItems((items) =>
                          items.includes(value)
                            ? items.filter((item) => item !== value)
                            : [...items, value],
                        )
                      }
                      type="button"
                    >
                      {disabled ? "Включить" : "Выключить"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function RecordDrawer({
  drawer,
  snapshot,
  onClose,
  onMoveClient,
  onMoveDeal,
  onAddContact,
  onAddInteraction,
}: {
  drawer: Exclude<DrawerTarget, null>;
  snapshot: CrmSnapshot;
  onClose: () => void;
  onMoveClient: (client: Client) => void;
  onMoveDeal: (deal: Deal) => void;
  onAddContact: (clientId: string) => void;
  onAddInteraction: (clientId: string) => void;
}) {
  const client =
    drawer.kind === "client"
      ? snapshot.clients.find((item) => item.id === drawer.id)
      : undefined;
  const deal =
    drawer.kind === "deal"
      ? snapshot.deals.find((item) => item.id === drawer.id)
      : undefined;

  if (!client && !deal) return null;

  const relatedClient = client
    ? client
    : snapshot.clients.find((item) => item.id === deal?.clientId);
  const relatedContacts = snapshot.contacts.filter(
    (item) => item.clientId === relatedClient?.id,
  );
  const relatedDeals = snapshot.deals.filter(
    (item) => item.clientId === relatedClient?.id,
  );
  const relatedInteractions = snapshot.interactions
    .filter((item) => item.clientId === relatedClient?.id)
    .slice(0, 4);

  return (
    <div className="dialog-backdrop" role="presentation">
      <aside
        aria-label={client ? "Карточка клиента" : "Карточка сделки"}
        aria-modal="true"
        className="record-drawer"
        role="dialog"
      >
        <header className="drawer-header">
          <div>
            <span className="record-id">{client?.id ?? deal?.id}</span>
            <h2>{client?.companyName ?? deal?.title}</h2>
            {deal && <p>{relatedClient?.companyName}</p>}
          </div>
          <button autoFocus className="ghost-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </header>

        <div className="drawer-status">
          <span className="exact-status">
            {client?.status ?? deal?.status ?? "Без статуса"}
          </span>
          {client && (
            <span className={`potential potential-${client.potential}`}>
              {client.potential}
            </span>
          )}
          <button
            className="text-button"
            onClick={() =>
              client ? onMoveClient(client) : deal && onMoveDeal(deal)
            }
            type="button"
          >
            Изменить статус
          </button>
        </div>

        <div className="drawer-scroll">
          {client && (
            <>
              <DrawerSection title="Следующее действие">
                <div className="next-action drawer-next">
                  <span className={getDueState(client.nextActionAt).className}>
                    {getDueState(client.nextActionAt).label}
                  </span>
                  <strong>{client.nextAction || "Шаг не назначен"}</strong>
                  <small>{formatDate(client.nextActionAt, true)}</small>
                </div>
              </DrawerSection>
              <DrawerSection title="Профиль клиента">
                <dl className="detail-grid">
                  <Detail label="ИНН" value={client.inn} mono />
                  <Detail label="Регион" value={client.region} />
                  <Detail label="Город" value={client.city} />
                  <Detail label="Отрасль" value={client.industry} />
                  <Detail label="Производит" value={client.produces} />
                  <Detail label="Может покупать" value={client.mayPurchase} />
                  <Detail label="Источник" value={client.source} />
                  <Detail label="Менеджер" value={client.managerName} />
                </dl>
              </DrawerSection>
              <DrawerSection
                action={
                  <button
                    className="text-button"
                    onClick={() => onAddContact(client.id)}
                    type="button"
                  >
                    Добавить
                  </button>
                }
                title="Контакты"
              >
                <div className="related-list">
                  {relatedContacts.length ? (
                    relatedContacts.map((contact) => (
                      <article key={contact.id}>
                        <strong>{contact.fullName}</strong>
                        <span>{contact.role}</span>
                        <small>
                          {contact.phone} · {contact.email}
                        </small>
                      </article>
                    ))
                  ) : (
                    <p className="muted-copy">Контакты ещё не добавлены.</p>
                  )}
                </div>
              </DrawerSection>
              <DrawerSection title="Сделки">
                <div className="related-list">
                  {relatedDeals.map((item) => (
                    <article key={item.id}>
                      <strong>{item.title}</strong>
                      <span>{item.status}</span>
                      <small>{formatMoney(item.ourPrice)}</small>
                    </article>
                  ))}
                </div>
              </DrawerSection>
            </>
          )}

          {deal && (
            <>
              <DrawerSection title="Экономика сделки">
                <dl className="detail-grid">
                  <Detail label="Товар" value={deal.product} />
                  <Detail label="Объём" value={deal.volume} />
                  <Detail
                    label="Цена клиенту"
                    value={formatMoney(deal.clientPrice)}
                    mono
                  />
                  <Detail
                    label="Наша цена"
                    value={formatMoney(deal.ourPrice)}
                    mono
                  />
                  <Detail
                    label="Закупка"
                    value={formatMoney(deal.purchasePrice)}
                    mono
                  />
                  <Detail
                    label="Логистика"
                    value={formatMoney(deal.logistics)}
                    mono
                  />
                  <Detail
                    label="Маржа"
                    value={`${formatMoney(deal.margin)} · ${deal.marginPercent}%`}
                    mono
                  />
                  <Detail label="Дата КП" value={formatDate(deal.proposalDate)} />
                </dl>
              </DrawerSection>
              <DrawerSection title="Следующий шаг">
                <div className="next-action drawer-next">
                  <span className={getDueState(deal.nextActionAt).className}>
                    {getDueState(deal.nextActionAt).label}
                  </span>
                  <strong>{deal.nextAction}</strong>
                  <small>{formatDate(deal.nextActionAt, true)}</small>
                </div>
              </DrawerSection>
              <DrawerSection title="Ответственный">
                <p>{deal.managerName}</p>
              </DrawerSection>
            </>
          )}

          <DrawerSection
            action={
              relatedClient ? (
                <button
                  className="text-button"
                  onClick={() => onAddInteraction(relatedClient.id)}
                  type="button"
                >
                  Записать контакт
                </button>
              ) : null
            }
            title="Последние взаимодействия"
          >
            <div className="mini-timeline">
              {relatedInteractions.map((interaction) => (
                <article key={interaction.id}>
                  <time>{formatDate(interaction.occurredAt, true)}</time>
                  <strong>{interaction.subject}</strong>
                  <span>{interaction.kind}</span>
                </article>
              ))}
            </div>
          </DrawerSection>
        </div>
      </aside>
    </div>
  );
}

function StatusPicker({
  intent,
  onChoose,
  onClose,
}: {
  intent: Exclude<MoveIntent, null>;
  onChoose: (status: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="dialog-backdrop centered" role="presentation">
      <section
        aria-label="Выбор точного статуса"
        aria-modal="true"
        className="status-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span className="section-kicker">Точный статус</span>
            <h2>{intent.title}</h2>
            <p>
              Выберите конкретный статус внутри этапа. Цвет не заменяет
              текстовое значение.
            </p>
          </div>
          <button autoFocus className="ghost-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </header>
        <div className="status-options">
          {intent.statuses.map((status, index) => (
            <button key={status} onClick={() => onChoose(status)} type="button">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{status}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CreateDialog({
  kind,
  clientId,
  snapshot,
  onClose,
  onSubmit,
}: {
  kind: Exclude<CreateKind, null>;
  clientId: string | null;
  snapshot: CrmSnapshot;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const titles = {
    client: "Новый клиент",
    deal: "Новая сделка",
    contact: "Новый контакт",
    interaction: "Новое взаимодействие",
  };
  return (
    <div className="dialog-backdrop centered" role="presentation">
      <form
        aria-label={titles[kind]}
        aria-modal="true"
        className="create-dialog"
        onSubmit={onSubmit}
        role="dialog"
      >
        <header>
          <div>
            <span className="section-kicker">Локальная запись</span>
            <h2>{titles[kind]}</h2>
          </div>
          <button
            autoFocus
            className="ghost-button"
            onClick={onClose}
            type="button"
          >
            Закрыть
          </button>
        </header>

        <div className="form-grid">
          {kind === "client" && (
            <>
              <Field label="Название компании" name="companyName" required />
              <Field label="ИНН" name="inn" />
              <Field label="Регион" name="region" />
              <Field label="Город" name="city" />
              <SelectField
                label="Отрасль"
                name="industry"
                options={snapshot.dictionaries.industries}
              />
              <Field label="Что может покупать" name="mayPurchase" />
              <SelectField
                label="Потенциал"
                name="potential"
                options={snapshot.dictionaries.potentials}
              />
              <SelectField
                label="Статус"
                name="status"
                options={[...CLIENT_STATUSES]}
              />
              <SelectField
                label="Источник"
                name="source"
                options={snapshot.dictionaries.sources}
              />
              <SelectField label="Менеджер" name="manager" options={managers} />
              <Field label="Следующее действие" name="nextAction" wide />
            </>
          )}

          {kind === "deal" && (
            <>
              <Field label="Название сделки" name="title" required wide />
              <SelectField
                label="Клиент"
                name="clientId"
                options={snapshot.clients.map((client) => ({
                  label: client.companyName,
                  value: client.id,
                }))}
              />
              <SelectField
                label="Статус"
                name="status"
                options={[...DEAL_STATUSES]}
              />
              <Field label="Товар" name="product" />
              <Field label="Объём" name="volume" />
              <Field label="Наша цена" name="ourPrice" type="number" />
              <SelectField label="Менеджер" name="manager" options={managers} />
              <Field label="Следующее действие" name="nextAction" wide />
            </>
          )}

          {kind === "contact" && (
            <>
              <SelectField
                defaultValue={clientId ?? undefined}
                label="Клиент"
                name="clientId"
                options={snapshot.clients.map((client) => ({
                  label: client.companyName,
                  value: client.id,
                }))}
              />
              <Field label="Имя и фамилия" name="fullName" required />
              <Field label="Должность" name="role" />
              <Field label="Телефон" name="phone" type="tel" />
              <Field label="Email" name="email" type="email" wide />
            </>
          )}

          {kind === "interaction" && (
            <>
              <SelectField
                defaultValue={clientId ?? undefined}
                label="Клиент"
                name="clientId"
                options={snapshot.clients.map((client) => ({
                  label: client.companyName,
                  value: client.id,
                }))}
              />
              <SelectField
                label="Тип контакта"
                name="kind"
                options={snapshot.dictionaries.interactionTypes}
              />
              <Field label="Тема" name="subject" required wide />
              <Field label="Итог" name="result" wide />
              <Field label="Следующий шаг" name="nextStep" wide />
              <SelectField label="Ответственный" name="manager" options={managers} />
            </>
          )}
        </div>
        <footer>
          <button className="ghost-button" onClick={onClose} type="button">
            Отмена
          </button>
          <button className="primary-button" type="submit">
            Сохранить локально
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  type = "text",
  wide,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "wide-field" : ""}>
      {label}
      <input name={name} required={required} type={type} />
    </label>
  );
}

type SelectOption = string | { label: string; value: string };

function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: readonly SelectOption[];
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <select defaultValue={defaultValue} name={name}>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const text = typeof option === "string" ? option : option.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function DrawerSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="drawer-section">
      <header>
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : ""}>{value || "Не заполнено"}</dd>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "attention" | "good";
}) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ViewSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div className="view-switch" aria-label="Режим отображения">
      <button
        className={value === "board" ? "is-active" : ""}
        onClick={() => onChange("board")}
        type="button"
      >
        Канбан
      </button>
      <button
        className={value === "list" ? "is-active" : ""}
        onClick={() => onChange("list")}
        type="button"
      >
        Список
      </button>
    </div>
  );
}

function TableEmpty() {
  return (
    <div className="table-empty">
      <strong>Ничего не найдено</strong>
      <span>Измените поиск или сбросьте фильтры.</span>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div aria-label="CRM загружается" className="workspace-skeleton" role="status">
      <div className="skeleton-metrics">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="skeleton-toolbar" />
      <div className="skeleton-columns">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <div className="error-state" role="alert">
      <span>Ошибка загрузки</span>
      <h2>{message}</h2>
      <button className="primary-button" onClick={() => void onRetry()} type="button">
        Повторить
      </button>
    </div>
  );
}
