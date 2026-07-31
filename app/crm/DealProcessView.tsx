import { useState } from "react";

import {
  DEAL_PROCESS_STEP_LABELS,
  ECONOMICS_LABELS,
  SAMPLE_STEPS,
  getActiveProcessSteps,
  getDealProcessCompletion,
  getQuoteMargin,
  getQuoteMarginPercent,
  type DealProcess,
  type DealProcessStep,
  type Quote,
} from "./domain.ts";

const formatDay = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(iso))
    : "—";

/** Дата в формате input[type=date] без сдвига часового пояса. */
const toDateInput = (iso: string | null): string =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "";

export function DealProcessSection({
  process,
  currentUserId,
  onSave,
}: {
  process: DealProcess;
  currentUserId: string;
  onSave: (process: DealProcess) => void;
}) {
  const [draft, setDraft] = useState<DealProcess>(process);
  const completion = getDealProcessCompletion(draft);
  const steps = getActiveProcessSteps(draft);

  // Намеренно не `commit`: так в CrmApp называется мутация всего снимка,
  // и одинаковые имена в двух слоях путают при чтении.
  const apply = (next: DealProcess) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setDraft(stamped);
    onSave(stamped);
  };

  const toggleStep = (step: DealProcessStep) => {
    const done = draft.steps[step].completedAt !== null;
    apply({
      ...draft,
      steps: {
        ...draft.steps,
        [step]: done
          ? { completedAt: null, completedById: null, note: "" }
          : {
              completedAt: new Date().toISOString(),
              completedById: currentUserId,
              note: draft.steps[step].note,
            },
      },
    });
  };

  const setStepDate = (step: DealProcessStep, value: string) => {
    apply({
      ...draft,
      steps: {
        ...draft.steps,
        [step]: {
          ...draft.steps[step],
          completedAt: value ? new Date(value).toISOString() : null,
          completedById: value ? currentUserId : null,
        },
      },
    });
  };

  return (
    <section className="drawer-section deal-process">
      <header>
        <h3>Процесс расчёта, образца и КП</h3>
        <span className="deal-process-counter">
          {completion.filled} из {completion.total}
        </span>
      </header>

      <label className="deal-process-skip">
        <input
          checked={draft.sampleSkipped}
          onChange={(event) =>
            apply({ ...draft, sampleSkipped: event.target.checked })
          }
          type="checkbox"
        />
        Образец не требуется
      </label>

      <ol className="deal-process-track">
        {steps.map((step) => {
          const milestone = draft.steps[step];
          const done = milestone.completedAt !== null;
          // Веху отправки КП ставит сама отправка версии, иначе данные разъедутся.
          const locked = step === "quoteSent";

          return (
            <li
              className={done ? "deal-process-step is-done" : "deal-process-step"}
              key={step}
            >
              <label>
                <input
                  checked={done}
                  disabled={locked}
                  onChange={() => toggleStep(step)}
                  type="checkbox"
                />
                <strong>{DEAL_PROCESS_STEP_LABELS[step]}</strong>
              </label>
              {locked ? (
                <span className="deal-process-date">
                  {formatDay(milestone.completedAt)}
                </span>
              ) : (
                <input
                  className="deal-process-date"
                  onChange={(event) => setStepDate(step, event.target.value)}
                  type="date"
                  value={toDateInput(milestone.completedAt)}
                />
              )}
            </li>
          );
        })}
      </ol>

      <label className="deal-process-reply">
        Ответ клиента ожидается до
        <input
          disabled={draft.steps.quoteSent.completedAt === null}
          onChange={(event) =>
            apply({
              ...draft,
              replyExpectedAt: event.target.value
                ? new Date(event.target.value).toISOString()
                : null,
            })
          }
          type="date"
          value={toDateInput(draft.replyExpectedAt)}
        />
      </label>

      {draft.sampleSkipped && (
        <p className="muted-copy">
          Вехи образца скрыты: {SAMPLE_STEPS.length} шага исключены из процесса.
        </p>
      )}
    </section>
  );
}

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);

export interface QuoteDraft {
  revenue: number;
  cost: number;
  logistics: number;
  volume: string;
  validUntil: string | null;
  changeReason: string;
}

export function QuoteEditor({
  draft,
  requireReason,
  showFinancials,
  onCancel,
  onSubmit,
}: {
  draft: QuoteDraft;
  requireReason: boolean;
  showFinancials: boolean;
  onCancel: () => void;
  onSubmit: (draft: QuoteDraft) => void;
}) {
  const [value, setValue] = useState<QuoteDraft>(draft);
  const reasonMissing = requireReason && value.changeReason.trim() === "";
  const margin = getQuoteMargin(value);

  return (
    <form
      className="quote-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (reasonMissing) return;
        onSubmit(value);
      }}
    >
      <label>
        {ECONOMICS_LABELS.revenue}, ₽
        <input
          onChange={(event) =>
            setValue({ ...value, revenue: Number(event.target.value) })
          }
          type="number"
          value={value.revenue}
        />
      </label>
      {showFinancials && (
        <>
          <label>
            {ECONOMICS_LABELS.cost}, ₽
            <input
              onChange={(event) =>
                setValue({ ...value, cost: Number(event.target.value) })
              }
              type="number"
              value={value.cost}
            />
          </label>
          <label>
            {ECONOMICS_LABELS.logistics}, ₽
            <input
              onChange={(event) =>
                setValue({ ...value, logistics: Number(event.target.value) })
              }
              type="number"
              value={value.logistics}
            />
          </label>
          <p className={margin < 0 ? "quote-margin negative" : "quote-margin"}>
            {ECONOMICS_LABELS.margin}: {formatMoney(margin)} ·{" "}
            {getQuoteMarginPercent(value)}%
          </p>
        </>
      )}
      <label>
        Объём
        <input
          onChange={(event) => setValue({ ...value, volume: event.target.value })}
          value={value.volume}
        />
      </label>
      <label>
        Действует до
        <input
          onChange={(event) =>
            setValue({ ...value, validUntil: event.target.value || null })
          }
          type="date"
          value={value.validUntil ?? ""}
        />
      </label>
      {requireReason && (
        <label>
          Причина изменения
          <input
            onChange={(event) =>
              setValue({ ...value, changeReason: event.target.value })
            }
            value={value.changeReason}
          />
        </label>
      )}
      {reasonMissing && (
        <p className="quote-error">
          Укажите причину изменения — без неё история версий бесполезна.
        </p>
      )}
      <div className="quote-editor-actions">
        <button disabled={reasonMissing} type="submit">
          Сохранить
        </button>
        <button className="text-button" onClick={onCancel} type="button">
          Отмена
        </button>
      </div>
    </form>
  );
}

export function QuoteHistorySection({
  quotes,
  activeQuoteId,
  showFinancials,
  onCreateVersion,
  onSendQuote,
  onResolveQuote,
}: {
  quotes: readonly Quote[];
  activeQuoteId: string | null;
  showFinancials: boolean;
  onCreateVersion: (draft: QuoteDraft) => void;
  onSendQuote: (quoteId: string) => void;
  onResolveQuote: (
    quoteId: string,
    outcome: "Принято" | "Отклонено",
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ordered = [...quotes].sort((left, right) => right.version - left.version);
  const latest = ordered.at(0) ?? null;

  return (
    <section className="drawer-section quote-history">
      <header>
        <h3>Версии КП</h3>
        {!editing && (
          <button
            className="text-button"
            onClick={() => setEditing(true)}
            type="button"
          >
            {latest ? "Новая версия" : "Создать КП"}
          </button>
        )}
      </header>

      {editing && (
        <QuoteEditor
          draft={{
            revenue: latest?.revenue ?? 0,
            cost: latest?.cost ?? 0,
            logistics: latest?.logistics ?? 0,
            volume: latest?.volume ?? "",
            validUntil: null,
            changeReason: "",
          }}
          onCancel={() => setEditing(false)}
          onSubmit={(draft) => {
            onCreateVersion(draft);
            setEditing(false);
          }}
          requireReason={latest !== null}
          showFinancials={showFinancials}
        />
      )}

      {!ordered.length && !editing && (
        <p className="muted-copy">КП ещё не рассчитано.</p>
      )}

      <ul className="quote-list">
        {ordered.map((quote) => (
          <li
            className={
              quote.id === activeQuoteId ? "quote-row is-active" : "quote-row"
            }
            key={quote.id}
          >
            <div className="quote-row-head">
              <strong>v{quote.version}</strong>
              <span className="exact-status">{quote.status}</span>
              <span className="mono">{formatMoney(quote.revenue)}</span>
            </div>
            {showFinancials && (
              <small className={getQuoteMargin(quote) < 0 ? "negative" : ""}>
                {ECONOMICS_LABELS.margin}: {formatMoney(getQuoteMargin(quote))} ·{" "}
                {getQuoteMarginPercent(quote)}%
              </small>
            )}
            <small>
              {quote.volume}
              {quote.validUntil ? ` · действует до ${formatDay(quote.validUntil)}` : ""}
            </small>
            {quote.changeReason && <small>«{quote.changeReason}»</small>}
            {quote.status === "Черновик" && (
              <button
                className="text-button"
                onClick={() => onSendQuote(quote.id)}
                type="button"
              >
                Отправить клиенту
              </button>
            )}
            {quote.status === "Отправлено" && (
              <div className="quote-row-actions">
                <button
                  className="text-button"
                  onClick={() => onResolveQuote(quote.id, "Принято")}
                  type="button"
                >
                  Принято
                </button>
                <button
                  className="text-button"
                  onClick={() => onResolveQuote(quote.id, "Отклонено")}
                  type="button"
                >
                  Отклонено
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
