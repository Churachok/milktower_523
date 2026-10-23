import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Icon,
  Field,
  Notice,
  PageHeading,
  Empty,
} from "../components/ui";
import { DocumentList, UploadArea } from "./Documents";
import { api } from "../services/api";
import {
  productOf,
  PRODUCTS,
  money,
  monthlyPayment,
  validateStep,
} from "../domain/application";
const STEPS = [
  "Компания",
  "Условия кредита",
  "Финансы",
  "Документы",
  "Проверка",
];
export default function ApplicationForm({
  application,
  navigate,
  refresh,
  notify,
}) {
  const [form, setForm] = useState(() => structuredClone(application));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const modified = useRef(false);
  const saveVersion = useRef(0);
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => {
    if (!modified.current || !form) return;
    const version = ++saveVersion.current;
    setSaving(true);
    const timeout = setTimeout(() => {
      api
        .saveDraft(form.id, {
          company: form.company,
          productId: form.productId,
          amount: form.amount,
          term: form.term,
          purpose: form.purpose,
          finances: form.finances,
          consent: form.consent,
        })
        .then(() => {
          if (version === saveVersion.current) {
            setSaving(false);
            setSaveError("");
          }
        })
        .catch((e) => {
          if (version === saveVersion.current) {
            setSaving(false);
            setSaveError(e.message);
          }
        });
    }, 400);
    return () => clearTimeout(timeout);
  }, [form]);
  useEffect(() => {
    const flush = () => {
      if (!modified.current || !formRef.current) return;
      modified.current = false;
      api
        .saveDraft(formRef.current.id, formRef.current)
        .catch((error) => notify(error.message, "error"));
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [notify]);
  if (!application) return <Empty title="Заявка не найдена" />;
  if (application.status !== "draft")
    return (
      <Empty
        title="Заявка уже отправлена"
        text="Изменение отправленной заявки недоступно."
      >
        <Button onClick={() => navigate(`/applications/${application.id}`)}>
          Открыть заявку
        </Button>
      </Empty>
    );
  const p = productOf(form.productId);
  function change(key, value) {
    modified.current = true;
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setForm((prev) => {
      if (key.includes(".")) {
        const [parent, child] = key.split(".");
        return { ...prev, [parent]: { ...prev[parent], [child]: value } };
      }
      return { ...prev, [key]: value };
    });
  }
  function next(e) {
    e.preventDefault();
    const invalid = validateStep(form, step);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() =>
        document
          .querySelector(
            ".field-error input, .field-error textarea, .field-error select",
          )
          ?.focus(),
      );
      return;
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveAndLeave() {
    setBusy(true);
    try {
      await api.saveDraft(form.id, formRef.current);
      modified.current = false;
      await refresh();
      notify("Черновик сохранён");
      navigate("/applications");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    const invalid = Object.assign(
      {},
      ...STEPS.map((_, i) => validateStep(form, i)),
    );
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      setStep(
        STEPS.findIndex((_, i) => Object.keys(validateStep(form, i)).length),
      );
      return;
    }
    setBusy(true);
    try {
      await api.saveDraft(form.id, formRef.current);
      await api.transition(form.id, "submitted", "client");
      modified.current = false;
      await refresh();
      notify("Заявка отправлена в банк");
      navigate(`/applications/${form.id}`);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  const input = (key, label, type = "text", hint, extra = {}) => {
    const value = key.includes(".")
      ? form[key.split(".")[0]][key.split(".")[1]]
      : form[key];
    return (
      <Field label={label} hint={hint} error={errors[key]}>
        <input
          type={type}
          value={value}
          onChange={(e) => change(key, e.target.value)}
          aria-invalid={!!errors[key]}
          {...extra}
        />
      </Field>
    );
  };
  return (
    <>
      <button className="back-link" onClick={saveAndLeave}>
        <Icon name="back" size={17} />
        Мои заявки
      </button>
      <PageHeading title="Новая заявка" description={`${p.name} · ${form.id}`}>
        <span className={`save-indicator ${saveError ? "error-text" : ""}`}>
          <Icon
            name={saving ? "clock" : saveError ? "info" : "check"}
            size={15}
          />
          {saving
            ? "Сохраняем…"
            : saveError
              ? "Не удалось сохранить"
              : "Черновик сохранён"}
        </span>
      </PageHeading>
      <div className="form-layout">
        <div className="form-main">
          <div className="form-stepper">
            {STEPS.map((name, i) => (
              <button
                key={name}
                type="button"
                className={i === step ? "current" : i < step ? "completed" : ""}
                disabled={i > step}
                onClick={() => {
                  setStep(i);
                  setErrors({});
                }}
              >
                <span>
                  {i < step ? <Icon name="check" size={15} /> : i + 1}
                </span>
                <small>{name}</small>
              </button>
            ))}
          </div>
          <form className="card application-form" onSubmit={submit}>
            <div className="form-section-heading">
              <span className="eyebrow">ШАГ {step + 1} ИЗ 5</span>
              <h2>
                {
                  [
                    "Данные компании",
                    "Условия кредита",
                    "Финансовые показатели",
                    "Добавьте документы",
                    "Проверка заявки",
                  ][step]
                }
              </h2>
              <p>
                {
                  [
                    "Мы уже заполнили данные из вашего профиля. Проверьте их перед отправкой.",
                    "Укажите сумму, срок и задачу, которую решит кредит.",
                    "Эти сведения помогут оценить возможности вашего бизнеса.",
                    "Понадобятся выписка по счёту за 6 месяцев и финансовая отчётность.",
                    "Проверьте данные. После отправки мы начнём рассмотрение заявки.",
                  ][step]
                }
              </p>
            </div>
            {step === 0 && (
              <div className="fields-grid">
                {input("company.name", "Название компании", "text", null, {
                  autoComplete: "organization",
                })}
                {input(
                  "company.inn",
                  "ИНН компании",
                  "text",
                  "10 цифр для ООО, 12 — для ИП",
                  { inputMode: "numeric", maxLength: 12 },
                )}
                <Field label="Сфера деятельности">
                  <select
                    value={form.company.industry}
                    onChange={(e) => change("company.industry", e.target.value)}
                  >
                    <option>Производство и торговля</option>
                    <option>Услуги</option>
                    <option>Строительство</option>
                    <option>IT и технологии</option>
                    <option>Другое</option>
                  </select>
                </Field>
                {input("company.contact", "Контактное лицо", "text", null, {
                  autoComplete: "name",
                })}
                {input("company.phone", "Телефон", "tel", null, {
                  autoComplete: "tel",
                })}
                {input(
                  "company.email",
                  "Электронная почта",
                  "email",
                  "Основной процесс и сообщения остаются в кабинете",
                  { autoComplete: "email" },
                )}
              </div>
            )}
            {step === 1 && (
              <>
                <div className="product-selector">
                  {PRODUCTS.map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      className={
                        form.productId === product.id ? "selected" : ""
                      }
                      onClick={() => {
                        const next = productOf(product.id);
                        modified.current = true;
                        setForm((f) => ({
                          ...f,
                          productId: product.id,
                          amount: Math.min(
                            next.max,
                            Math.max(next.min, Number(f.amount)),
                          ),
                          term: Math.min(
                            next.maxTerm,
                            Math.max(next.minTerm, Number(f.term)),
                          ),
                        }));
                      }}
                    >
                      <Icon name={product.icon} />
                      <span>{product.short}</span>
                      <i />
                    </button>
                  ))}
                </div>
                <div className="fields-grid">
                  {input(
                    "amount",
                    "Сумма кредита, ₽",
                    "number",
                    `От ${money(p.min)} до ${money(p.max)}`,
                    { min: p.min, max: p.max, step: 10000 },
                  )}
                  {input(
                    "term",
                    "Срок, месяцев",
                    "number",
                    `От ${p.minTerm} до ${p.maxTerm} месяцев`,
                    { min: p.minTerm, max: p.maxTerm, step: 1 },
                  )}
                </div>
                <label className="range-field">
                  <span>Сумма кредита</span>
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    step="50000"
                    value={form.amount}
                    onChange={(e) => change("amount", Number(e.target.value))}
                    aria-label="Выбрать сумму кредита"
                  />
                  <span>
                    <small>{money(p.min)}</small>
                    <small>{money(p.max)}</small>
                  </span>
                </label>
                <Field label="На что нужны средства?" error={errors.purpose}>
                  <textarea
                    value={form.purpose}
                    maxLength={1000}
                    rows={3}
                    placeholder="Например, закупка сырья для новой коллекции"
                    onChange={(e) => change("purpose", e.target.value)}
                  />
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <Notice>
                  Укажите показатели за последние 12 месяцев в рублях. Если
                  долгов нет, укажите 0.
                </Notice>
                <div className="fields-grid">
                  {input(
                    "finances.revenue",
                    "Выручка за 12 месяцев, ₽",
                    "number",
                    "Все поступления от основной деятельности",
                    { min: 1 },
                  )}
                  {input(
                    "finances.expenses",
                    "Расходы за 12 месяцев, ₽",
                    "number",
                    "Операционные расходы бизнеса",
                    { min: 0 },
                  )}
                  {input(
                    "finances.debt",
                    "Текущие обязательства, ₽",
                    "number",
                    "Остаток долга по кредитам и займам",
                    { min: 0 },
                  )}
                  {input(
                    "finances.years",
                    "Сколько лет работает бизнес?",
                    "number",
                    null,
                    { min: 1, max: 100 },
                  )}
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <Field label="Тип документа">
                  <select
                    id="document-kind"
                    value={form.uploadKind || "statement"}
                    onChange={(e) => change("uploadKind", e.target.value)}
                  >
                    <option value="statement">
                      Выписка по счёту за 6 месяцев
                    </option>
                    <option value="report">Финансовая отчётность</option>
                    <option value="other">Дополнительный документ</option>
                  </select>
                </Field>
                <UploadArea
                  appId={form.id}
                  kind={form.uploadKind || "statement"}
                  notify={notify}
                  onUploaded={(updated) => {
                    modified.current = true;
                    setForm((f) => ({ ...f, documents: updated.documents }));
                    setErrors({});
                  }}
                />
                <DocumentList
                  documents={form.documents}
                  onRemove={async (id) => {
                    try {
                      const updated = await api.removeDocument(form.id, id);
                      setForm((f) => ({ ...f, documents: updated.documents }));
                    } catch (e) {
                      notify(e.message, "error");
                    }
                  }}
                />
                {errors.documents && (
                  <p className="error-text" role="alert">
                    {errors.documents}
                  </p>
                )}
                {api.mode === "mock" && (
                  <p className="legal-note">
                    Демо: сохраняем только метаданные файлов. Для проверки
                    подойдут любые непустые PDF, JPG или PNG с синтетическими
                    данными.
                  </p>
                )}
              </>
            )}
            {step === 4 && (
              <>
                <div className="review-block">
                  <div>
                    <h3>Компания</h3>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setStep(0)}
                    >
                      Изменить
                    </button>
                  </div>
                  <strong>{form.company.name}</strong>
                  <p>
                    ИНН {form.company.inn} · {form.company.contact}
                  </p>
                  <p>
                    {form.company.email} · {form.company.phone}
                  </p>
                </div>
                <div className="review-block">
                  <div>
                    <h3>Финансирование</h3>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setStep(1)}
                    >
                      Изменить
                    </button>
                  </div>
                  <dl className="summary-list">
                    <div>
                      <dt>Продукт</dt>
                      <dd>{p.name}</dd>
                    </div>
                    <div>
                      <dt>Сумма / срок</dt>
                      <dd>
                        {money(form.amount)} / {form.term} мес.
                      </dd>
                    </div>
                    <div>
                      <dt>Цель</dt>
                      <dd>{form.purpose}</dd>
                    </div>
                    <div>
                      <dt>Выручка за год</dt>
                      <dd>{money(form.finances.revenue)}</dd>
                    </div>
                    <div>
                      <dt>Документы</dt>
                      <dd>{form.documents.length} файла</dd>
                    </div>
                  </dl>
                </div>
                <label
                  className={`checkbox-label ${errors.consent ? "error-text" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => change("consent", e.target.checked)}
                  />
                  <span>
                    Подтверждаю достоверность сведений и даю согласие на
                    обработку данных для рассмотрения заявки в этом
                    демонстрационном прототипе.
                  </span>
                </label>
                {errors.consent && (
                  <p className="error-text">{errors.consent}</p>
                )}
              </>
            )}
            {saveError && (
              <Notice tone="amber">
                {saveError}. Повторите сохранение перед выходом.
              </Notice>
            )}
            <div className="form-footer">
              <Button
                variant="secondary"
                type="button"
                onClick={() => (step ? setStep((s) => s - 1) : saveAndLeave())}
                disabled={busy}
              >
                {step ? "Назад" : "Сохранить и выйти"}
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={next}>
                  Продолжить <Icon name="arrow" size={17} />
                </Button>
              ) : (
                <Button type="submit" loading={busy}>
                  Отправить заявку <Icon name="arrow" size={17} />
                </Button>
              )}
            </div>
          </form>
        </div>
        <aside className="form-aside card">
          <span className="product-icon large">
            <Icon name={p.icon} size={24} />
          </span>
          <h3>{p.name}</h3>
          <dl className="summary-list">
            <div>
              <dt>Сумма</dt>
              <dd>{money(form.amount)}</dd>
            </div>
            <div>
              <dt>Срок</dt>
              <dd>{form.term} мес.</dd>
            </div>
            <div>
              <dt>Ставка</dt>
              <dd>от {p.rate}% годовых</dd>
            </div>
          </dl>
          <div className="payment-preview">
            <small>Ориентировочный платёж</small>
            <strong>
              {money(
                monthlyPayment(Number(form.amount), Number(form.term), p.rate),
              )}
              <span>/ мес.</span>
            </strong>
          </div>
          <p className="legal-note">
            Расчёт предварительный. Точные условия появятся после рассмотрения.
          </p>
          <div className="secure-note">
            <Icon name="shield" size={18} />
            <span>Ваши данные под контролем</span>
          </div>
        </aside>
      </div>
    </>
  );
}
