import React, { useRef, useState } from "react";
import { Button, Icon, PageHeading, Empty, Notice } from "../components/ui";
import { date } from "../domain/application";
import { api } from "../services/api";
export function DocumentList({ documents, onRemove, notify }) {
  return (
    <div className="document-list">
      {documents.map((d) => (
        <div className="document-row" key={d.id}>
          <span className="document-icon">
            <Icon name="file" size={22} />
            <small>{d.name.split(".").at(-1).toUpperCase()}</small>
          </span>
          <div>
            <strong>{d.name}</strong>
            <small>
              {d.size >= 1048576
                ? `${(d.size / 1048576).toFixed(1)} МБ`
                : `${Math.ceil(d.size / 1024)} КБ`}{" "}
              · {date(d.uploadedAt)}
              {d.demo && " · демо-образец"}
            </small>
          </div>
          {onRemove && (
            <button
              className="icon-button"
              aria-label={`Удалить ${d.name}`}
              onClick={() => onRemove(d.id)}
            >
              <Icon name="trash" size={17} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
export function UploadArea({ appId, kind, onUploaded, notify }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  async function upload(files) {
    if (!files.length || busy) return;
    setBusy(true);
    try {
      let result;
      for (const file of Array.from(files))
        result = await api.upload(appId, file, kind);
      onUploaded(result);
      notify(
        api.mode === "mock"
          ? "Документ добавлен. В демо сохраняются название и размер файла."
          : "Документ загружен",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div
      className={`upload-area ${drag ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload(e.dataTransfer.files);
      }}
    >
      <span className="upload-icon">
        <Icon name="upload" size={24} />
      </span>
      <strong>{busy ? "Добавляем документы…" : "Перетащите файл сюда"}</strong>
      <p>
        или{" "}
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => ref.current.click()}
        >
          выберите на компьютере
        </button>
      </p>
      <small>PDF, JPG или PNG · до 10 МБ на файл</small>
      <input
        className="sr-only"
        ref={ref}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        tabIndex={-1}
        onChange={(e) => upload(e.target.files)}
      />
    </div>
  );
}
export default function Documents({ applications, navigate }) {
  const [query, setQuery] = useState("");
  const docs = applications
    .flatMap((a) => a.documents.map((d) => ({ ...d, applicationId: a.id })))
    .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHeading
        title="Документы"
        description="Все документы ваших заявок — в одном месте."
      />
      <Notice icon="shield">
        Документы привязаны к заявкам. Добавить новый файл можно при оформлении
        заявки или в ответ на запрос банка.
      </Notice>
      <section className="card documents-page">
        <div className="section-heading">
          <h2>
            Мои документы <span className="count-label">{docs.length}</span>
          </h2>
          <label className="search-input">
            <Icon name="search" size={17} />
            <input
              placeholder="Название документа"
              aria-label="Поиск документов"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {docs.length ? (
          docs.map((d) => (
            <div
              className="document-with-application"
              key={`${d.applicationId}-${d.id}`}
            >
              <DocumentList documents={[d]} />
              <button
                className="text-button"
                onClick={() => navigate(`/applications/${d.applicationId}`)}
              >
                {d.applicationId}
                <Icon name="arrow" size={15} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            title="Документов пока нет"
            text="Они появятся здесь после добавления к заявке."
          />
        )}
      </section>
      {api.mode === "mock" && (
        <p className="legal-note">
          В демонстрационном режиме сохраняются только метаданные документов.
          Содержимое файлов не отправляется на сервер и не хранится в браузере.
        </p>
      )}
    </>
  );
}
