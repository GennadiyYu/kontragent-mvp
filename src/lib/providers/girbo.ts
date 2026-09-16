import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { FinanceInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface GirboData {
  finance: FinanceInfo;
}

/**
 * Адаптер ГИР БО (Государственный информационный ресурс бухгалтерской
 * отчётности ФНС): выручка, прибыль, активы, капитал за последние периоды.
 *
 * ИССЛЕДОВАНО (см. README): у ФНС ДЕЙСТВИТЕЛЬНО есть официальные открытые
 * данные бухотчётности (nalog.gov.ru/opendata, набор «Сведения о суммах
 * доходов и расходов…», XML) — легальный источник, но это сплошной
 * общероссийский годовой массив без адресного API «по ИНН», требующий
 * ETL/БД для по-запросной выдачи (вне рамок MVP без внешней БД). Сам
 * веб-поиск bo.nalog.ru при проверке не отвечал на автоматические запросы
 * (таймаут — сетевая защита от ботов). Источник помечен "blocked".
 */
export const girboAdapter: DataProviderAdapter<GirboData> = {
  id: "GIRBO",
  label: "ГИР БО ФНС — бухгалтерская отчётность",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "GIRBO");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    return {
      source: "GIRBO",
      status: "blocked",
      data: { finance: core.finance },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: "bo.nalog.ru не отвечает на автоматические запросы; открытые данные ФНС — сплошной массив без адресного API по ИНН",
    };
  },
};
