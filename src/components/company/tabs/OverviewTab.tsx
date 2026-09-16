import type { CompanyDossier } from "@/types/dossier";
import RiskMatrix from "../RiskMatrix";
import DealAssessmentForm from "../DealAssessmentForm";
import { Card, SectionTitle } from "../ui";

export default function OverviewTab({ dossier }: { dossier: CompanyDossier }) {
  const { aiSummary, riskAssessment } = dossier;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle
          hint={aiSummary ? (aiSummary.generatedBy === "gemini" ? "сформировано ИИ (Gemini)" : "сформировано по шаблону") : undefined}
        >
          AI-резюме
        </SectionTitle>
        {aiSummary ? (
          <>
            <p className="text-sm leading-relaxed text-slate-700">{aiSummary.summaryText}</p>
            <p className="mt-3 text-xs text-slate-400">{aiSummary.disclaimer}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Резюме недоступно.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Ключевые положительные факторы</SectionTitle>
          {riskAssessment.positiveFactors.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {riskAssessment.positiveFactors.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Выраженных положительных факторов не выявлено.</p>
          )}
        </Card>

        <Card>
          <SectionTitle>Факторы риска</SectionTitle>
          {riskAssessment.riskFactors.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {riskAssessment.riskFactors.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 text-red-500">!</span>
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Существенных факторов риска не выявлено.</p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Рекомендация по сотрудничеству</SectionTitle>
        <p className="text-sm font-medium text-slate-800">{aiSummary?.recommendation}</p>
      </Card>

      <RiskMatrix categories={riskAssessment.categories} />

      <DealAssessmentForm query={dossier.query} />
    </div>
  );
}
