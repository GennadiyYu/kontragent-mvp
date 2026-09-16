import { buildValidInn10, buildValidOgrn13 } from "@/lib/utils/inn";
import type { RiskArchetype } from "./generator";

/**
 * Небольшой набор «кураторских» демо-компаний с заранее заданным профилем
 * риска — обеспечивает предсказуемый, качественный демонстрационный опыт
 * (в т.ч. блок «Последние проверки» на главной). Любой другой запрос
 * (реальный ИНН/ОГРН/название, отсутствующие в этом списке) обрабатывается
 * процедурным генератором (см. resolveCompany.ts) с явной demo-меткой.
 *
 * ИНН/ОГРН получены детерминированным вычислением контрольной суммы от
 * произвольной 9/12-значной основы — это НЕ реальные реквизиты действующих
 * организаций.
 */
export interface SeedCompany {
  fullName: string;
  shortName: string;
  inn: string;
  ogrn: string;
  archetype: RiskArchetype;
  aliases: string[]; // варианты, по которым компанию можно найти в поиске
}

function seedCompany(
  base9: string,
  base12: string,
  fullName: string,
  shortName: string,
  archetype: RiskArchetype,
  aliases: string[]
): SeedCompany {
  return {
    fullName,
    shortName,
    inn: buildValidInn10(base9),
    ogrn: buildValidOgrn13(base12),
    archetype,
    aliases: [shortName, fullName, ...aliases].map((a) => a.toLowerCase()),
  };
}

export const SEED_COMPANIES: SeedCompany[] = [
  seedCompany(
    "770708111",
    "102770123456",
    "Общество с ограниченной ответственностью «Технологии Будущего»",
    "ООО «Технологии Будущего»",
    "low",
    ["технологии будущего"]
  ),
  seedCompany(
    "780512222",
    "104780234567",
    "Общество с ограниченной ответственностью «СтройГарант»",
    "ООО «СтройГарант»",
    "moderate",
    ["стройгарант"]
  ),
  seedCompany(
    "631403333",
    "108631345678",
    "Акционерное общество «Регион Трейд»",
    "АО «Регион Трейд»",
    "high",
    ["регион трейд"]
  ),
  seedCompany(
    "230944444",
    "112230456789",
    "Общество с ограниченной ответственностью «Агроинвест Плюс»",
    "ООО «Агроинвест Плюс»",
    "critical",
    ["агроинвест плюс", "агроинвест"]
  ),
  seedCompany(
    "540255555",
    "116540567890",
    "Общество с ограниченной ответственностью «Логистик Сервис»",
    "ООО «Логистик Сервис»",
    "low",
    ["логистик сервис"]
  ),
  seedCompany(
    "165166666",
    "120165678901",
    "Общество с ограниченной ответственностью «Финанс Капитал»",
    "ООО «Финанс Капитал»",
    "moderate",
    ["финанс капитал"]
  ),
];

export function findSeedCompanyByInn(inn: string): SeedCompany | undefined {
  return SEED_COMPANIES.find((c) => c.inn === inn);
}

export function findSeedCompanyByOgrn(ogrn: string): SeedCompany | undefined {
  return SEED_COMPANIES.find((c) => c.ogrn === ogrn);
}

export function findSeedCompanyByName(name: string): SeedCompany | undefined {
  const q = name.trim().toLowerCase();
  return SEED_COMPANIES.find((c) => c.aliases.some((a) => a === q || a.includes(q) || q.includes(a)));
}
