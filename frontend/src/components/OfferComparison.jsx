import React from "react";
import { compareOffer, money } from "../domain/application";
const rate = (value) => `${Number(value).toLocaleString("ru-RU")}%`;
export default function OfferComparison({ application, employee = false }) {
  const { requested, offered, hasSnapshot, changed } =
    compareOffer(application);
  const rows = [
    {
      label: "Сумма кредита",
      from: requested.amount,
      to: offered.amount,
      format: money,
    },
    {
      label: "Срок",
      from: requested.term,
      to: offered.term,
      format: (value) => `${value} мес.`,
    },
    {
      label: "Ставка в год",
      from: requested.rate,
      to: offered.rate,
      format: rate,
      starting: true,
    },
    {
      label: "Расчётный платёж в месяц",
      from: requested.monthlyPayment,
      to: offered.monthlyPayment,
      format: money,
      approximate: true,
    },
  ];
  const comment = [...application.history]
    .reverse()
    .find((event) => event.title === "Финансирование одобрено")?.detail;
  return (
    <div className="offer-comparison">
      <div className="comparison-title">
        <h3>Сравнение условий</h3>
        <span className={changed ? "comparison-changed" : "comparison-matched"}>
          {changed ? "Условия изменились" : "Сумма и срок сохранены"}
        </span>
      </div>
      <table>
        <caption className="sr-only">
          Запрошенные условия и предложение банка по заявке {application.id}
        </caption>
        <thead>
          <tr>
            <th scope="col">Условия</th>
            <th scope="col">
              {employee ? "Клиент запрашивал" : "Вы запрашивали"}
            </th>
            <th scope="col">
              {application.status === "issued"
                ? "Итоговые условия"
                : "Банк предлагает"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>
                {row.starting ? "от " : row.approximate ? "≈ " : ""}
                {row.format(row.from)}
              </td>
              <td
                className={
                  Math.round(row.from * 100) !== Math.round(row.to * 100)
                    ? "condition-changed"
                    : ""
                }
              >
                <strong>
                  {row.approximate ? "≈ " : ""}
                  {row.format(row.to)}
                </strong>
                {!row.starting &&
                  Math.round(row.from) !== Math.round(row.to) && (
                    <small>
                      {row.to < row.from ? "Меньше" : "Больше"} на{" "}
                      {row.format(
                        Math.abs(Math.round(row.to) - Math.round(row.from)),
                      )}
                    </small>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="comparison-note">
        {hasSnapshot
          ? "Исходные условия и предварительный расчёт сохранены при оформлении заявки."
          : "Для первоначальной заявки расчёт не сохранялся: платёж рассчитан по минимальной ставке продукта."}{" "}
        Ставка «от» не является согласованной ставкой. Платежи рассчитаны без
        дополнительных комиссий.
      </p>
      {comment && (
        <div className="comparison-comment">
          <strong>Комментарий специалиста</strong>
          <p>{comment}</p>
        </div>
      )}
    </div>
  );
}
