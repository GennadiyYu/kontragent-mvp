"use client";

import { useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Управляет переключением вкладок на клиенте. Содержимое всех вкладок
 * рендерится на сервере (передаётся как children-подобные элементы через
 * пропсы) — компонент лишь переключает видимость, без повторных запросов
 * данных при смене вкладки.
 */
export default function CompanyTabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              active === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-6">
        {tabs.map((tab) => (
          <div key={tab.id} hidden={tab.id !== active}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
