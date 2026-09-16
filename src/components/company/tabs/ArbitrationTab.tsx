import type { ArbitrationInfo } from "@/types/dossier";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle, SourceFootnote, Stat } from "../ui";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  satisfied: "bg-red-100 text-red-700",
  settled: "bg-slate-200 text-slate-700",
  dismissed: "bg-emerald-100 text-emerald-700",
};

export default function ArbitrationTab({ arbitration }: { arbitration: ArbitrationInfo }) {
  return (
    <Card>
      <SectionTitle>Судебные споры (арбитраж)</SectionTitle>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Дел в роли ответчика" value={String(arbitration.totalCasesAsDefendant)} />
        <Stat label="Дел в роли истца" value={String(arbitration.totalCasesAsPlaintiff)} />
        <Stat label="Сумма исков (ответчик)" value={formatMoney(arbitration.totalClaimAmountAsDefendant)} />
      </div>

      {arbitration.cases.length === 0 ? (
        <EmptyState>Судебные споры с участием компании не найдены.</EmptyState>
      ) : (
        <div className="space-y-2">
          {arbitration.cases.map((c) => (
            <div key={c.caseNumber} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">№ {c.caseNumber}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>{c.statusLabel}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{c.subject}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(c.date)} · роль: {c.roleLabel} · контрагент по делу: {c.counterparty} · сумма: {formatMoney(c.claimAmount)}
              </p>
            </div>
          ))}
        </div>
      )}

      <SourceFootnote label="Картотека арбитражных дел (КАД Арбитр)" url={arbitration.meta.sourceUrl} />
    </Card>
  );
}
