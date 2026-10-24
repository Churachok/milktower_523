export const STATUS = {
  draft: { label: "Черновик", tone: "neutral", step: 0 },
  submitted: { label: "На проверке", tone: "blue", step: 1 },
  manual_review: { label: "На рассмотрении", tone: "blue", step: 2 },
  needs_info: { label: "Нужны сведения", tone: "amber", step: 2 },
  approved: { label: "Одобрена", tone: "green", step: 3 },
  rejected: { label: "Отказ", tone: "red", step: 3 },
  issued: { label: "Средства получены", tone: "green", step: 4 },
};
export const TRANSITIONS = {
  draft: ["submitted"],
  submitted: ["manual_review"],
  manual_review: ["needs_info", "approved", "rejected"],
  needs_info: ["submitted"],
  approved: ["issued"],
  rejected: [],
  issued: [],
};
export const PRODUCTS = [
  {
    id: "working",
    name: "На оборотные средства",
    short: "Оборотные средства",
    description:
      "Закупка товаров и сырья, расчёты с поставщиками и текущие расходы.",
    min: 100000,
    max: 10000000,
    minTerm: 3,
    maxTerm: 36,
    rate: 19.5,
    icon: "rotate",
    tag: "Оборотный кредит",
  },
  {
    id: "equipment",
    name: "На оборудование",
    short: "Оборудование",
    description:
      "Покупка оборудования, обновление техники и расширение производства.",
    min: 500000,
    max: 15000000,
    minTerm: 6,
    maxTerm: 60,
    rate: 17.5,
    icon: "building",
    tag: "Инвестиционный кредит",
  },
];
export const productOf = (id) =>
  PRODUCTS.find((p) => p.id === id) || PRODUCTS[0];
export const money = (value, currency = true) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Number(value) || 0)}${currency ? " ₽" : ""}`;
export const date = (value, time = false) =>
  new Date(value).toLocaleString(
    "ru-RU",
    time
      ? {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Novosibirsk",
        }
      : {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Novosibirsk",
        },
  );
export function monthlyPayment(amount, months, rate) {
  if (!amount || !months) return 0;
  const r = rate / 1200;
  return r ? (amount * r) / (1 - (1 + r) ** -months) : amount / months;
}
export function validateLoanTerms(productId, amount, term) {
  const product = productOf(productId);
  const errors = {};
  if (
    !Number.isFinite(Number(amount)) ||
    Number(amount) < product.min ||
    Number(amount) > product.max
  )
    errors.amount = `От ${money(product.min)} до ${money(product.max)}`;
  if (
    !Number.isInteger(Number(term)) ||
    Number(term) < product.minTerm ||
    Number(term) > product.maxTerm
  )
    errors.term = `От ${product.minTerm} до ${product.maxTerm} месяцев`;
  return errors;
}
export function calculateLoan(productId, amount, term) {
  if (Object.keys(validateLoanTerms(productId, amount, term)).length)
    return null;
  const rate = productOf(productId).rate;
  const payment = monthlyPayment(Number(amount), Number(term), rate);
  return {
    amount: Number(amount),
    term: Number(term),
    rate,
    monthlyPayment: payment,
    totalPayment: payment * Number(term),
    overpayment: payment * Number(term) - Number(amount),
  };
}
export function compareOffer(app) {
  const saved = app.calculation;
  const hasSnapshot =
    saved &&
    Number(saved.amount) === Number(app.amount) &&
    Number(saved.term) === Number(app.term) &&
    Number.isFinite(Number(saved.rate)) &&
    Number(saved.rate) > 0 &&
    Number(saved.rate) <= 100;
  const rate = hasSnapshot ? Number(saved.rate) : productOf(app.productId).rate;
  const requested = {
    amount: Number(app.amount),
    term: Number(app.term),
    rate,
    monthlyPayment: monthlyPayment(Number(app.amount), Number(app.term), rate),
  };
  const offered = {
    amount: Number(app.offer.amount),
    term: Number(app.offer.term),
    rate: Number(app.offer.rate),
    monthlyPayment: monthlyPayment(
      Number(app.offer.amount),
      Number(app.offer.term),
      Number(app.offer.rate),
    ),
  };
  return {
    requested,
    offered,
    hasSnapshot: Boolean(hasSnapshot),
    changed:
      requested.amount !== offered.amount ||
      requested.term !== offered.term ||
      requested.rate !== offered.rate,
  };
}
export function validateStep(app, step) {
  const errors = {};
  if (step === 0) {
    if (!app.company.name.trim())
      errors["company.name"] = "Укажите название компании";
    if (!/^\d{10}$|^\d{12}$/.test(app.company.inn))
      errors["company.inn"] = "ИНН должен содержать 10 или 12 цифр";
    if (!app.company.contact.trim())
      errors["company.contact"] = "Укажите контактное лицо";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.company.email))
      errors["company.email"] = "Укажите корректную почту";
    if (app.company.phone.replace(/\D/g, "").length !== 11)
      errors["company.phone"] = "Укажите телефон из 11 цифр";
  }
  if (step === 1) {
    Object.assign(
      errors,
      validateLoanTerms(app.productId, app.amount, app.term),
    );
    if (!app.purpose.trim())
      errors.purpose = "Расскажите, на что нужны средства";
  }
  if (step === 2) {
    for (const key of ["revenue", "expenses", "debt"]) {
      if (
        app.finances[key] === "" ||
        !Number.isFinite(Number(app.finances[key])) ||
        Number(app.finances[key]) < 0
      )
        errors[`finances.${key}`] = "Укажите сумму от 0 ₽";
    }
    if (Number(app.finances.revenue) === 0)
      errors["finances.revenue"] = "Выручка должна быть больше 0 ₽";
    if (!Number.isFinite(Number(app.finances.years)) || Number(app.finances.years) < 1 || Number(app.finances.years) > 100)
      errors["finances.years"] = "Укажите срок работы бизнеса от 1 до 100 лет";
  }
  if (step === 3) {
    if (!app.documents.some((d) => d.kind === "statement"))
      errors.documents = "Добавьте выписку по расчётному счёту";
    if (!app.documents.some((d) => d.kind === "report"))
      errors.documents = "Нужны выписка и финансовая отчётность";
  }
  if (step === 4 && !app.consent)
    errors.consent = "Подтвердите согласие перед отправкой";
  return errors;
}
export function assertTransition(app, next, role) {
  if (!["client", "employee"].includes(role))
    throw new Error("Неизвестная роль");
  if (!TRANSITIONS[app.status]?.includes(next))
    throw new Error("Этот переход статуса недоступен. Обновите заявку.");
  const clientTransitions = {
    draft: "submitted",
    needs_info: "submitted",
    approved: "issued",
  };
  if (
    (role === "client" && clientTransitions[app.status] !== next) ||
    (role === "employee" && clientTransitions[app.status] === next)
  )
    throw new Error("Действие недоступно для текущей роли");
  if (next === "submitted" && app.status === "draft") {
    const errors = Object.assign(
      {},
      ...[0, 1, 2, 3, 4].map((s) => validateStep(app, s)),
    );
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  }
}
