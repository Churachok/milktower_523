import React from "react";
import { Button, Icon, PageHeading } from "../components/ui";

export default function Home({ navigate, role }) {
  return (
    <section className="home-intro" aria-labelledby="home-title">
      <span className="home-label">Milk Tower для бизнеса</span>
      <h1 id="home-title">
        Ваш бизнес.
        <br />
        <span>Следующий шаг.</span>
      </h1>
      <p>
        Финансирование на оборотные средства и оборудование. Заявка, документы и
        решение — в одном кабинете.
      </p>
      <div className="home-actions">
        <Button onClick={() => navigate("/products")}>
          Подобрать кредит <Icon name="arrow" size={18} />
        </Button>
        <button
          className="text-button"
          onClick={() =>
            navigate(
              role === "employee"
                ? "/queue"
                : role === "client"
                  ? "/overview"
                  : "/login",
            )
          }
        >
          Перейти в личный кабинет
        </button>
      </div>
      <a className="home-process-link" href="#/how-it-works">
        Как получить финансирование <Icon name="arrow" size={16} />
      </a>
    </section>
  );
}

export function HowItWorks({ navigate }) {
  return (
    <>
      <PageHeading
        title="От задачи — к финансированию"
        description="Три шага, которые можно пройти онлайн."
      />
      <ol className="process-list">
        {[
          {
            title: "Выберите условия",
            text: "Определите цель, сумму и срок. Калькулятор покажет ориентировочный платёж до оформления заявки.",
          },
          {
            title: "Расскажите о бизнесе",
            text: "Войдите в кабинет, заполните сведения о компании и добавьте выписку и финансовую отчётность.",
          },
          {
            title: "Получите результат",
            text: "Следите за статусом в кабинете. Если понадобятся уточнения, ответьте там же. Изучите предложение и подтвердите условия.",
          },
        ].map((step, index) => (
          <li key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Button onClick={() => navigate("/products")}>
        Рассчитать платёж <Icon name="arrow" size={18} />
      </Button>
      <p className="legal-note public-disclaimer">
        В прототипе используются синтетические данные. Подписание и выдача
        средств моделируются.
      </p>
    </>
  );
}
