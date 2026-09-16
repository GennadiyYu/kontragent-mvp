import type { EventsInfo, SourceStatusSummary } from "@/types/dossier";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle } from "../ui";

const STATUS_STYLE: Record<SourceStatusSummary["status"], string> = {
  ok: "bg-emerald-100 text-emerald-700",
  demo: "bg-blue-100 text-blue-700",
  timeout: "bg-amber-100 text-amber-700",
  unavailable: "bg-red-100 text-red-700",
  not_applicable: "bg-slate-200 text-slate-600",
};

const STATUS_LABEL: Record<SourceStatusSummary["status"], string> = {
  ok: "Данные получены",
  demo: "Демо-данные",
  timeout: "Таймаут",
  unavailable: "Недоступен",
  not_applicable: "Неприменимо",
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
          В текущей демонстрационной версии все источники возвращают смоделированные данные. Устойчивость к сбоям
          источников (таймаут/недоступность) реализована на уровне агрегатора и не влияет на остальные разделы досье.
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
