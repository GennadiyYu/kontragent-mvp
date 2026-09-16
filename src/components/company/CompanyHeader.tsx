import type { CompanyDossier } from "@/types/dossier";
import { formatDate } from "@/lib/utils/format";
import RiskScoreCard from "./RiskScoreCard";
import PdfDownloadButton from "./PdfDownloadButton";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  liquidating: "bg-amber-100 text-amber-700",
  liquidated: "bg-slate-200 text-slate-700",
  bankrupt: "bg-red-100 text-red-700",
  reorganizing: "bg-amber-100 text-amber-700",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export default function CompanyHeader({ dossier }: { dossier: CompanyDossier }) {
  const { company, management } = dossier;
  const fnsSource = dossier.sources.find((s) => s.source === "FNS");
  const isFnsReal = fnsSource?.status === "ok";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
        <p className="text-xs text-amber-800">
          {isFnsReal ? (
            <>
              <strong>Установочные данные реальны</strong> (ЕГРЮЛ, через DaData). Остальные разделы —
              финансы, суды, ФССП, банкротство, закупки, репутация — пока демонстрационные. Подробный статус
              каждого источника — на вкладке «Источники».
            </>
          ) : (
            <>
              <strong>Демонстрационные данные.</strong> Реальная интеграция с источниками (ФНС, ГИР БО, КАД Арбитр,
              ФССП и др.) в этой версии не подключена — см. вкладку «Источники».
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{company.fullName}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[company.status]}`}>
              {company.statusLabel}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="ИНН" value={company.inn} />
            <Field label="ОГРН" value={company.ogrn} />
            <Field label="Дата регистрации" value={formatDate(company.registrationDate)} />
            <Field label="Основной ОКВЭД" value={`${company.okvedCode} — ${company.okvedName}`} />
            <Field label="Директор" value={management.director.fullName} />
            <Field label="Юридический адрес" value={company.legalAddress} />
          </dl>

          <div className="mt-5">
            <PdfDownloadButton query={dossier.query} fileHint={company.inn} />
          </div>
        </div>

        <RiskScoreCard score={dossier.riskAssessment.totalScore} level={dossier.riskAssessment.level} />
      </div>
    </div>
  );
}
