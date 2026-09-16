import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { BankruptcyInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface FedresursData {
  bankruptcy: BankruptcyInfo;
}

/**
 * Адаптер Федресурса (fedresurs.ru): банкротные процедуры и юридически
 * значимые сообщения. Демонстрационные данные — у Федресурса есть открытое
 * API, но для промышленного использования требуется соглашение и токен
 * доступа.
 */
export const fedresursAdapter: DataProviderAdapter<FedresursData> = {
  id: "FEDRESURS",
  label: "Федресурс — банкротство",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "FEDRESURS");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    return {
      source: "FEDRESURS",
      status: "demo",
      data: { bankruptcy: core.bankruptcy },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
