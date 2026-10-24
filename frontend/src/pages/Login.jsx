import React, { useState } from "react";
import { Button, Icon, Notice } from "../components/ui";
import { api } from "../services/api";

export default function Login({ onLogin, pendingLoan }) {
  const [selected, setSelected] = useState("client");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const role = api.mode === "mock" ? selected : (await api.session())?.role;
      if (!["client", "employee"].includes(role))
        throw new Error("Сервер не вернул допустимую роль");
      await onLogin(role);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sign-in card" aria-labelledby="sign-in-title">
      <span className="product-icon">
        <Icon name="shield" />
      </span>
      <h1 id="sign-in-title">Вход в кабинет</h1>
      <p>
        {pendingLoan
          ? "Войдите, чтобы продолжить заявку. Выбранные сумма и срок сохранятся."
          : "Заявки, документы и решения по кредитам — в одном месте."}
      </p>
      <form onSubmit={submit}>
        {api.mode === "mock" ? (
          <fieldset className="sign-in-roles" disabled={busy}>
            <legend>Выберите роль</legend>
            {[
              {
                value: "client",
                label: "Предприниматель",
                description: "Подать заявку и получить решение",
              },
              {
                value: "employee",
                label: "Сотрудник",
                description: "Рассмотреть заявки клиентов",
              },
            ].map((item) => (
              <label
                key={item.value}
                className={selected === item.value ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="role"
                  value={item.value}
                  checked={selected === item.value}
                  onChange={() => setSelected(item.value)}
                />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <Notice>
            Для входа нужна действующая серверная сессия. Подключение
            авторизации выполняет команда backend.
          </Notice>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy}>
          {api.mode === "mock"
            ? "Войти в демо-кабинет"
            : "Проверить серверную сессию"}
          <Icon name="arrow" size={18} />
        </Button>
      </form>
      {api.mode === "mock" && (
        <small className="legal-note">
          Демонстрационный вход без пароля. Используются только синтетические
          данные.
        </small>
      )}
    </section>
  );
}
