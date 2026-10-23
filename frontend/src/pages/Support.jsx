import React, { useState } from "react";
import { PageHeading, Button, Icon, Notice } from "../components/ui";
export default function Support({ notify }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("potok.support.v1")) || [];
    } catch {
      return [];
    }
  });
  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const next = [
      ...messages,
      {
        id: crypto.randomUUID(),
        text: text.trim(),
        at: new Date().toISOString(),
      },
    ];
    setMessages(next);
    try {
      localStorage.setItem("potok.support.v1", JSON.stringify(next));
    } catch {
      notify("Сообщение сохранено только до перезагрузки", "error");
    }
    setText("");
    notify("Сообщение добавлено в демо-диалог");
  }
  return (
    <>
      <PageHeading
        title="Поддержка"
        description="Вопросы по заявкам, документам и условиям кредита."
      />
      <div className="support-layout">
        <section className="card support-chat">
          <div className="support-person">
            <span className="avatar manager-avatar">
              ЕС
              <i />
            </span>
            <div>
              <h3>Елена Смирнова</h3>
              <p>Ваш бизнес-партнёр</p>
            </div>
            <span className="soft-label">Внутри кабинета</span>
          </div>
          <div className="chat-body">
            <div className="chat-date">Начало диалога</div>
            <div className="bubble manager-bubble">
              Александр, добрый день! Я помогу с выбором кредита и документами.
              Какой вопрос у вас возник?
              <small>Елена · демонстрационное сообщение</small>
            </div>
            {messages.map((m) => (
              <div className="bubble client-bubble" key={m.id}>
                {m.text}
                <small>
                  {new Date(m.at).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Novosibirsk",
                  })}{" "}
                  · Сохранено в демо
                </small>
              </div>
            ))}
          </div>
          <Notice>
            Это локальный демо-диалог. Сообщения не отправляются сотруднику;
            ответы оператора не моделируются.
          </Notice>
          <form className="chat-compose" onSubmit={send}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={3000}
              rows={2}
              placeholder="Напишите сообщение…"
              aria-label="Сообщение менеджеру"
            />
            <Button
              type="submit"
              disabled={!text.trim()}
              icon="arrow"
              aria-label="Отправить сообщение"
            />
          </form>
        </section>
        <aside className="card faq">
          <h3>Частые вопросы</h3>
          {[
            {
              q: "Где узнать статус заявки?",
              a: "Откройте «Мои заявки». В карточке есть текущий статус, следующий шаг и полная история событий.",
            },
            {
              q: "Как добавить документы?",
              a: "При оформлении заявки откройте шаг «Документы». Если банк запросил сведения, добавьте файл и ответ в карточке заявки.",
            },
            {
              q: "Можно ли изменить сумму?",
              a: "До отправки можно изменить сумму и срок в черновике. После рассмотрения банк может предложить другие условия.",
            },
            {
              q: "Что делать после одобрения?",
              a: "Откройте предложение в карточке, изучите условия и подтвердите получение. В прототипе этот процесс демонстрационный.",
            },
          ].map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <Icon name="plus" size={16} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </aside>
      </div>
    </>
  );
}
