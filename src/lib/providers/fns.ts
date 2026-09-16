import { buildCompanyCore } from "@/lib/mock-data/generator";
import type {
  CompanyIdentity,
  ManagementInfo,
  OwnersInfo,
  RegistryFlags,
  RelatedCompaniesInfo,
} from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface FnsData {
  company: CompanyIdentity;
  identity: RegistryFlags;
  management: ManagementInfo;
  owners: OwnersInfo;
  relatedCompanies: RelatedCompaniesInfo;
}

/**
 * Адаптер ФНС России (ЕГРЮЛ): регистрационные данные, руководство,
 * учредители, связанные организации. Реальная интеграция потребует
 * подключения к API ФНС (например, через сервис «Прозрачный бизнес»/
 * коммерческого партнёра) — до тех пор возвращает демонстрационные данные,
 * помеченные reliability: "demo".
 */
export const fnsAdapter: DataProviderAdapter<FnsData> = {
  id: "FNS",
  label: "ФНС России — ЕГРЮЛ",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "FNS");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    return {
      source: "FNS",
      status: "demo",
      data: {
        company: core.company,
        identity: core.identity,
        management: core.management,
        owners: core.owners,
        relatedCompanies: core.relatedCompanies,
      },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
