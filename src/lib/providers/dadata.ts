/**
 * Тонкий клиент DaData (https://dadata.ru) — единственный подключённый в
 * этом MVP источник РЕАЛЬНЫХ данных ЕГРЮЛ (остальные 7 источников остаются
 * демонстрационными до подключения платных/согласованных интеграций, см.
 * README). Бесплатный тариф DaData отдаёт актуальные регистрационные данные
 * (наименование, статус, адрес, руководитель, ОКВЭД, дата регистрации,
 * признак недостоверности сведений) без ключа доступа к самому ЕГРЮЛ —
 * достаточно бесплатного API-ключа DaData.
 *
 * Не содержит бизнес-логики риска и не привязан к остальному коду — используется
 * только адаптером fns.ts, который решает, когда обращаться к реальным данным,
 * а когда — к демонстрационному генератору.
 */

import { cacheGet, cacheSet } from "./cache";

const FIND_BY_ID_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";
const SUGGEST_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party";
const REQUEST_TIMEOUT_MS = 5000;
/** Регистрационные данные компании не меняются поминутно — кешируем на 30 минут, чтобы не расходовать квоту DaData на повторные проверки. */
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface DaDataPartyRecord {
  value: string;
  data: {
    inn: string;
    ogrn: string;
    kpp?: string | null;
    type: "LEGAL" | "INDIVIDUAL";
    name?: { full_with_opf?: string; short_with_opf?: string; full?: string; short?: string } | null;
    opf?: { full?: string; short?: string } | null;
    address?: { value?: string } | null;
    okved?: string | null;
    okveds?: Array<{ main: boolean; code: string; name: string }> | null;
    state: {
      status: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "BANKRUPT" | "REORGANIZING";
      registration_date?: number | null;
      liquidation_date?: number | null;
    };
    management?: { name?: string; post?: string; disqualified?: boolean } | null;
    capital?: { value?: number | null; type?: string } | null;
    invalid?: boolean | null;
  };
}

interface DaDataResponse {
  suggestions: DaDataPartyRecord[];
}

async function callDaData(url: string, body: Record<string, unknown>, signal: AbortSignal): Promise<DaDataPartyRecord | null> {
  const apiKey = process.env.DADATA_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `dadata:${url}:${JSON.stringify(body)}`;
  const cachedValue = cacheGet<DaDataPartyRecord | null>(cacheKey);
  if (cachedValue !== undefined) return cachedValue;

  const record = await callDaDataUncached(url, body, apiKey, signal);
  cacheSet(cacheKey, record, CACHE_TTL_MS);
  return record;
}

async function callDaDataUncached(
  url: string,
  body: Record<string, unknown>,
  apiKey: string,
  signal: AbortSignal
): Promise<DaDataPartyRecord | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Отменяем запрос и по внешнему сигналу (общий таймаут агрегатора), и по своему.
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as DaDataResponse;
    return json.suggestions?.[0] ?? null;
  } catch {
    return null; // сетевая ошибка/таймаут — вызывающий код (fns.ts) откатится на демо-данные
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/** Точный поиск по ИНН или ОГРН — используется, когда пользователь ввёл реквизиты. */
export function fetchDaDataByInnOrOgrn(query: string, signal: AbortSignal): Promise<DaDataPartyRecord | null> {
  return callDaData(FIND_BY_ID_URL, { query, count: 1 }, signal);
}

/** Нечёткий поиск по названию — используется, когда пользователь ввёл название компании. */
export function fetchDaDataByName(name: string, signal: AbortSignal): Promise<DaDataPartyRecord | null> {
  return callDaData(SUGGEST_URL, { query: name, count: 1, type: "LEGAL" }, signal);
}
