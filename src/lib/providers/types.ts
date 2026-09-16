import type { DataSourceId, SourceFetchStatus } from "@/types/common";
import type { ResolvedCompanyQuery } from "@/lib/mock-data/generator";

/**
 * Контракт адаптера источника данных. Каждый провайдер (ФНС, ГИР БО,
 * КАД Арбитр, ФССП, ЕИС закупки, Федресурс, ЦБ РФ, веб-репутация) реализует
 * этот интерфейс независимо от остальных — бизнес-логика (risk-engine, UI)
 * никогда не обращается к конкретному провайдеру напрямую, только через
 * агрегатор (src/lib/providers/aggregate.ts). Это позволяет в будущем
 * заменить любой mock-адаптер на реальную интеграцию, не меняя остальной код.
 */
export interface ProviderResult<T> {
  source: DataSourceId;
  status: SourceFetchStatus;
  data: T | null;
  retrievedAt: string;
  latencyMs: number;
  errorMessage?: string;
}

export interface DataProviderAdapter<T> {
  id: DataSourceId;
  label: string;
  /**
   * Выполняет запрос к источнику. Обязан быть терпимым к отмене через
   * AbortSignal (см. withTimeout) и никогда не бросать необработанное
   * исключение наружу — ошибки должны отражаться в ProviderResult.status.
   */
  fetch(query: ResolvedCompanyQuery, signal: AbortSignal): Promise<ProviderResult<T>>;
}
