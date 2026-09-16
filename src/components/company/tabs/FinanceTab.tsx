import type { FinanceInfo, RegistryFlags } from "@/types/dossier";
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

const RESULT_TOOLTIP = "Рассчитано сервисом как доходы минус расходы. Не является официальным показателем чистой прибыли.";

export default function FinanceTab({ finance, identity }: { finance: FinanceInfo; identity: RegistryFlags }) {
  const isConfirmed = finance.meta.reliability !== "unconfirmed"; // "unconfirmed" — реальный источник не проверялся/недоступен (см. providers/girbo.ts)

  if (finance.years.length === 0) {
    return (
      <Card>
        <SectionTitle>Финансы</SectionTitle>
        <EmptyState>
          {isConfirmed
            ? "Данные бухгалтерской отчётности не найдены."
            : "Данные пока недоступны — проверка по этому разделу не выполнялась или источник временно недоступен."}
        </EmptyState>
        <TaxAndScaleFacts identity={identity} />
      </Card>
    );
  }

  const last = finance.years[0];
  const isEstimated = Boolean(last.isNetProfitEstimated);

  return (
    <Card>
      <SectionTitle hint={`тренд: ${TREND_LABEL[finance.trend]}`}>Финансовое состояние</SectionTitle>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={isEstimated ? `Доходы, ${last.year}` : `Выручка, ${last.year}`} value={formatMoney(last.revenue)} />
        <Stat
          label={isEstimated ? "Расчётный финансовый результат" : "Чистая прибыль/убыток"}
          value={formatMoney(last.netProfit)}
          sub={isEstimated ? undefined : last.netProfit >= 0 ? "прибыль" : "убыток"}
          tooltip={isEstimated ? RESULT_TOOLTIP : undefined}
        />
        <Stat label="Активы" value={formatMoney(last.assets)} />
        <Stat label="Капитал и резервы" value={formatMoney(last.capital)} sub={typeof last.capital === "number" && last.capital < 0 ? "отрицательные чистые активы" : undefined} />
      </div>

      {typeof last.assets !== "number" && (
        <p className="mb-3 text-xs text-slate-400">
          Активы, капитал и кредиторская задолженность недоступны: бесплатных официальных открытых данных с полным
          балансом (форма 1) не существует — см. вкладку «Источники». Доходы/расходы — официальный набор данных ФНС
          «Сведения о суммах доходов и расходов» (не путать с полной бухгалтерской отчётностью).
        </p>
      )}

      <p className={`mb-3 text-sm font-medium ${TREND_COLOR[finance.trend]}`}>Динамика: {TREND_LABEL[finance.trend]}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="py-2">Год</th>
              <th className="py-2">{isEstimated ? "Доходы" : "Выручка"}</th>
              <th className="py-2">{isEstimated ? "Расч. результат" : "Чистая прибыль"}</th>
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

      <SourceFootnote label={isEstimated ? "ФНС — открытые данные" : "ГИР БО ФНС"} url={finance.meta.sourceUrl} />

      <TaxAndScaleFacts identity={identity} />
    </Card>
  );
}

/** Уплаченные налоги и численность — показатели МАСШТАБА деятельности, не индикаторы риска (см. risk-engine/rules.ts). */
function TaxAndScaleFacts({ identity }: { identity: RegistryFlags }) {
  const hasTaxPaid = identity.taxPaidAmount !== undefined;
  const hasEmployees = identity.employeesCount !== undefined;
  if (!hasTaxPaid && !hasEmployees) return null;

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <SectionTitle hint="показатели масштаба, не индикаторы риска">Налоги и штат (ФНС)</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {hasTaxPaid && (
          <Stat
            label={`Уплачено налогов${identity.taxPaidPeriodYear ? `, ${identity.taxPaidPeriodYear}` : ""}`}
            value={identity.taxPaidAmount === null ? "нет данных" : formatMoney(identity.taxPaidAmount)}
            sub={identity.taxPaidAmount === null ? "не найдено в проверенном наборе ФНС" : "показатель масштаба, не риска"}
          />
        )}
        {hasEmployees && (
          <Stat
            label={`Численность${identity.employeesPeriodYear ? `, ${identity.employeesPeriodYear}` : ""}`}
            value={identity.employeesCount === null ? "нет данных" : `${identity.employeesCount} чел.`}
            sub={identity.employeesCount === null ? "не найдено в проверенном наборе ФНС" : "малая численность — не негативный признак"}
          />
        )}
      </div>
      <SourceFootnote label="ФНС — открытые данные (paytax/sshr)" />
    </div>
  );
}
