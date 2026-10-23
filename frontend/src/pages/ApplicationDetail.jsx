import React, { useState } from "react";
import {
  Badge,
  Button,
  Icon,
  PageHeading,
  Timeline,
  Notice,
  Modal,
  Field,
  Empty,
  DownloadSummary,
} from "../components/ui";
import { DocumentList, UploadArea } from "./Documents";
import { money, productOf, date, STATUS } from "../domain/application";
import { api } from "../services/api";
import OfferComparison from "../components/OfferComparison";
export default function ApplicationDetail({
  application: app,
  role,
  refresh,
  navigate,
  notify,
}) {
  const [tab, setTab] = useState("overview");
  const [reply, setReply] = useState("");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [offer, setOffer] = useState({
    amount: app?.amount,
    term: app?.term,
    rate: productOf(app?.productId).rate,
  });
  const [error, setError] = useState("");
  if (!app)
    return (
      <Empty title="Заявка не найдена" text="Возможно, черновик был удалён.">
        <Button onClick={() => navigate("/applications")}>
          К списку заявок
        </Button>
      </Empty>
    );
  const p = productOf(app.productId);
  const employee = role === "employee";
  async function action(next, payload) {
    setBusy(true);
    setError("");
    try {
      await api.transition(app.id, next, role, payload);
      await refresh();
      setModal(null);
      setReason("");
      setReply("");
      notify(
        next === "issued"
          ? "Демонстрационная выдача завершена"
          : next === "needs_info"
            ? "Запрос отправлен клиенту"
            : "Заявка обновлена",
      );
    } catch (e) {
      setError(e.message);
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  const openModal = (value) => {
    setError("");
    setReason("");
    setAccepted(false);
    setModal(value);
  };
  const progress = STATUS[app.status].step;
  return (
    <>
      <button
        className="back-link"
        onClick={() => navigate(employee ? "/queue" : "/applications")}
      >
        <Icon name="back" size={17} />
        {employee ? "Очередь заявок" : "Мои заявки"}
      </button>
      <PageHeading
        eyebrow={`${app.id} · ОТ ${date(app.createdAt).toUpperCase()}`}
        title={employee ? app.company.name : p.name}
        description={app.purpose}
      >
        <Badge status={app.status} />
        <DownloadSummary app={app} notify={notify} />
      </PageHeading>
      <div className="detail-progress">
        {[
          "Заявка",
          "Проверка",
          "Рассмотрение",
          "Решение",
          "Финансирование",
        ].map((label, i) => (
          <div
            key={label}
            className={`${i < progress ? "done" : ""} ${i === progress ? "current" : ""} ${app.status === "rejected" && i === 3 ? "negative" : ""}`}
          >
            <span>
              {i < progress ? <Icon name="check" size={15} /> : i + 1}
            </span>
            <small>{label}</small>
          </div>
        ))}
      </div>
      {app.status === "draft" && (
        <Notice>
          <strong>Это черновик.</strong> Дополните данные и отправьте заявку на
          рассмотрение.{" "}
          <button
            className="text-button"
            onClick={() => navigate(`/applications/${app.id}/edit`)}
          >
            Продолжить оформление <Icon name="arrow" size={16} />
          </button>
        </Notice>
      )}
      {app.status === "needs_info" && (
        <section className="request-card">
          <div className="request-card-heading">
            <span className="task-icon">
              <Icon name="chat" />
            </span>
            <div>
              <span className="eyebrow">
                {employee ? "ОЖИДАЕМ ОТВЕТ КЛИЕНТА" : "ВАШ СЛЕДУЮЩИЙ ШАГ"}
              </span>
              <h2>Нужны дополнительные сведения</h2>
            </div>
          </div>
          <p>{app.request}</p>
          {!employee && (
            <>
              <Field label="Ваш ответ">
                <textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Добавьте пояснение для кредитного специалиста"
                  maxLength={3000}
                />
              </Field>
              <details className="attach-details">
                <summary>
                  <Icon name="plus" size={16} />
                  Приложить документ
                </summary>
                <UploadArea
                  appId={app.id}
                  kind="additional"
                  onUploaded={refresh}
                  notify={notify}
                />
                <DocumentList
                  documents={app.documents.filter(
                    (d) => d.kind === "additional",
                  )}
                  onRemove={async (id) => {
                    try {
                      await api.removeDocument(app.id, id);
                      await refresh();
                    } catch (e) {
                      notify(e.message, "error");
                    }
                  }}
                />
              </details>
              <Button
                disabled={!reply.trim()}
                loading={busy}
                onClick={() => action("submitted", { reply })}
              >
                Отправить сведения <Icon name="arrow" size={17} />
              </Button>
            </>
          )}
        </section>
      )}
      {["approved", "issued"].includes(app.status) && (
        <section className="offer-card">
          <div className="offer-heading">
            <span className="offer-check">
              <Icon name="check" size={26} />
            </span>
            <div>
              <span className="eyebrow">РЕШЕНИЕ ПО ЗАЯВКЕ</span>
              <h2>
                {app.status === "issued"
                  ? "Средства получены"
                  : "Кредит одобрен"}
              </h2>
              <p>
                {app.status === "issued"
                  ? "Условия полученного демонстрационного финансирования."
                  : `Предложение действует до ${date(app.offer.expiresAt)}`}
              </p>
            </div>
          </div>
          <OfferComparison application={app} employee={employee} />
          {!employee && app.status === "approved" && (
            <Button onClick={() => openModal("accept")}>
              Принять предложение <Icon name="arrow" size={17} />
            </Button>
          )}
        </section>
      )}
      {app.status === "rejected" && (
        <Notice tone="red">
          <h3>Сейчас не можем предложить финансирование</h3>
          <p>{app.rejectionReason}</p>
          <p>
            Вы можете обсудить ситуацию с менеджером и подготовить новую заявку
            с учётом причины решения.
          </p>
          {!employee && (
            <Button variant="secondary" onClick={() => navigate("/support")}>
              Написать менеджеру
            </Button>
          )}
        </Notice>
      )}
      {app.status === "issued" && (
        <Notice tone="green" icon="check">
          <h3>Финансирование получено</h3>
          <p>
            Путь по заявке завершён. В демо получение средств смоделировано,
            реального перевода не было.
          </p>
        </Notice>
      )}
      {["submitted", "manual_review"].includes(app.status) && !employee && (
        <Notice icon="clock">
          <strong>
            {app.status === "submitted"
              ? "Проверяем вашу заявку"
              : "Специалист рассматривает вашу заявку"}
          </strong>
          <p>
            Данные и документы получены. Сейчас от вас ничего не требуется.
            Следующее действие появится здесь.
          </p>
        </Notice>
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <section className="card">
            <div
              className="tabs detail-tabs"
              role="tablist"
              aria-label="Данные заявки"
            >
              {[
                { id: "overview", name: "О заявке" },
                {
                  id: "documents",
                  name: `Документы · ${app.documents.length}`,
                },
                ...(employee
                  ? [{ id: "checks", name: "Проверки и скоринг" }]
                  : []),
                { id: "history", name: "История" },
              ].map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t.id}
                  key={t.id}
                  className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className="detail-panel">
              {tab === "overview" && (
                <>
                  <h3>Параметры финансирования</h3>
                  <dl className="summary-list roomy">
                    <div>
                      <dt>Кредитный продукт</dt>
                      <dd>{p.name}</dd>
                    </div>
                    <div>
                      <dt>Запрашиваемая сумма</dt>
                      <dd>{money(app.amount)}</dd>
                    </div>
                    <div>
                      <dt>Срок</dt>
                      <dd>{app.term} месяцев</dd>
                    </div>
                    <div>
                      <dt>Цель финансирования</dt>
                      <dd>{app.purpose}</dd>
                    </div>
                  </dl>
                  <div className="detail-divider" />
                  <h3>О компании</h3>
                  <dl className="summary-list roomy">
                    <div>
                      <dt>Название</dt>
                      <dd>{app.company.name}</dd>
                    </div>
                    <div>
                      <dt>ИНН</dt>
                      <dd>{app.company.inn}</dd>
                    </div>
                    <div>
                      <dt>Деятельность</dt>
                      <dd>{app.company.industry}</dd>
                    </div>
                    <div>
                      <dt>Представитель</dt>
                      <dd>{app.company.contact}</dd>
                    </div>
                    <div>
                      <dt>Телефон</dt>
                      <dd>{app.company.phone}</dd>
                    </div>
                    <div>
                      <dt>Электронная почта</dt>
                      <dd>{app.company.email}</dd>
                    </div>
                  </dl>
                  {employee && (
                    <>
                      <div className="detail-divider" />
                      <h3>Финансовые показатели</h3>
                      <dl className="summary-list roomy">
                        <div>
                          <dt>Выручка за 12 месяцев</dt>
                          <dd>{money(app.finances.revenue)}</dd>
                        </div>
                        <div>
                          <dt>Расходы за 12 месяцев</dt>
                          <dd>{money(app.finances.expenses)}</dd>
                        </div>
                        <div>
                          <dt>Текущие обязательства</dt>
                          <dd>{money(app.finances.debt)}</dd>
                        </div>
                        <div>
                          <dt>Возраст бизнеса</dt>
                          <dd>{app.finances.years} лет</dd>
                        </div>
                      </dl>
                    </>
                  )}
                  {app.messages?.length > 0 && (
                    <>
                      <div className="detail-divider" />
                      <h3>Ответы клиента</h3>
                      {app.messages.map((m) => (
                        <div className="client-message" key={m.id}>
                          <strong>{m.actor}</strong>
                          <p>{m.text}</p>
                          <small>{date(m.at, true)}</small>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
              {tab === "documents" && (
                <>
                  <h3>Документы заявки</h3>
                  {app.documents.length ? (
                    <DocumentList documents={app.documents} />
                  ) : (
                    <Empty title="Документы ещё не добавлены" />
                  )}
                  {api.mode === "mock" && (
                    <p className="legal-note">
                      Демо содержит только метаданные документов. Файлы-образцы
                      и содержимое загруженных файлов не доступны для
                      скачивания.
                    </p>
                  )}
                </>
              )}
              {tab === "history" && (
                <>
                  <h3>История заявки</h3>
                  <Timeline history={app.history} />
                </>
              )}
              {tab === "checks" && (
                <>
                  <h3>Результаты проверок</h3>
                  <Notice tone="amber">
                    Демонстрационные результаты. Проверки ЕГРЮЛ, БКИ и
                    ML-скоринг не выполняются. Реальные данные должны поступать
                    от бэкенда.
                  </Notice>
                  {app.checks ? (
                    <>
                      <div className="checks-list">
                        {[
                          "Регистрация компании · ЕГРЮЛ",
                          "Кредитная история · БКИ",
                          "Комплектность документов",
                        ].map((name) => (
                          <div key={name}>
                            <span className="check-circle">
                              <Icon name="check" size={14} />
                            </span>
                            <strong>{name}</strong>
                            <span className="soft-label">Демо: пройдено</span>
                          </div>
                        ))}
                      </div>
                      <div className="score-block">
                        <div className="score-number">
                          <span>
                            {app.checks.score}
                            <small>/ 1000</small>
                          </span>
                          <div className="score-track">
                            <i style={{ width: `${app.checks.score / 10}%` }} />
                          </div>
                          <small>
                            Синтетический балл · рейтинг {app.checks.rating}
                          </small>
                        </div>
                        <div>
                          <strong>Рекомендация</strong>
                          <h3>{app.checks.recommendation}</h3>
                          <p>
                            Рекомендация помогает специалисту. Итоговое решение
                            принимается отдельно.
                          </p>
                        </div>
                      </div>
                      <h3>Факторы рекомендации</h3>
                      <div className="factors">
                        {app.checks.factors.map((f) => (
                          <div key={f.label}>
                            <Icon
                              name={f.positive ? "check" : "info"}
                              size={17}
                              className={
                                f.positive ? "green-text" : "amber-text"
                              }
                            />
                            {f.label}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Empty
                      title="Проверки ещё не завершены"
                      text="Запустите демо-проверку из панели действий."
                    />
                  )}
                </>
              )}
            </div>
          </section>
        </div>
        <aside className="detail-aside">
          {employee && (
            <section className="card decision-card">
              <span className="eyebrow">РАБОЧЕЕ МЕСТО</span>
              <h3>Действия по заявке</h3>
              {app.status === "submitted" && (
                <>
                  <p>
                    Передайте заявку на рассмотрение после демонстрационной
                    проверки.
                  </p>
                  <Button
                    icon="shield"
                    loading={busy}
                    onClick={() => action("manual_review")}
                  >
                    Завершить демо-проверки
                  </Button>
                </>
              )}
              {app.status === "manual_review" && (
                <>
                  <p>
                    Изучите сведения и рекомендацию. Выберите следующий шаг.
                  </p>
                  <Button icon="check" onClick={() => openModal("approve")}>
                    Предложить условия
                  </Button>
                  <Button
                    variant="secondary"
                    icon="chat"
                    onClick={() => openModal("request")}
                  >
                    Запросить сведения
                  </Button>
                  <Button
                    variant="danger-quiet"
                    onClick={() => openModal("reject")}
                  >
                    Отказать в финансировании
                  </Button>
                </>
              )}
              {app.status === "needs_info" && (
                <Notice tone="amber" icon="clock">
                  Ожидаем ответ клиента. После ответа заявка вернётся на
                  проверку.
                </Notice>
              )}
              {["approved", "rejected", "issued"].includes(app.status) && (
                <Notice icon="check">
                  Решение зафиксировано в истории заявки.
                </Notice>
              )}
            </section>
          )}
          <section className="card history-preview">
            <h3>Последние события</h3>
            <Timeline history={app.history.slice(-3)} />
            {tab !== "history" && (
              <button className="text-button" onClick={() => setTab("history")}>
                Вся история <Icon name="arrow" size={16} />
              </button>
            )}
          </section>
          {!employee && (
            <section className="manager-note">
              <Icon name="chat" size={22} />
              <h3>Вопросы по заявке</h3>
              <p>Поможем с документами и ответим на вопросы по заявке.</p>
              <button
                className="text-button"
                onClick={() => navigate("/support")}
              >
                Связаться с менеджером <Icon name="arrow" size={16} />
              </button>
            </section>
          )}
        </aside>
      </div>
      {modal && (
        <Modal
          title={
            {
              request: "Запрос дополнительных сведений",
              reject: "Решение об отказе",
              approve: "Условия финансирования",
              accept: "Принять предложение",
            }[modal]
          }
          onClose={() => !busy && setModal(null)}
        >
          {modal === "approve" && (
            <>
              <p className="modal-description">
                Предложение увидит клиент. Можно уменьшить сумму и изменить
                срок.
              </p>
              <div className="fields-grid">
                <Field label="Сумма, ₽">
                  <input
                    type="number"
                    min={p.min}
                    max={app.amount}
                    value={offer.amount}
                    onChange={(e) =>
                      setOffer((o) => ({ ...o, amount: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Срок, месяцев">
                  <input
                    type="number"
                    min={p.minTerm}
                    max={p.maxTerm}
                    value={offer.term}
                    onChange={(e) =>
                      setOffer((o) => ({ ...o, term: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Ставка, % годовых">
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={offer.rate}
                    onChange={(e) =>
                      setOffer((o) => ({ ...o, rate: e.target.value }))
                    }
                  />
                </Field>
              </div>
            </>
          )}
          {["request", "reject", "approve"].includes(modal) && (
            <Field
              label={
                modal === "request"
                  ? "Что нужно уточнить?"
                  : modal === "reject"
                    ? "Понятная клиенту причина"
                    : "Комментарий к решению"
              }
            >
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={3000}
                rows={4}
                placeholder={
                  modal === "request"
                    ? "Укажите конкретные документы или сведения"
                    : modal === "reject"
                      ? "Объясните причину и что можно улучшить"
                      : "Поясните предлагаемые условия"
                }
              />
            </Field>
          )}
          {modal === "accept" && (
            <>
              <Notice icon="info">
                В прототипе подписание и получение денег моделируются. Реального
                договора и перевода средств нет.
              </Notice>
              <dl className="summary-list roomy">
                <div>
                  <dt>Сумма</dt>
                  <dd>{money(app.offer.amount)}</dd>
                </div>
                <div>
                  <dt>Ставка</dt>
                  <dd>{app.offer.rate}% годовых</dd>
                </div>
                <div>
                  <dt>Срок</dt>
                  <dd>{app.offer.term} мес.</dd>
                </div>
              </dl>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  Я ознакомился с условиями и подтверждаю демонстрационное
                  получение средств.
                </span>
              </label>
            </>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              Отмена
            </Button>
            <Button
              loading={busy}
              disabled={
                modal === "accept"
                  ? !accepted
                  : modal !== "approve" && !reason.trim()
              }
              variant={modal === "reject" ? "danger" : "primary"}
              onClick={() =>
                action(
                  {
                    request: "needs_info",
                    reject: "rejected",
                    approve: "approved",
                    accept: "issued",
                  }[modal],
                  { ...offer, reason, accepted },
                )
              }
            >
              {modal === "request"
                ? "Отправить запрос"
                : modal === "reject"
                  ? "Подтвердить отказ"
                  : modal === "approve"
                    ? "Отправить предложение"
                    : "Подтвердить получение"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
