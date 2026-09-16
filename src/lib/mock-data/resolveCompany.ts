import { SeededRandom } from "@/lib/utils/seededRandom";
import { detectQueryKind } from "@/lib/utils/inn";
import { findSeedCompanyByInn, findSeedCompanyByName, findSeedCompanyByOgrn } from "./companies";
import type { ResolvedCompanyQuery, RiskArchetype } from "./generator";

/** Распределение архетипов риска для «неизвестных» (не кураторских) запросов. */
const ARCHETYPE_WEIGHTS: Array<{ archetype: RiskArchetype; weight: number }> = [
  { archetype: "low", weight: 0.5 },
  { archetype: "moderate", weight: 0.3 },
  { archetype: "high", weight: 0.15 },
  { archetype: "critical", weight: 0.05 },
];

function pickArchetypeFromSeed(seed: string): RiskArchetype {
  const rnd = new SeededRandom(`${seed}:archetype`);
  const total = ARCHETYPE_WEIGHTS.reduce((s, i) => s + i.weight, 0);
  let r = rnd.float(0, total);
  for (const item of ARCHETYPE_WEIGHTS) {
    if (r < item.weight) return item.archetype;
    r -= item.weight;
  }
  return "low";
}

/**
 * Определяет, к какому демо-профилю относится пользовательский запрос:
 * к одной из кураторских демо-компаний (стабильный, заранее продуманный
 * профиль, curated: true — реальные источники не опрашиваются) или к
 * процедурно генерируемому профилю (curated: false — для произвольного
 * ИНН/ОГРН/названия адаптеры реальных источников, например DaData в
 * providers/fns.ts, сначала пытаются получить настоящие данные).
 */
export function resolveCompanyQuery(normalizedQuery: string): ResolvedCompanyQuery {
  const kind = detectQueryKind(normalizedQuery);

  if (kind === "inn") {
    const seedCompany = findSeedCompanyByInn(normalizedQuery);
    if (seedCompany) {
      return {
        seed: seedCompany.inn,
        archetype: seedCompany.archetype,
        curated: true,
        rawQuery: normalizedQuery,
        knownFullName: seedCompany.fullName,
        knownShortName: seedCompany.shortName,
        knownInn: seedCompany.inn,
        knownOgrn: seedCompany.ogrn,
      };
    }
    return {
      seed: normalizedQuery,
      archetype: pickArchetypeFromSeed(normalizedQuery),
      curated: false,
      rawQuery: normalizedQuery,
      knownInn: normalizedQuery,
    };
  }

  if (kind === "ogrn") {
    const seedCompany = findSeedCompanyByOgrn(normalizedQuery);
    if (seedCompany) {
      return {
        seed: seedCompany.ogrn,
        archetype: seedCompany.archetype,
        curated: true,
        rawQuery: normalizedQuery,
        knownFullName: seedCompany.fullName,
        knownShortName: seedCompany.shortName,
        knownInn: seedCompany.inn,
        knownOgrn: seedCompany.ogrn,
      };
    }
    return {
      seed: normalizedQuery,
      archetype: pickArchetypeFromSeed(normalizedQuery),
      curated: false,
      rawQuery: normalizedQuery,
      knownOgrn: normalizedQuery,
    };
  }

  // kind === "name"
  const seedCompany = findSeedCompanyByName(normalizedQuery);
  if (seedCompany) {
    return {
      seed: seedCompany.inn,
      archetype: seedCompany.archetype,
      curated: true,
      rawQuery: normalizedQuery,
      knownFullName: seedCompany.fullName,
      knownShortName: seedCompany.shortName,
      knownInn: seedCompany.inn,
      knownOgrn: seedCompany.ogrn,
    };
  }
  const hasLegalFormPrefix = /^(ООО|АО|ПАО|ЗАО|ИП)\b/i.test(normalizedQuery);
  const shortName = hasLegalFormPrefix ? normalizedQuery : `ООО «${normalizedQuery}»`;
  return {
    seed: normalizedQuery.toLowerCase(),
    archetype: pickArchetypeFromSeed(normalizedQuery.toLowerCase()),
    curated: false,
    rawQuery: normalizedQuery,
    knownFullName: shortName,
    knownShortName: shortName,
  };
}
