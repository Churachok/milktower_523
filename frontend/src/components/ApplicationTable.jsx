import React, { useState } from "react";
import { Icon, Badge, Empty } from "./ui";
import { productOf, money, date } from "../domain/application";
export default function ApplicationTable({
  applications,
  role,
  compact = false,
  navigate,
}) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const available =
    role === "employee"
      ? applications.filter((a) => a.status !== "draft")
      : applications;
  const filters =
    role === "employee"
      ? [
          { id: "all", label: "Все заявки" },
          { id: "active", label: "В работе" },
          { id: "needs_info", label: "Уточнение" },
          { id: "decisions", label: "Решения" },
        ]
      : [
          { id: "all", label: "Все заявки" },
          { id: "active", label: "В работе" },
          { id: "decisions", label: "Решения" },
          { id: "draft", label: "Черновики" },
        ];
  const match = (a, id) =>
    id === "all" ||
    (id === "active"
      ? ["submitted", "manual_review", "needs_info"].includes(a.status)
      : id === "decisions"
        ? ["approved", "rejected", "issued"].includes(a.status)
        : a.status === id);
  const filtered = available.filter(
    (a) =>
      match(a, tab) &&
      `${a.id} ${a.company.name} ${productOf(a.productId).name} ${a.amount}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const open = (a) =>
    navigate(`/applications/${a.id}${a.status === "draft" ? "/edit" : ""}`);
  return (
    <section className="card applications-card">
      {compact && (
        <div className="section-heading">
          <div className="inline-title">
            <h2>{role === "employee" ? "Очередь заявок" : "Мои заявки"}</h2>
            <span className="count-label">{available.length}</span>
          </div>
          {compact && (
            <button
              className="text-button"
              onClick={() => navigate("/applications")}
            >
              Все заявки <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
      )}
      <div className="table-toolbar">
        <div className="tabs" role="tablist" aria-label="Фильтр заявок">
          {filters.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={tab === f.id}
              className={tab === f.id ? "active" : ""}
              onClick={() => setTab(f.id)}
            >
              {f.label}
              <span>{available.filter((a) => match(a, f.id)).length}</span>
            </button>
          ))}
        </div>
        {!compact && (
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Номер, компания или продукт"
              aria-label="Найти заявку"
            />
          </label>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                {role === "employee" ? "Компания / заявка" : "Продукт / заявка"}
              </th>
              <th>Сумма и срок</th>
              <th>Статус</th>
              <th>{compact ? "Следующий шаг" : "Обновлена"}</th>
              <th>
                <span className="sr-only">Открыть</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>
                  <button className="application-link" onClick={() => open(a)}>
                    <span
                      className={`product-icon ${a.productId === "equipment" ? "violet" : ""}`}
                    >
                      <Icon name={productOf(a.productId).icon} />
                    </span>
                    <span>
                      <strong>
                        {role === "employee"
                          ? a.company.name
                          : productOf(a.productId).short}
                      </strong>
                      <small>
                        {a.id}{" "}
                        <span>
                          · {date(a.createdAt).replace(" 2026 г.", "")}
                        </span>
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <strong className="amount">{money(a.amount)}</strong>
                  <small>{a.term} мес.</small>
                </td>
                <td>
                  <Badge status={a.status} />
                </td>
                <td>
                  {compact ? (
                    <button
                      className={`row-action ${a.status === "needs_info" ? "amber-text" : ""}`}
                      onClick={() => open(a)}
                    >
                      {{
                        needs_info: "Ответить на запрос",
                        approved: "Посмотреть условия",
                        draft: "Продолжить",
                        issued: "Посмотреть результат",
                        rejected: "Посмотреть решение",
                      }[a.status] || "Следим за заявкой"}
                      {[
                        "needs_info",
                        "approved",
                        "draft",
                        "issued",
                        "rejected",
                      ].includes(a.status) && <Icon name="arrow" size={14} />}
                    </button>
                  ) : (
                    <span className="muted">{date(a.updatedAt)}</span>
                  )}
                </td>
                <td>
                  <button
                    className="icon-button subtle"
                    aria-label={`Открыть заявку ${a.id}`}
                    onClick={() => open(a)}
                  >
                    <Icon name="chevron" size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <Empty
          title="Заявок не найдено"
          text="Попробуйте другой фильтр или создайте новую заявку."
        />
      )}
    </section>
  );
}
