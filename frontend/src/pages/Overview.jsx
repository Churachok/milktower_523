import React from "react";
import { Button, Icon, PageHeading } from "../components/ui";
import ApplicationTable from "../components/ApplicationTable";
import LoanCalculator from "../components/LoanCalculator";
import { money, PRODUCTS, productOf } from "../domain/application";

const percent = (value) => Number(value).toLocaleString("ru-RU");

export function ProductCard({ product, onSelect, full = false }) {
  return (
    <article className={`product-card ${full ? "full-product" : ""}`}>
      <div className="product-card-top">
        <span className="product-type">{product.tag}</span>
        <Icon name={product.icon} size={24} />
      </div>
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <div className="product-terms">
        <div>
          <strong>до {product.max / 1000000} млн ₽</strong>
          <small>сумма</small>
        </div>
        <div>
          <strong>от {percent(product.rate)}%</strong>
          <small>годовых</small>
        </div>
        <div>
          <strong>до {product.maxTerm} мес.</strong>
          <small>срок</small>
        </div>
      </div>
      {full && (
        <ul className="feature-list">
          <li>
            <Icon name="check" size={16} />
            Заявка и документы онлайн
          </li>
          <li>
            <Icon name="check" size={16} />
            Статус рассмотрения в кабинете
          </li>
          <li>
            <Icon name="check" size={16} />
            Условия после проверки заявки
          </li>
        </ul>
      )}
      <Button
        variant={full ? "primary" : "secondary"}
        onClick={() => onSelect(product.id)}
      >
        Рассчитать кредит
      </Button>
    </article>
  );
}

export default function Overview({ applications, navigate }) {
  const attention = applications.filter((app) =>
    ["needs_info", "approved"].includes(app.status),
  );
  const pending = applications.filter((app) =>
    ["submitted", "manual_review", "needs_info"].includes(app.status),
  );
  const approved = applications.filter((app) => app.status === "approved");
  const drafts = applications.filter((app) => app.status === "draft");
  return (
    <>
      <PageHeading
        title="Кредиты и заявки"
        description="ООО «Мануфактура» · ИНН 5408123456"
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
            <h2 id="attention-title">Требуют внимания</h2>
            <span>{attention.length}</span>
          </div>
          {attention.map((app) => (
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
              <strong className="attention-amount">
                {money(app.offer?.amount || app.amount)}
              </strong>
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
          Одобрено{" "}
          <strong>
            {money(
              approved.reduce(
                (sum, app) => sum + (app.offer?.amount || app.amount),
                0,
              ),
            )}
          </strong>
        </span>
        <span>
          Черновики <strong>{drafts.length}</strong>
        </span>
      </div>
      <ApplicationTable
        applications={applications}
        compact
        role="client"
        navigate={navigate}
      />
      <section className="credit-promo">
        <div>
          <h2>Кредит для бизнеса</h2>
          <p>До 15 млн ₽ · от 17,5% годовых · до 5 лет</p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/products")}>
          Рассчитать платёж
          <Icon name="arrow" size={16} />
        </Button>
      </section>
    </>
  );
}

export function Products({
  createApplication,
  calculatorValue,
  setCalculatorValue,
  creating,
}) {
  function selectProduct(id) {
    const product = productOf(id);
    setCalculatorValue((value) => ({
      productId: id,
      amount: Math.max(
        product.min,
        Math.min(product.max, Number(value.amount) || product.min),
      ),
      term: Math.max(
        product.minTerm,
        Math.min(product.maxTerm, Number(value.term) || product.minTerm),
      ),
    }));
    document
      .getElementById("loan-calculator")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
      />
      <div className="section-heading outside">
        <h2>Условия продуктов</h2>
      </div>
      <div className="products-grid products-page">
        {PRODUCTS.map((product) => (
          <ProductCard
            product={product}
            key={product.id}
            full
            onSelect={selectProduct}
          />
        ))}
      </div>
      <p className="legal-note">
        Демонстрационные условия. Итоговые сумма, ставка и срок определяются при
        рассмотрении заявки. Предложение не является публичной офертой.
      </p>
      <section className="card product-help">
        <Icon name="help" size={24} />
        <div>
          <h3>Какой кредит выбрать</h3>
          <p>
            Оборотный кредит — для закупок, оплаты поставок и текущих расходов.
            Инвестиционный — для оборудования и расширения производства.
          </p>
        </div>
      </section>
    </>
  );
}
