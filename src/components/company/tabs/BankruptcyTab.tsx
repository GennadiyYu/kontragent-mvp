import type { BankruptcyInfo } from "@/types/dossier";
import { formatDate } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle, SourceFootnote, emptyStateText } from "../ui";

export default function BankruptcyTab({ bankruptcy }: { bankruptcy: BankruptcyInfo }) {
  const isUnconfirmed = bankruptcy.meta.reliability === "unconfirmed";

  return (
    <Card>
      <SectionTitle>Банкротство</SectionTitle>

      {isUnconfirmed ? (
        <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
          Данные пока недоступны — проверка признаков банкротства не выполнялась
        </p>
      ) : bankruptcy.hasActiveCase ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          ⚠ Открыта процедура банкротства: {bankruptcy.stageLabel}
        </p>
      ) : (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          Активная процедура банкротства не выявлена
        </p>
      )}

      {bankruptcy.publications.length === 0 ? (
        <EmptyState>{emptyStateText(bankruptcy.meta.reliability, "Юридически значимые сообщения о банкротстве не найдены.")}</EmptyState>
      ) : (
        <div className="space-y-2">
          {bankruptcy.publications.map((p, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">{p.type}</p>
              <p className="mt-1 text-sm text-slate-600">{p.description}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDate(p.date)}</p>
            </div>
          ))}
        </div>
      )}

      <SourceFootnote label="Федресурс" url={bankruptcy.meta.sourceUrl} />
    </Card>
  );
}
