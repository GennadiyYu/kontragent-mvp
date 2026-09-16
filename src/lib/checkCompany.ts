import type { CompanyDossier } from "@/types/dossier";
import { validateQuery } from "@/lib/utils/inn";
import { resolveCompanyQuery } from "@/lib/mock-data/resolveCompany";
import { aggregateDossierData } from "@/lib/providers/aggregate";
import { computeRiskAssessment } from "@/lib/risk-engine";
import { generateAiSummary } from "@/lib/ai";
import { getRepository } from "@/lib/repository";

export type CheckCompanyResult =
  | { ok: true; dossier: CompanyDossier }
  | { ok: false; error: string };

/**
 * Единая точка входа для проверки контрагента: используется и страницей
 * досье (server component), и POST /api/check. Оркестрирует: валидацию
 * ввода → опрос источников (провайдеры) → расчёт риска (risk-engine) →
 * AI-резюме (с fallback) → сборку CompanyDossier → запись в историю.
 * Недоступность отдельного источника не приводит к ошибке всей проверки —
 * это обеспечивается на уровне aggregateDossierData.
 */
export async function checkCompany(rawQuery: string): Promise<CheckCompanyResult> {
  const validation = validateQuery(rawQuery);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "Некорректный запрос" };
  }

  const resolved = resolveCompanyQuery(validation.normalized);
  const { sections, sources } = await aggregateDossierData(resolved);

  const riskAssessment = computeRiskAssessment(sections);

  const aiSummary = await generateAiSummary({
    company: sections.company,
    riskAssessment,
    finance: sections.finance,
    arbitration: sections.arbitration,
    enforcement: sections.enforcement,
    bankruptcy: sections.bankruptcy,
    procurement: sections.procurement,
    reputation: sections.reputation,
  }).catch(() => null); // AI не должен ронять всю проверку ни при каких обстоятельствах

  const dossier: CompanyDossier = {
    id: sections.company.inn,
    query: validation.normalized,
    generatedAt: new Date().toISOString(),
    ...sections,
    sources,
    riskAssessment,
    aiSummary,
    // Новая семантика статусов: "demo" означает ИМЕННО кураторскую демо-компанию
    // (либо намеренно не подключённый источник) — для реальных компаний ни
    // один провайдер больше не возвращает "demo" (см. providers/*.ts).
    isDemoData: sources.some((s) => s.status === "demo"),
  };

  // Запись в историю не должна блокировать ответ пользователю при сбое хранилища.
  try {
    await getRepository().history.add({
      id: `${dossier.id}-${Date.now()}`,
      query: dossier.query,
      companyName: dossier.company.shortName,
      inn: dossier.company.inn,
      riskScore: dossier.riskAssessment.totalScore,
      riskLevel: dossier.riskAssessment.level,
      checkedAt: dossier.generatedAt,
    });
  } catch (err) {
    console.warn("[checkCompany] не удалось записать историю проверки:", err);
  }

  return { ok: true, dossier };
}
