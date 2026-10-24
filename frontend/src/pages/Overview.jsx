import React from "react";
import { Badge, Button, Empty, Icon, PageHeading } from "../components/ui";
import LoanCalculator from "../components/LoanCalculator";
import { money, productOf } from "../domain/application";

export default function Overview({ applications, navigate }) {
  const attention = applications
    .filter((app) => ["needs_info", "approved"].includes(app.status))
    .sort(
      (a, b) =>
        Number(b.status === "needs_info") - Number(a.status === "needs_info"),
    );
  const recent = [...applications]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 3);
  const pending = applications.filter((app) =>
    ["submitted", "manual_review", "needs_info"].includes(app.status),
  );
  const approved = applications.filter((app) => app.status === "approved");
  const drafts = applications.filter((app) => app.status === "draft");
  return (
    <>
      <PageHeading
        title="Личный кабинет"
        description="Ваши заявки и следующий шаг по кредиту."
      >
        <Button icon="plus" onClick={() => navigate("/products")}>
          Новая заявка
        </Button>
      </PageHeading>
      {attention.length ? (
        <section
          className="overview-attention"
          aria-labelledby="attention-title"
        >
          <div className="attention-heading">
            <h2 id="attention-title">Следующий шаг</h2>
            {attention.length > 1 && (
              <button
                className="text-button"
                onClick={() => navigate("/applications")}
              >
                Ещё {attention.length - 1}
              </button>
            )}
          </div>
          {attention.slice(0, 1).map((app) => (
            <div
              className={`attention-row ${app.status === "needs_info" ? "attention-request" : "attention-offer"}`}
              key={app.id}
            >
              <span className="attention-icon">
                <Icon
                  name={app.status === "needs_info" ? "chat" : "check"}
                  size={20}
                />
              </span>
              <div className="attention-copy">
                <h3>
                  {app.status === "needs_info"
                    ? "Банк запросил сведения"
                    : "Кредит одобрен — проверьте условия"}
                </h3>
                <p>
                  {app.id} · {productOf(app.productId).short}
                </p>
              </div>
              <Button
                variant={app.status === "needs_info" ? "primary" : "secondary"}
                onClick={() => navigate(`/applications/${app.id}`)}
              >
                {app.status === "needs_info"
                  ? "Ответить на запрос"
                  : "Посмотреть условия"}
                <Icon name="arrow" size={16} />
              </Button>
            </div>
          ))}
        </section>
      ) : (
        <div className="overview-clear">
          <Icon name="check" size={20} />
          <div>
            <strong>Действий от вас не требуется</strong>
            <p>
              {pending.length
                ? "Банк рассматривает заявки. Решения появятся в кабинете."
                : "Новые заявки и запросы банка будут отображаться здесь."}
            </p>
          </div>
        </div>
      )}
      <div className="overview-statusbar" aria-label="Сводка по заявкам">
        <span>
          В работе <strong>{pending.length}</strong>
        </span>
        <span>
          Предложения <strong>{approved.length}</strong>
        </span>
        <span>
          Черновики <strong>{drafts.length}</strong>
        </span>
      </div>
      <section
        className="card recent-applications"
        aria-labelledby="recent-title"
      >
        <div className="section-heading">
          <h2 id="recent-title">Последние заявки</h2>
          <button
            className="text-button"
            onClick={() => navigate("/applications")}
          >
            Все заявки <Icon name="arrow" size={16} />
          </button>
        </div>
        {recent.map((app) => (
          <button
            className="recent-application"
            key={app.id}
            onClick={() =>
              navigate(
                `/applications/${app.id}${app.status === "draft" ? "/edit" : ""}`,
              )
            }
          >
            <span>
              <strong>{productOf(app.productId).short}</strong>
              <small>{app.id}</small>
            </span>
            <span className="recent-terms">
              <strong>{money(app.amount)}</strong>
              <small>{app.term} мес.</small>
            </span>
            <Badge status={app.status} />
            <Icon name="chevron" size={17} />
          </button>
        ))}
        {!recent.length && (
          <Empty
            title="Пока нет заявок"
            text="Начните с расчёта суммы и срока кредита."
          />
        )}
      </section>
    </>
  );
}

export function Products({
  createApplication,
  calculatorValue,
  setCalculatorValue,
  creating,
  requiresLogin = false,
}) {
  return (
    <>
      <PageHeading
        title="Кредиты для бизнеса"
        description="Рассчитайте платёж до оформления заявки. Выбранные сумма и срок сохранятся в черновике."
      />
      <LoanCalculator
        value={calculatorValue}
        onChange={setCalculatorValue}
        onContinue={createApplication}
        busy={creating}
        requiresLogin={requiresLogin}
      />
      <p className="legal-note">
        Демонстрационные условия. Итоговые сумма, ставка и срок определяются при
        рассмотрении заявки. Предложение не является публичной офертой.
      </p>
      <details className="product-requirements">
        <summary>Что понадобится для заявки</summary>
        <p>
          Сведения о компании, выручка и расходы за 12 месяцев, остаток долгов.
          Из документов — выписка по счёту за 6 месяцев и финансовая отчётность.
        </p>
        <p>Все дальнейшие действия доступны в личном кабинете.</p>
      </details>
    </>
  );
}
