import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { ProcurementInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface EisZakupkiData {
  procurement: ProcurementInfo;
}

/**
 * Адаптер ЕИС в сфере закупок (zakupki.gov.ru): контракты по 44-ФЗ/223-ФЗ
 * и наличие в реестре недобросовестных поставщиков (РНП).
 *
 * ИССЛЕДОВАНО (см. README): у ЕИС ДЕЙСТВИТЕЛЬНО есть официальные открытые
 * данные (сплошные общероссийские XML-выгрузки контрактов/реестров через
 * FTP/HTTP, без ключа) — это легальный путь, а не тупик. Но (1) и веб-портал,
 * и FTP-сервер не отвечали на автоматические запросы при проверке (таймаут —
 * сетевая защита), и (2) даже при доступности это не точечный API «контракты
 * одной компании», а массив на десятки ГБ, требующий ETL/БД для по-запросной
 * выдачи — вне рамок текущего MVP без внешней БД. Источник помечен "blocked".
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
      status: "blocked",
      data: { procurement: core.procurement },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: "Открытые данные ЕИС — сплошной общероссийский XML-массив без адресного API; портал и FTP не отвечали на запросы при проверке",
    };
  },
};
