import React, { useId } from "react";
import { Button, Field, Icon } from "./ui";
import {
  PRODUCTS,
  productOf,
  money,
  calculateLoan,
  validateLoanTerms,
} from "../domain/application";

export default function LoanCalculator({ value, onChange, onContinue, busy }) {
  const titleId = useId();
  const product = productOf(value.productId);
  const errors = validateLoanTerms(value.productId, value.amount, value.term);
  const estimate = calculateLoan(value.productId, value.amount, value.term);
  function update(key, next) {
    onChange({ ...value, [key]: next });
  }
  function selectProduct(id) {
    const next = productOf(id);
    onChange({
      productId: id,
      amount: Math.max(
        next.min,
        Math.min(next.max, Number(value.amount) || next.min),
      ),
      term: Math.max(
        next.minTerm,
        Math.min(next.maxTerm, Number(value.term) || next.minTerm),
      ),
    });
  }
  function submit(event) {
    event.preventDefault();
    if (estimate && !busy)
      onContinue(product.id, { amount: estimate.amount, term: estimate.term });
  }
  return (
    <section
      className="loan-calculator"
      id="loan-calculator"
      aria-labelledby={titleId}
    >
      <div className="calculator-heading">
        <div>
          <h2 id={titleId}>Рассчитайте платёж</h2>
          <p>Выберите сумму и срок. Заявка пока не создаётся.</p>
        </div>
        <span className="calculator-label">
          <Icon name="percent" size={16} />
          Предварительный расчёт
        </span>
      </div>
      <div
        className="calculator-products"
        role="group"
        aria-label="Продукт для расчёта"
      >
        {PRODUCTS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === value.productId}
            className={p.id === value.productId ? "selected" : ""}
            onClick={() => selectProduct(p.id)}
          >
            <Icon name={p.icon} size={20} />
            <span>{p.name}</span>
            <i />
          </button>
        ))}
      </div>
      <form className="calculator-layout" onSubmit={submit} noValidate>
        <div className="calculator-inputs">
          <div className="calculator-control">
            <Field
              label="Сумма кредита, ₽"
              error={errors.amount}
              hint={`От ${money(product.min)} до ${money(product.max)}`}
            >
              <input
                type="number"
                inputMode="numeric"
                min={product.min}
                max={product.max}
                step="10000"
                value={value.amount}
                onChange={(e) => update("amount", e.target.value)}
              />
            </Field>
            <input
              className="calculator-range"
              type="range"
              aria-label="Сумма кредита ползунком"
              min={product.min}
              max={product.max}
              step="10000"
              value={Math.max(
                product.min,
                Math.min(product.max, Number(value.amount) || product.min),
              )}
              onChange={(e) => update("amount", Number(e.target.value))}
            />
          </div>
          <div className="calculator-control">
            <Field
              label="Срок кредита, месяцев"
              error={errors.term}
              hint={`От ${product.minTerm} до ${product.maxTerm} месяцев`}
            >
              <input
                type="number"
                inputMode="numeric"
                min={product.minTerm}
                max={product.maxTerm}
                step="1"
                value={value.term}
                onChange={(e) => update("term", e.target.value)}
              />
            </Field>
            <input
              className="calculator-range"
              type="range"
              aria-label="Срок кредита ползунком"
              min={product.minTerm}
              max={product.maxTerm}
              step="1"
              value={Math.max(
                product.minTerm,
                Math.min(
                  product.maxTerm,
                  Number(value.term) || product.minTerm,
                ),
              )}
              onChange={(e) => update("term", Number(e.target.value))}
            />
          </div>
          <div
            className="calculator-presets"
            role="group"
            aria-label="Быстрый выбор срока"
          >
            {[6, 12, 24, 36, 48, 60]
              .filter(
                (term) => term >= product.minTerm && term <= product.maxTerm,
              )
              .map((term) => (
                <button
                  key={term}
                  type="button"
                  aria-pressed={Number(value.term) === term}
                  className={Number(value.term) === term ? "selected" : ""}
                  onClick={() => update("term", term)}
                >
                  {term} мес.
                </button>
              ))}
          </div>
        </div>
        <div className="calculator-result">
          <span>Ежемесячный платёж</span>
          <output
            className="calculator-payment"
            aria-live="polite"
            aria-atomic="true"
          >
            {estimate ? money(estimate.monthlyPayment) : "—"}
          </output>
          <dl>
            <div>
              <dt>Ставка для расчёта</dt>
              <dd>от {product.rate.toLocaleString("ru-RU")}% годовых</dd>
            </div>
            <div>
              <dt>Всего выплат по расчёту</dt>
              <dd>{estimate ? money(estimate.totalPayment) : "—"}</dd>
            </div>
            <div>
              <dt>Проценты по расчёту</dt>
              <dd>{estimate ? money(estimate.overpayment) : "—"}</dd>
            </div>
          </dl>
          <p>
            Расчёт по минимальной ставке продукта. Итоговые условия появятся
            после рассмотрения заявки.
          </p>
          <Button type="submit" loading={busy} disabled={!estimate}>
            Продолжить с этими условиями
            <Icon name="arrow" size={17} />
          </Button>
          <small>Сумма и срок перенесутся в новый черновик.</small>
        </div>
      </form>
    </section>
  );
}
