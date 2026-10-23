const event = (title, detail, at, actor = "Банк") => ({
  id: `${at}-${title}`,
  title,
  detail,
  at,
  actor,
});
const base = {
  company: {
    name: "ООО «Мануфактура»",
    inn: "5408123456",
    industry: "Производство и торговля",
    contact: "Александр Волков",
    email: "alex@manufactura.example",
    phone: "+7 913 000-12-34",
  },
  finances: { revenue: 28000000, expenses: 18500000, debt: 1200000, years: 5 },
  documents: [
    {
      id: "seed-1",
      name: "Выписка_за_6_месяцев.pdf",
      size: 245760,
      kind: "statement",
      uploadedAt: "2026-10-20T04:30:00Z",
      demo: true,
    },
    {
      id: "seed-2",
      name: "Финансовая_отчётность.pdf",
      size: 512000,
      kind: "report",
      uploadedAt: "2026-10-20T04:30:00Z",
      demo: true,
    },
  ],
  consent: true,
  history: [],
  messages: [],
  checks: null,
};
export function seedApplications() {
  return [
    {
      ...structuredClone(base),
      id: "PT-2026-0042",
      productId: "working",
      amount: 3200000,
      term: 24,
      purpose: "Закупка сырья для осенней коллекции",
      status: "needs_info",
      createdAt: "2026-10-20T04:30:00Z",
      updatedAt: "2026-10-22T03:15:00Z",
      request:
        "Пожалуйста, приложите расшифровку дебиторской задолженности на последнюю отчётную дату. Это поможет уточнить условия финансирования.",
      history: [
        event(
          "Заявка отправлена",
          "Документы получены, начали проверку.",
          "2026-10-20T04:30:00Z",
          "Александр Волков",
        ),
        event(
          "Проверки завершены",
          "Заявка передана кредитному специалисту.",
          "2026-10-21T04:00:00Z",
        ),
        event(
          "Нужны дополнительные сведения",
          "Запрошена расшифровка дебиторской задолженности.",
          "2026-10-22T03:15:00Z",
          "Елена Смирнова",
        ),
      ],
      checks: {
        score: 724,
        rating: "B",
        factors: [
          { label: "Бизнес работает 5 лет", positive: true },
          { label: "Положительный денежный поток", positive: true },
          { label: "Нужна расшифровка задолженности", positive: false },
        ],
        recommendation: "Запросить дополнительные сведения",
      },
    },
    {
      ...structuredClone(base),
      id: "PT-2026-0038",
      productId: "equipment",
      amount: 5000000,
      term: 36,
      purpose: "Покупка производственной линии",
      status: "approved",
      createdAt: "2026-10-18T05:00:00Z",
      updatedAt: "2026-10-21T07:30:00Z",
      offer: {
        amount: 5000000,
        term: 36,
        rate: 17.5,
        expiresAt: "2026-11-05T16:59:59Z",
      },
      history: [
        event(
          "Заявка отправлена",
          "Получили заявку на финансирование оборудования.",
          "2026-10-18T05:00:00Z",
          "Александр Волков",
        ),
        event(
          "Проверки завершены",
          "Сведения о компании и документы проверены.",
          "2026-10-19T06:00:00Z",
        ),
        event(
          "Финансирование одобрено",
          "Для вас подготовлено индивидуальное предложение.",
          "2026-10-21T07:30:00Z",
          "Елена Смирнова",
        ),
      ],
      checks: {
        score: 812,
        rating: "A",
        recommendation: "Одобрить",
        factors: [
          { label: "Стабильная выручка", positive: true },
          { label: "Низкая долговая нагрузка", positive: true },
          { label: "Положительная кредитная история", positive: true },
        ],
      },
    },
    {
      ...structuredClone(base),
      id: "PT-2026-0045",
      productId: "working",
      amount: 1800000,
      term: 12,
      purpose: "Расширение ассортимента",
      status: "manual_review",
      createdAt: "2026-10-21T05:00:00Z",
      updatedAt: "2026-10-22T02:00:00Z",
      history: [
        event(
          "Заявка отправлена",
          "Начали проверку данных.",
          "2026-10-21T05:00:00Z",
          "Александр Волков",
        ),
        event(
          "На рассмотрении у специалиста",
          "Проверки завершены. Готовим решение.",
          "2026-10-22T02:00:00Z",
        ),
      ],
      checks: {
        score: 768,
        rating: "A",
        recommendation: "Одобрить",
        factors: [
          { label: "Достаточная выручка", positive: true },
          { label: "Нет просроченных обязательств", positive: true },
          { label: "Действующая организация", positive: true },
        ],
      },
    },
    {
      ...structuredClone(base),
      id: "PT-2026-0046",
      productId: "working",
      amount: 850000,
      term: 12,
      purpose: "Закупка материалов",
      status: "draft",
      consent: false,
      documents: [],
      createdAt: "2026-10-22T03:45:00Z",
      updatedAt: "2026-10-22T03:45:00Z",
      history: [
        event(
          "Черновик создан",
          "Можно продолжить в любое время.",
          "2026-10-22T03:45:00Z",
          "Александр Волков",
        ),
      ],
    },
  ];
}
export const DEMO_CHECKS = {
  score: 768,
  rating: "A",
  recommendation: "Рассмотреть одобрение",
  factors: [
    { label: "Сведения о компании подтверждены", positive: true },
    { label: "Комплект документов получен", positive: true },
    { label: "Демонстрационная оценка риска", positive: true },
  ],
};
