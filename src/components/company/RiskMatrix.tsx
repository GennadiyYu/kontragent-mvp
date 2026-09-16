import type { RiskCategoryScore } from "@/types/dossier";
import { RISK_CATEGORY_LABEL } from "@/types/common";
import { RiskBadge } from "@/components/RiskBadge";
import { Card, SectionTitle } from "./ui";

export default function RiskMatrix({ categories }: { categories: RiskCategoryScore[] }) {
  return (
    <Card>
      <SectionTitle hint="8 категорий риска">Матрица рисков</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="pb-1 pl-1">Категория</th>
              <th className="pb-1">Уровень</th>
              <th className="pb-1">Выявленные факты</th>
              <th className="pb-1">Возможные последствия</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.category} className="align-top">
                <td className="rounded-l-lg bg-slate-50 py-3 pl-3 pr-2 font-medium text-slate-800 whitespace-nowrap">
                  {RISK_CATEGORY_LABEL[cat.category]}
                  <div className="text-xs font-normal text-slate-400">
                    {cat.score}/100 · вес {Math.round(cat.weight * 100)}%
                  </div>
                  <span
                    className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      cat.isReal ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {cat.isReal ? "реальные данные" : "не в оценке"}
                  </span>
                </td>
                <td className="bg-slate-50 py-3 pr-2">
                  <RiskBadge level={cat.level} size="sm" />
                </td>
                <td className="bg-slate-50 py-3 pr-2 text-slate-600">
                  <ul className="list-disc space-y-1 pl-4">
                    {cat.facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </td>
                <td className="rounded-r-lg bg-slate-50 py-3 pr-3 text-slate-600">
                  <ul className="list-disc space-y-1 pl-4">
                    {cat.consequences.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
