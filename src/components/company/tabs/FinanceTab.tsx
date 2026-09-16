import type { FinanceInfo } from "@/types/dossier";
import { formatMoney } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle, SourceFootnote, Stat } from "../ui";

const TREND_LABEL: Record<FinanceInfo["trend"], string> = {
  growth: "Рост",
  decline: "Снижение",
  stagnation: "Стагнация",
  unknown: "Недостаточно данных",
};

const TREND_COLOR: Record<FinanceInfo["trend"], string> = {
  growth: "text-emerald-600",
  decline: "text-red-600",
  stagnation: "text-amber-600",
  unknown: "text-slate-500",
};

export default function FinanceTab({ finance }: { finance: FinanceInfo }) {
  if (finance.years.length === 0) {
    return (
      <Card>
        <SectionTitle>Финансы</SectionTitle>
        <EmptyState>Данные бухгалтерской отчётности не найдены.</EmptyState>
      </Card>
    );
  }

  const last = finance.years[0];

  return (
    <Card>
      <SectionTitle hint={`тренд: ${TREND_LABEL[finance.trend]}`}>Финансовое состояние</SectionTitle>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`Выручка, ${last.year}`} value={formatMoney(last.revenue)} />
        <Stat
          label={last.isNetProfitEstimated ? "Прибыль/убыток (оценка)" : "Чистая прибыль/убыток"}
          value={formatMoney(last.netProfit)}
          sub={last.isNetProfitEstimated ? "расчёт: выручка − расходы, не строка формы 2" : last.netProfit >= 0 ? "прибыль" : "убыток"}
        />
        <Stat label="Активы" value={formatMoney(last.assets)} />
        <Stat label="Капитал и резервы" value={formatMoney(last.capital)} sub={typeof last.capital === "number" && last.capital < 0 ? "отрицательные чистые активы" : undefined} />
      </div>

      {typeof last.assets !== "number" && (
        <p className="mb-3 text-xs text-slate-400">
          Активы, капитал и кредиторская задолженность недоступны: бесплатных официальных открытых данных с полным
          балансом (форма 1) не существует — см. вкладку «Источники». Выручка и прибыль — реальные данные ФНС.
        </p>
      )}

      <p className={`mb-3 text-sm font-medium ${TREND_COLOR[finance.trend]}`}>Динамика: {TREND_LABEL[finance.trend]}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="py-2">Год</th>
              <th className="py-2">Выручка</th>
              <th className="py-2">Чистая прибыль</th>
              <th className="py-2">Активы</th>
              <th className="py-2">Капитал</th>
              <th className="py-2">Кредит. задолженность</th>
            </tr>
          </thead>
          <tbody>
            {finance.years.map((y) => (
              <tr key={y.year} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-800">{y.year}</td>
                <td className="py-2 text-slate-600">{formatMoney(y.revenue)}</td>
                <td className={`py-2 ${y.netProfit < 0 ? "text-red-600" : "text-slate-600"}`}>{formatMoney(y.netProfit)}</td>
                <td className="py-2 text-slate-600">{formatMoney(y.assets)}</td>
                <td className={`py-2 ${typeof y.capital === "number" && y.capital < 0 ? "text-red-600" : "text-slate-600"}`}>{formatMoney(y.capital)}</td>
                <td className="py-2 text-slate-600">{formatMoney(y.accountsPayable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SourceFootnote label="ГИР БО ФНС" url={finance.meta.sourceUrl} />
    </Card>
  );
}
