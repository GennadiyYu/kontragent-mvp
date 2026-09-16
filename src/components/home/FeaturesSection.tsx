const FEATURES = [
  {
    title: "Оценка риска 0–100",
    description: "Прозрачный расчёт по 8 категориям: финансы, суды, приставы, банкротство, закупки и другие.",
    icon: "📊",
  },
  {
    title: "Единое досье",
    description: "Реквизиты, руководство, связанные лица, финансы, суды, ФССП, банкротство и репутация в одном месте.",
    icon: "📁",
  },
  {
    title: "Объяснимость",
    description: "По каждому баллу видно, какие именно факты на него повлияли — без «чёрного ящика».",
    icon: "🔍",
  },
  {
    title: "Оценка сделки",
    description: "Рассчитайте риск конкретной сделки с учётом суммы, предоплаты и отсрочки платежа.",
    icon: "🤝",
  },
  {
    title: "PDF-досье",
    description: "Экспортируйте аналитический отчёт в PDF в формате службы безопасности.",
    icon: "📄",
  },
  {
    title: "Готовность к росту",
    description: "Архитектура рассчитана на подключение реальных источников: ФНС, ГИР БО, КАД Арбитр и др.",
    icon: "🧩",
  },
];

export default function FeaturesSection() {
  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-4 text-sm font-semibold text-slate-500">Что умеет сервис</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-2xl">{f.icon}</div>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">{f.title}</h3>
            <p className="text-sm leading-relaxed text-slate-500">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
