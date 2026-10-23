import React from "react";
import { PageHeading, Icon, Notice } from "../components/ui";
import ApplicationTable from "../components/ApplicationTable";
export default function Employee({ applications, navigate }) {
  const queue = applications.filter((a) => a.status !== "draft");
  return (
    <>
      <PageHeading
        title="Кредитные заявки"
        description="Очередь заявок, проверка документов и решения по кредитам."
      />
      <div className="employee-stats">
        {[
          {
            label: "Ожидают проверки",
            count: queue.filter((a) => a.status === "submitted").length,
            icon: "shield",
            color: "blue-soft",
          },
          {
            label: "На рассмотрении",
            count: queue.filter((a) => a.status === "manual_review").length,
            icon: "file",
            color: "purple-soft",
          },
          {
            label: "Ждём ответ клиента",
            count: queue.filter((a) => a.status === "needs_info").length,
            icon: "chat",
            color: "amber-soft",
          },
          {
            label: "Принято решений",
            count: queue.filter((a) =>
              ["approved", "rejected", "issued"].includes(a.status),
            ).length,
            icon: "check",
            color: "green-soft",
          },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <span className={`stat-icon ${s.color}`}>
              <Icon name={s.icon} />
            </span>
            <div>
              <span className="stat-label">{s.label}</span>
              <strong>{s.count}</strong>
            </div>
          </div>
        ))}
      </div>
      <Notice icon="info">
        {applications.some((a) => a.status === "submitted")
          ? "Есть новые заявки. Откройте карточку и завершите демо-проверку, чтобы принять решение."
          : "Откройте заявку на рассмотрении, изучите проверки и предложите условия или запросите уточнение."}
      </Notice>
      <ApplicationTable
        applications={applications}
        role="employee"
        navigate={navigate}
      />
    </>
  );
}
