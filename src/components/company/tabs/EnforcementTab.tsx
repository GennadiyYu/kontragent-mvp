import type { EnforcementInfo } from "@/types/dossier";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle, SourceFootnote, Stat } from "../ui";

export default function EnforcementTab({ enforcement }: { enforcement: EnforcementInfo }) {
  return (
    <Card>
      <SectionTitle>Исполнительные производства (ФССП)</SectionTitle>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Действующих производств" value={String(enforcement.activeCount)} />
        <Stat label="Сумма по действующим" value={formatMoney(enforcement.activeAmount)} />
        <Stat label="Всего производств" value={String(enforcement.proceedings.length)} />
      </div>

      {enforcement.proceedings.length === 0 ? (
        <EmptyState>Исполнительные производства не найдены.</EmptyState>
      ) : (
        <div className="space-y-2">
          {enforcement.proceedings.map((p) => (
            <div key={p.number} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">№ {p.number}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "active" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {p.statusLabel}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{p.subject}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(p.date)} · {p.bailiffOffice} · сумма: {formatMoney(p.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      <SourceFootnote label="ФССП России" url={enforcement.meta.sourceUrl} />
    </Card>
  );
}
