import React from "react";
import { PageHeading } from "../components/ui";
import ApplicationTable from "../components/ApplicationTable";
export default function Employee({ applications, navigate }) {
  const queue = applications.filter((a) => a.status !== "draft");
  return (
    <>
      <PageHeading
        title="Очередь заявок"
        description="Очередь заявок, проверка документов и решения по кредитам."
      />
      <div className="overview-statusbar" aria-label="Сводка очереди">
        {[
          {
            label: "Ожидают проверки",
            count: queue.filter((a) => a.status === "submitted").length,
          },
          {
            label: "На рассмотрении",
            count: queue.filter((a) => a.status === "manual_review").length,
          },
          {
            label: "Ждём ответ клиента",
            count: queue.filter((a) => a.status === "needs_info").length,
          },
          {
            label: "Принято решений",
            count: queue.filter((a) =>
              ["approved", "rejected", "issued"].includes(a.status),
            ).length,
          },
        ].map((s) => (
          <span key={s.label}>
            {s.label} <strong>{s.count}</strong>
          </span>
        ))}
      </div>
      <ApplicationTable
        applications={applications}
        role="employee"
        navigate={navigate}
      />
    </>
  );
}
