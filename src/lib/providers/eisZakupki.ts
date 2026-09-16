import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { ProcurementInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface EisZakupkiData {
  procurement: ProcurementInfo;
}

/**
 * Адаптер ЕИС в сфере закупок (zakupki.gov.ru): контракты по 44-ФЗ/223-ФЗ
 * и наличие в реестре недобросовестных поставщиков (РНП). Демонстрационные
 * данные — у ЕИС есть открытый набор данных и веб-сервисы, интеграция
 * требует регистрации организации-пользователя и SOAP/REST-клиента.
 */
export const eisZakupkiAdapter: DataProviderAdapter<EisZakupkiData> = {
  id: "EIS_ZAKUPKI",
  label: "ЕИС закупки (zakupki.gov.ru)",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "EIS_ZAKUPKI");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    return {
      source: "EIS_ZAKUPKI",
      status: "demo",
      data: { procurement: core.procurement },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
