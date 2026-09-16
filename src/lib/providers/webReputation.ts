import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { ReputationInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface WebReputationData {
  reputation: ReputationInfo;
}

function emptyReputation(): ReputationInfo {
  return { mentions: [], negativeMentionsCount: 0, meta: { source: "WEB_REPUTATION", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" } };
}

/**
 * Адаптер репутационного фона по открытым источникам/СМИ.
 *
 * Это НЕ заблокированный источник (в отличие от KAD_ARBITR/FSSP/EIS_ZAKUPKI/
 * FEDRESURS/GIRBO) — технически бесплатные новостные/поисковые API
 * существуют, но по прямому решению задачи в этом MVP платный поисковый API
 * сознательно не подключается. Контракт DataProviderAdapter уже полностью
 * готов к подключению любого провайдера поиска — потребуется только
 * реализовать fetch() здесь, не меняя risk-engine и UI.
 *
 * ДЕМО-ДАННЫЕ используются ТОЛЬКО для кураторских демо-компаний — для
 * реальных компаний данные пусты, статус "unavailable" (UI: «Данные пока
 * недоступны»), а не выдуманные упоминания в СМИ.
 */
export const webReputationAdapter: DataProviderAdapter<WebReputationData> = {
  id: "WEB_REPUTATION",
  label: "Открытые источники / СМИ",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "WEB_REPUTATION");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");

    if (query.curated) {
      const core = buildCompanyCore(query);
      return {
        source: "WEB_REPUTATION",
        status: "demo",
        data: { reputation: core.reputation },
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    }

    return {
      source: "WEB_REPUTATION",
      status: "unavailable",
      data: { reputation: emptyReputation() },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: "Платный поисковый API сознательно не подключён в этом MVP (решение задачи)",
    };
  },
};
