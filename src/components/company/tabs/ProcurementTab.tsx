import type { ProcurementInfo } from "@/types/dossier";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle, SourceFootnote, Stat } from "../ui";

const STATUS_COLOR: Record<string, string> = {
  executed: "bg-emerald-100 text-emerald-700",
  active: "bg-amber-100 text-amber-700",
  terminated: "bg-red-100 text-red-700",
};

export default function ProcurementTab({ procurement }: { procurement: ProcurementInfo }) {
  return (
    <Card>
      <SectionTitle>Государственные закупки</SectionTitle>

      {procurement.isInUnreliableSuppliersRegistry && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
          ⚠ Компания включена в реестр недобросовестных поставщиков (РНП)
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Контрактов (поставщик)" value={String(procurement.asSupplierContractsCount)} />
        <Stat label="Сумма контрактов" value={formatMoney(procurement.asSupplierTotalAmount)} />
        <Stat label="В РНП" value={procurement.isInUnreliableSuppliersRegistry ? "Да" : "Нет"} />
      </div>

      {procurement.contracts.length === 0 ? (
        <EmptyState>Контракты не найдены.</EmptyState>
      ) : (
        <div className="space-y-2">
          {procurement.contracts.map((c) => (
            <div key={c.number} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">№ {c.number}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>{c.statusLabel}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{c.subject}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(c.date)} · {c.customerOrSupplier} · сумма: {formatMoney(c.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      <SourceFootnote label="ЕИС закупки (zakupki.gov.ru)" url={procurement.meta.sourceUrl} />
    </Card>
  );
}
