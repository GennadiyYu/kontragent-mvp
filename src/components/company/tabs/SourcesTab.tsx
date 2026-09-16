import type { EventsInfo, SourceStatusSummary } from "@/types/dossier";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle } from "../ui";

const STATUS_STYLE: Record<SourceStatusSummary["status"], string> = {
  real_found: "bg-emerald-100 text-emerald-700",
  real_not_found: "bg-teal-100 text-teal-700",
  partial: "bg-teal-100 text-teal-700",
  stale: "bg-amber-100 text-amber-700",
  unavailable: "bg-slate-200 text-slate-600",
  demo: "bg-blue-100 text-blue-700",
};

const STATUS_LABEL: Record<SourceStatusSummary["status"], string> = {
  real_found: "Найдено (реально)",
  real_not_found: "Проверено, не найдено",
  partial: "Реально, но неполно",
  stale: "Реально, но устарело",
  unavailable: "Недоступно",
  demo: "Демо-данные",
};

export default function SourcesTab({ sources, events }: { sources: SourceStatusSummary[]; events: EventsInfo }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle hint="каждый факт в досье снабжён ссылкой на источник">Статус источников данных</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sources.map((s) => (
            <div key={s.source} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{s.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{s.note}</p>
                <p className="mt-0.5 text-xs text-slate-400">Получено: {formatDateTime(s.retrievedAt)}{s.latencyMs ? ` · ${s.latencyMs} мс` : ""}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          «Проверено, не найдено» означает ТОЛЬКО, что записи по этому ИНН нет в проверенном официальном наборе —
          это не то же самое, что «нарушений/задолженности/банкротства нет». «Недоступно» — бесплатная
          автоматическая проверка технически невозможна (CAPTCHA/сетевая защита/нужен договор — см. README,
          «Исследование источников») или источник сознательно не подключён (веб-репутация) — в обоих случаях
          данные не показываются вообще, а не заменяются демонстрационными. «Демо-данные» — только у кураторских
          демо-компаний на главной странице. Устойчивость к сбоям источников реализована на уровне агрегатора и не
          влияет на остальные разделы досье.
        </p>
      </Card>

      <Card>
        <SectionTitle>Хронология событий</SectionTitle>
        {events.timeline.length === 0 ? (
          <EmptyState>Значимые события не найдены.</EmptyState>
        ) : (
          <ol className="space-y-3 border-l border-slate-200 pl-4">
            {events.timeline.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                <p className="text-xs text-slate-400">{formatDate(e.date)} · {e.type}</p>
                <p className="text-sm text-slate-700">{e.description}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
