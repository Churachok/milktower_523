// Frontend adapter. Demo data is synthetic; this module does not implement bank scoring.
import { seedApplications, DEMO_CHECKS } from "../data/seed.js";
import {
  assertTransition,
  productOf,
  calculateLoan,
  validateLoanTerms,
} from "../domain/application.js";
const STORAGE_KEY = "potok.applications.v1";
const MODE = import.meta.env?.VITE_API_MODE || "mock";
const BASE = (import.meta.env?.VITE_API_BASE_URL || "/api/v1").replace(
  /\/$/,
  "",
);
let memory;
let persistenceWarning = "";
export function readDemo() {
  if (memory) return structuredClone(memory);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (
      Array.isArray(value) &&
      value.every(
        (a) =>
          a.id &&
          a.company &&
          Array.isArray(a.history) &&
          Array.isArray(a.documents),
      )
    )
      memory = value;
    else memory = seedApplications();
  } catch {
    memory = seedApplications();
    persistenceWarning =
      "Хранилище браузера недоступно. Изменения сохраняются только до перезагрузки.";
  }
  return structuredClone(memory);
}
function writeDemo(items) {
  memory = structuredClone(items);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    persistenceWarning =
      "Не удалось сохранить изменения в браузере. Не закрывайте вкладку.";
  }
  window.dispatchEvent(new Event("potok-change"));
  return structuredClone(items);
}
export const getPersistenceWarning = () => persistenceWarning;
export function invalidateDemo() {
  memory = undefined;
}
async function http(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.message || `Не удалось выполнить запрос (${response.status})`,
      );
    }
    return response.status === 204 ? null : await response.json();
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("Сервер не ответил вовремя. Попробуйте ещё раз.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function update(id, operation) {
  const items = readDemo();
  const index = items.findIndex((a) => a.id === id);
  if (index < 0) throw new Error("Заявка не найдена");
  items[index] = operation(items[index]);
  writeDemo(items);
  return items[index];
}
const addEvent = (app, title, detail, actor) => ({
  ...app,
  updatedAt: new Date().toISOString(),
  history: [
    ...app.history,
    {
      id: crypto.randomUUID(),
      title,
      detail,
      actor,
      at: new Date().toISOString(),
    },
  ],
});
export const api = {
  mode: MODE,
  async logout() {
    if (MODE === "http") await http("/session", { method: "DELETE" });
  },
  async session() {
    return MODE === "http" ? http("/session") : { role: "client" };
  },
  async list() {
    return MODE === "http" ? http("/applications") : readDemo();
  },
  async create(productId, terms = {}) {
    if (!["working", "equipment"].includes(productId))
      throw new Error("Неизвестный кредитный продукт");
    const amount =
      terms.amount ?? (productId === "equipment" ? 5000000 : 1000000);
    const term = terms.term ?? 24;
    const errors = validateLoanTerms(productId, amount, term);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const calculation = calculateLoan(productId, amount, term);
    if (MODE === "http")
      return http("/applications", {
        method: "POST",
        body: JSON.stringify({
          productId,
          amount: Number(amount),
          term: Number(term),
          calculation,
        }),
      });
    const items = readDemo();
    const app = {
      id: `PT-2026-${String(Math.max(46, ...items.map((a) => Number(a.id.split("-").at(-1)) || 0)) + 1).padStart(4, "0")}`,
      status: "draft",
      productId,
      amount: Number(amount),
      term: Number(term),
      calculation,
      purpose: "",
      company: {
        name: "ООО «Мануфактура»",
        inn: "5408123456",
        industry: "Производство и торговля",
        contact: "Александр Волков",
        email: "alex@manufactura.example",
        phone: "+7 913 000-12-34",
      },
      finances: { revenue: "", expenses: "", debt: "0", years: "" },
      documents: [],
      consent: false,
      history: [],
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const created = addEvent(
      app,
      "Черновик создан",
      "Вы начали новую заявку.",
      "Клиент",
    );
    writeDemo([created, ...items]);
    return created;
  },
  async saveDraft(id, changes) {
    const allowed = [
      "productId",
      "amount",
      "term",
      "purpose",
      "company",
      "finances",
      "consent",
    ];
    const draft = Object.fromEntries(
      allowed
        .filter((key) => Object.hasOwn(changes, key))
        .map((key) => [key, changes[key]]),
    );
    if (
      Object.hasOwn(draft, "productId") &&
      Object.hasOwn(draft, "amount") &&
      Object.hasOwn(draft, "term")
    )
      draft.calculation = calculateLoan(
        draft.productId,
        draft.amount,
        draft.term,
      );
    if (MODE === "http")
      return http(`/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
    return update(id, (app) => {
      if (app.status !== "draft")
        throw new Error("Редактировать можно только черновик");
      const merged = { ...app, ...draft };
      return {
        ...merged,
        calculation: calculateLoan(
          merged.productId,
          merged.amount,
          merged.term,
        ),
        id: app.id,
        status: app.status,
        updatedAt: new Date().toISOString(),
      };
    });
  },
  async transition(id, next, role, payload = {}) {
    if (MODE === "http")
      return http(`/applications/${id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action: next, ...payload }),
      });
    return update(id, (app) => {
      assertTransition(app, next, role);
      let changed = { ...app, status: next };
      let title = "";
      let detail = "";
      const actor = role === "employee" ? "Елена Смирнова" : "Александр Волков";
      if (next === "submitted") {
        title = "Заявка отправлена";
        detail =
          app.status === "needs_info"
            ? "Дополнительные сведения переданы банку."
            : "Начинаем проверку данных и документов.";
        if (app.status === "needs_info") {
          if (!payload.reply?.trim())
            throw new Error("Добавьте ответ на запрос");
          changed.messages = [
            ...app.messages,
            {
              id: crypto.randomUUID(),
              text: payload.reply,
              actor,
              at: new Date().toISOString(),
            },
          ];
          changed.request = null;
        }
      }
      if (next === "manual_review") {
        title = "Заявка на рассмотрении";
        detail =
          "Демонстрационные проверки завершены. Решение принимает сотрудник.";
        changed.checks = structuredClone(DEMO_CHECKS);
      }
      if (next === "needs_info") {
        if (!payload.reason?.trim())
          throw new Error("Укажите, какие сведения нужны");
        changed.request = payload.reason;
        title = "Нужны дополнительные сведения";
        detail = payload.reason;
      }
      if (next === "approved") {
        const p = productOf(app.productId);
        const amount = Number(payload.amount);
        const term = Number(payload.term);
        const rate = Number(payload.rate);
        if (
          !Number.isFinite(amount) ||
          amount < p.min ||
          amount > app.amount ||
          amount > p.max ||
          !Number.isInteger(term) ||
          term < p.minTerm ||
          term > p.maxTerm ||
          !Number.isFinite(rate) ||
          rate <= 0 ||
          rate > 100
        )
          throw new Error("Проверьте сумму, срок и ставку предложения");
        changed.offer = {
          amount,
          term,
          rate,
          expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        };
        title = "Финансирование одобрено";
        detail = payload.reason || "Для клиента подготовлено предложение.";
      }
      if (next === "rejected") {
        if (!payload.reason?.trim())
          throw new Error("Укажите понятную клиенту причину отказа");
        changed.rejectionReason = payload.reason;
        title = "Принято решение по заявке";
        detail = payload.reason;
      }
      if (next === "issued") {
        if (!payload.accepted)
          throw new Error("Подтвердите условия предложения");
        if (Date.parse(app.offer.expiresAt) < Date.now())
          throw new Error("Срок предложения истёк. Обратитесь к менеджеру.");
        title = "Средства получены";
        detail =
          "Демонстрационная выдача завершена. Реального перевода денег не было.";
      }
      return addEvent(changed, title, detail, actor);
    });
  },
  async upload(id, file, kind) {
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      !/\.(pdf|jpe?g|png)$/i.test(file.name)
    )
      throw new Error("Поддерживаются PDF, JPG и PNG");
    if (file.size > 10 * 1024 * 1024 || file.size === 0)
      throw new Error("Файл должен быть непустым и не больше 10 МБ");
    if (MODE === "http") {
      const data = new FormData();
      data.append("file", file);
      data.append("kind", kind);
      return http(`/applications/${id}/documents`, {
        method: "POST",
        body: data,
      });
    }
    const document = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      kind,
      uploadedAt: new Date().toISOString(),
      demo: false,
    };
    return update(id, (app) => {
      if (!["draft", "needs_info"].includes(app.status))
        throw new Error("Добавить документ сейчас нельзя");
      return {
        ...app,
        documents: [...app.documents, document],
        updatedAt: new Date().toISOString(),
      };
    });
  },
  async removeDocument(id, documentId) {
    if (MODE === "http")
      return http(`/applications/${id}/documents/${documentId}`, {
        method: "DELETE",
      });
    return update(id, (app) => {
      if (!["draft", "needs_info"].includes(app.status))
        throw new Error("Удалить документ сейчас нельзя");
      return {
        ...app,
        documents: app.documents.filter((d) => d.id !== documentId),
      };
    });
  },
  async removeDraft(id) {
    if (MODE === "http")
      return http(`/applications/${id}`, { method: "DELETE" });
    const items = readDemo();
    if (items.find((a) => a.id === id)?.status !== "draft")
      throw new Error("Можно удалить только черновик");
    writeDemo(items.filter((a) => a.id !== id));
  },
  resetDemo() {
    if (MODE !== "mock") throw new Error("Сброс доступен только в демо");
    return writeDemo(seedApplications());
  },
};
