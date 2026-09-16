/**
 * Клиент двух РЕАЛЬНЫХ бесплатных официальных сервисов Банка России —
 * подтверждено вручную (see README, раздел "Исследование источников"):
 *
 * 1. FinOrg.asmx (http://www.cbr.ru/FO_ZoomWS/FinOrg.asmx) — публичный SOAP-
 *    сервис "Автоматизированное получение сведений об участниках финансового
 *    рынка" (документация: cbr.ru/development/finorg/). Без ключа, без
 *    CAPTCHA. Метод GetFullInfoByINN возвращает лицензии компании, если она
 *    зарегистрирована как участник финансового рынка (банк, брокер, СК,
 *    МФО и т.д.); для остальных компаний — <ID>0</ID> + <Error>Нет данных</Error>.
 *
 * 2. Предупредительный список ЦБ (cbr.ru/inside/warning-list/black-list-json)
 *    — публичный JSON-реестр компаний/проектов с признаками нелегальной
 *    деятельности на финансовом рынке (финансовые пирамиды и т.п.), ~11 МБ,
 *    обновляется ежедневно. Без ключа, без CAPTCHA.
 *
 * Оба сервиса — единственные найденные в ходе исследования (см. README)
 * официальные интерактивные API ведомств, реально отвечающие на
 * автоматические запросы без обхода CAPTCHA/авторизации — остальные
 * (bo.nalog.ru, zakupki.gov.ru, fssp.gov.ru, kad.arbitr.ru, fedresurs.ru)
 * либо не отвечают на запросы вне браузера (анти-бот защита), либо требуют
 * решения CAPTCHA/согласованного доступа — см. providers/kadArbitr.ts,
 * fssp.ts, eisZakupki.ts, fedresurs.ts, girbo.ts.
 */

import { cached } from "./cache";

const FINORG_URL = "http://www.cbr.ru/FO_ZoomWS/FinOrg.asmx";
const WARNING_LIST_URL = "https://www.cbr.ru/inside/warning-list/black-list-json";
const REQUEST_TIMEOUT_MS = 6000;
const FINORG_CACHE_TTL_MS = 30 * 60 * 1000; // регистрационные данные ФО меняются редко
const WARNING_LIST_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // список большой (~11 МБ), обновляется ~раз в день

export interface CbrLicenseRecord {
  vidD: string; // название вида деятельности
  licNumber: string;
  licName: string;
  dtStart: string | null;
  dtEnd: string | null;
}

export interface CbrFinOrgRecord {
  id: string;
  inn: string;
  ogrn: string | null;
  shortName: string;
  name: string;
  status: string; // "Active" и т.д. — как отдаёт ЦБ, без интерпретации
  registrationDate: string | null;
  licenses: CbrLicenseRecord[];
}

export interface CbrWarningListRecord {
  name: string;
  inn: string;
  sign: string;
  date: string;
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  if (!match) return null;
  return match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#171;/g, "«")
    .replace(/&#187;/g, "»")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/** GetFullInfoByINN — реальные данные о лицензиях участника финансового рынка (SOAP 1.1, без ключа). */
export async function fetchCbrFinOrgByInn(inn: string, signal: AbortSignal): Promise<CbrFinOrgRecord | null> {
  const cacheKey = `cbr-finorg:${inn}`;
  return cached(cacheKey, FINORG_CACHE_TTL_MS, async () => {
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetFullInfoByINN xmlns="http://web.cbr.ru/">
      <INN>${inn}</INN>
    </GetFullInfoByINN>
  </soap:Body>
</soap:Envelope>`;

    try {
      const res = await fetchWithTimeout(
        FINORG_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: "http://web.cbr.ru/GetFullInfoByINN",
          },
          body: envelope,
        },
        signal
      );
      if (!res.ok) return null;
      const xml = await res.text();
      if (xml.includes("<Error>") || /<ID>0<\/ID>/.test(xml)) return null;

      const licenses: CbrLicenseRecord[] = extractBlocks(xml, "LicInfo").map((block) => ({
        vidD: extractTag(block, "VidD") ?? "",
        licNumber: extractTag(block, "LIC_Number") ?? "",
        licName: extractTag(block, "LIC_Name") ?? "",
        dtStart: extractTag(block, "LIC_DTStart"),
        dtEnd: extractTag(block, "LIC_DTEnd"),
      }));

      const shortName = extractTag(xml, "ShortName");
      if (!shortName) return null;

      return {
        id: extractTag(xml, "ID") ?? "",
        inn: extractTag(xml, "INN") ?? inn,
        ogrn: extractTag(xml, "OGRN"),
        shortName,
        name: extractTag(xml, "Name") ?? shortName,
        status: extractTag(xml, "Status") ?? "Unknown",
        registrationDate: extractTag(xml, "RegistrationDate"),
        licenses,
      };
    } catch {
      return null;
    }
  });
}

let warningListPromise: Promise<CbrWarningListRecord[]> | null = null;

async function loadWarningList(signal: AbortSignal): Promise<CbrWarningListRecord[]> {
  return cached("cbr-warning-list", WARNING_LIST_CACHE_TTL_MS, async () => {
    // Защита от параллельных холодных запросов одного и того же большого файла.
    if (warningListPromise) return warningListPromise;
    warningListPromise = (async () => {
      try {
        const res = await fetchWithTimeout(WARNING_LIST_URL, { method: "GET" }, signal);
        if (!res.ok) return [];
        const json = (await res.json()) as { RC?: Array<{ Name?: string; INN?: string; Sign?: string; DT?: string }> };
        return (json.RC ?? [])
          .filter((r) => r.INN) // см. providers/cbr.ts — сверяем только по точному ИНН, без нечёткого поиска по названию
          .map((r) => ({ name: r.Name ?? "", inn: r.INN ?? "", sign: r.Sign ?? "", date: r.DT ?? "" }));
      } catch {
        return [];
      }
    })();
    const result = await warningListPromise;
    warningListPromise = null;
    return result;
  });
}

/** Проверка по точному совпадению ИНН — намеренно без нечёткого поиска по названию, чтобы не давать ложных обвинений. */
export async function findCbrWarningEntry(inn: string, signal: AbortSignal): Promise<CbrWarningListRecord | null> {
  const list = await loadWarningList(signal);
  return list.find((r) => r.inn === inn) ?? null;
}
