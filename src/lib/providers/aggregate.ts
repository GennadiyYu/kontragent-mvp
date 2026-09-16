import type { CompanyDossier, EventsInfo, SourceStatusSummary, TimelineEvent } from "@/types/dossier";
import type { ResolvedCompanyQuery } from "@/lib/mock-data/generator";
import { withTimeout } from "./withTimeout";
import { fnsAdapter } from "./fns";
import { girboAdapter } from "./girbo";
import { kadArbitrAdapter } from "./kadArbitr";
import { fsspAdapter } from "./fssp";
import { eisZakupkiAdapter } from "./eisZakupki";
import { fedresursAdapter } from "./fedresurs";
import { cbrAdapter } from "./cbr";
import { webReputationAdapter } from "./webReputation";
import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { DataProviderAdapter, ProviderResult } from "./types";

const SOURCE_TIMEOUT_MS = 6000;

/**
 * Опрашивает один источник через withTimeout и всегда возвращает
 * ProviderResult — даже при таймауте/ошибке (тогда status "timeout" или
 * "unavailable", data: null). Это ключевой механизм устойчивости: сбой
 * одного источника не прерывает сбор досье в целом.
 */
async function fetchSource<T>(
  adapter: DataProviderAdapter<T>,
  query: ResolvedCompanyQuery
): Promise<ProviderResult<T>> {
  const result = await withTimeout((signal) => adapter.fetch(query, signal), SOURCE_TIMEOUT_MS);
  if (result.ok && result.value) return result.value;
  return {
    source: adapter.id,
    status: result.timedOut ? "timeout" : "unavailable",
    data: null,
    retrievedAt: new Date().toISOString(),
    latencyMs: result.latencyMs,
    errorMessage: result.error,
  };
}

function buildEventsTimeline(dossier: Pick<CompanyDossier,
  "company" | "management" | "bankruptcy" | "arbitration" | "reputation"
>): EventsInfo {
  const timeline: TimelineEvent[] = [];

  timeline.push({
    date: dossier.company.registrationDate,
    type: "Регистрация",
    description: `Организация зарегистрирована в форме «${dossier.company.legalForm}»`,
    meta: dossier.company.meta,
  });

  if (dossier.management.director.appointedDate) {
    timeline.push({
      date: dossier.management.director.appointedDate,
      type: "Назначение руководителя",
      description: `Назначен генеральный директор: ${dossier.management.director.fullName}`,
      meta: dossier.management.director.meta,
    });
  }

  if (dossier.company.liquidationDate) {
    timeline.push({
      date: dossier.company.liquidationDate,
      type: "Ликвидация",
      description: "Внесена запись о начале процедуры ликвидации",
      meta: dossier.company.meta,
    });
  }

  for (const pub of dossier.bankruptcy.publications) {
    timeline.push({ date: pub.date, type: pub.type, description: pub.description, meta: pub.meta });
  }

  const majorCases = [...dossier.arbitration.cases].sort((a, b) => b.claimAmount - a.claimAmount).slice(0, 3);
  for (const c of majorCases) {
    timeline.push({
      date: c.date,
      type: "Судебный спор",
      description: `${c.roleLabel} по делу № ${c.caseNumber}: ${c.subject}`,
      meta: c.meta,
    });
  }

  for (const mention of dossier.reputation.mentions.filter((m) => m.sentiment === "negative")) {
    timeline.push({ date: mention.date, type: "Упоминание в СМИ", description: mention.title, meta: mention.meta });
  }

  timeline.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { timeline };
}

export interface AggregatedDossierData {
  sections: Pick<
    CompanyDossier,
    | "company"
    | "identity"
    | "management"
    | "owners"
    | "relatedCompanies"
    | "finance"
    | "arbitration"
    | "enforcement"
    | "bankruptcy"
    | "procurement"
    | "licenses"
    | "reputation"
    | "events"
  >;
  sources: SourceStatusSummary[];
}

/**
 * Опрашивает все источники параллельно и собирает секции досье. Не зависит
 * от risk-engine или AI — чистая агрегация фактов. Использует единый
 * "seed"-профиль (resolveCompanyQuery) для внутренней согласованности
 * демо-данных между источниками — в реальной интеграции каждый провайдер
 * обращался бы к своему API независимо.
 */
export async function aggregateDossierData(query: ResolvedCompanyQuery): Promise<AggregatedDossierData> {
  const [fns, girbo, kadArbitr, fssp, eisZakupki, fedresurs, cbr, webReputation] = await Promise.all([
    fetchSource(fnsAdapter, query),
    fetchSource(girboAdapter, query),
    fetchSource(kadArbitrAdapter, query),
    fetchSource(fsspAdapter, query),
    fetchSource(eisZakupkiAdapter, query),
    fetchSource(fedresursAdapter, query),
    fetchSource(cbrAdapter, query),
    fetchSource(webReputationAdapter, query),
  ]);

  // Резервный фолбэк: если ФНС (ключевой источник установочных данных) не
  // ответил, используем «сырое» ядро профиля напрямую, чтобы страница не
  // осталась без базовых сведений о компании.
  const fallbackCore = fns.data ? null : buildCompanyCore(query);

  const sections: AggregatedDossierData["sections"] = {
    company: fns.data?.company ?? fallbackCore!.company,
    identity: fns.data?.identity ?? fallbackCore!.identity,
    management: fns.data?.management ?? fallbackCore!.management,
    owners: fns.data?.owners ?? fallbackCore!.owners,
    relatedCompanies: fns.data?.relatedCompanies ?? fallbackCore!.relatedCompanies,
    finance: girbo.data?.finance ?? { years: [], trend: "unknown", meta: { source: "GIRBO", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" } },
    arbitration: kadArbitr.data?.arbitration ?? {
      cases: [],
      totalCasesAsDefendant: 0,
      totalCasesAsPlaintiff: 0,
      totalClaimAmountAsDefendant: 0,
      meta: { source: "KAD_ARBITR", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" },
    },
    enforcement: fssp.data?.enforcement ?? {
      proceedings: [],
      activeCount: 0,
      activeAmount: 0,
      meta: { source: "FSSP", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" },
    },
    bankruptcy: fedresurs.data?.bankruptcy ?? {
      hasActiveCase: false,
      publications: [],
      meta: { source: "FEDRESURS", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" },
    },
    procurement: eisZakupki.data?.procurement ?? {
      asSupplierContractsCount: 0,
      asSupplierTotalAmount: 0,
      isInUnreliableSuppliersRegistry: false,
      contracts: [],
      meta: { source: "EIS_ZAKUPKI", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" },
    },
    licenses: cbr.data?.licenses ?? { items: [], warningListEntry: null, meta: { source: "CBR", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" } },
    reputation: webReputation.data?.reputation ?? {
      mentions: [],
      negativeMentionsCount: 0,
      meta: { source: "WEB_REPUTATION", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" },
    },
    events: { timeline: [] },
  };

  sections.events = buildEventsTimeline(sections);

  const providerLabels: Record<string, string> = {
    FNS: fnsAdapter.label,
    GIRBO: girboAdapter.label,
    KAD_ARBITR: kadArbitrAdapter.label,
    FSSP: fsspAdapter.label,
    EIS_ZAKUPKI: eisZakupkiAdapter.label,
    FEDRESURS: fedresursAdapter.label,
    CBR: cbrAdapter.label,
    WEB_REPUTATION: webReputationAdapter.label,
  };

  const noteByStatus: Record<string, string> = {
    ok: "Данные получены",
    demo: "Демонстрационные данные (интеграция с реальным источником — решение продукта, см. README)",
    blocked: "Реальный бесплатный автоматический доступ подтверждённо недоступен (см. вкладку «Источники»)",
    timeout: "Источник не ответил вовремя — раздел построен по доступным данным",
    unavailable: "Источник временно недоступен",
    not_applicable: "Неприменимо к виду деятельности компании",
  };

  const results = [fns, girbo, kadArbitr, fssp, eisZakupki, fedresurs, cbr, webReputation];
  const sources: SourceStatusSummary[] = results.map((r) => ({
    source: r.source,
    label: providerLabels[r.source],
    status: r.status,
    retrievedAt: r.retrievedAt,
    latencyMs: r.latencyMs,
    note: r.errorMessage ?? noteByStatus[r.status],
  }));

  return { sections, sources };
}
