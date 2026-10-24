import React from "react";
import { Button, PageHeading } from "../components/ui";
import { api } from "../services/api";

export default function Profile({
  role,
  changeRole,
  logout,
  loggingOut,
  onReset,
}) {
  const employee = role === "employee";
  return (
    <>
      <PageHeading
        title="Профиль"
        description="Данные учётной записи и доступ к кабинету."
      />
      <section className="card account-profile">
        <div className="account-person">
          <span className="avatar large-avatar">{employee ? "ЕС" : "АВ"}</span>
          <div>
            <h2>{employee ? "Елена Смирнова" : "Александр Волков"}</h2>
            <p>
              {employee ? "Кредитный специалист" : "Представитель компании"}
            </p>
          </div>
        </div>
        {!employee && (
          <dl className="summary-list roomy">
            <div>
              <dt>Компания</dt>
              <dd>ООО «Мануфактура»</dd>
            </div>
            <div>
              <dt>ИНН</dt>
              <dd>5408123456</dd>
            </div>
            <div>
              <dt>Электронная почта</dt>
              <dd>alex@manufactura.example</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd>+7 913 000-12-34</dd>
            </div>
          </dl>
        )}
        <Button
          variant="secondary"
          icon="logout"
          loading={loggingOut}
          onClick={logout}
        >
          Выйти из кабинета
        </Button>
      </section>
      {api.mode === "mock" && (
        <details className="account-demo">
          <summary>Демонстрационный режим</summary>
          <p>
            Смена роли помогает проверить путь клиента и сотрудника. Серверная
            авторизация пока не подключена.
          </p>
          <div className="account-demo-actions">
            <Button
              variant="secondary"
              onClick={() => changeRole(employee ? "client" : "employee")}
            >
              {employee
                ? "Перейти в кабинет клиента"
                : "Перейти в кабинет сотрудника"}
            </Button>
            <Button variant="danger-quiet" onClick={onReset}>
              Восстановить демо-данные
            </Button>
          </div>
        </details>
      )}
    </>
  );
}
