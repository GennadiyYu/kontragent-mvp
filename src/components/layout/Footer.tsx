export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-xs leading-relaxed text-slate-500">
          «Контрагент» — MVP сервиса проверки российских контрагентов. Все данные в текущей версии являются{" "}
          <strong className="text-slate-700">демонстрационными</strong> и сгенерированы автоматически: интеграция с
          реальными источниками (ФНС, ГИР БО, КАД Арбитр, ФССП, ЕИС закупки, Федресурс, ЦБ РФ) архитектурно
          предусмотрена, но не подключена. Сервис не является официальной справочной системой и не заменяет
          юридическую или финансовую экспертизу.
        </p>
      </div>
    </footer>
  );
}
