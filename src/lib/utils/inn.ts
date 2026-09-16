/**
 * Валидация и генерация контрольных сумм ИНН/ОГРН по стандартным алгоритмам
 * ФНС. Используется как для проверки пользовательского ввода, так и для
 * генерации корректных по формату демонстрационных реквизитов (см.
 * src/lib/mock-data/companies.ts) — чтобы демо-данные не были «явно
 * фальшивыми» по формату, но были прозрачно помечены как демонстрационные.
 */

const INN10_WEIGHTS = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12_WEIGHTS_1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12_WEIGHTS_2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

function weightedChecksum(digits: number[], weights: number[]): number {
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  return (sum % 11) % 10;
}

/** Проверяет контрольную сумму ИНН юрлица (10 цифр) или физлица/ИП (12 цифр). */
export function isValidInn(raw: string): boolean {
  if (!/^\d+$/.test(raw)) return false;
  if (raw.length === 10) {
    const digits = raw.split("").map(Number);
    return weightedChecksum(digits.slice(0, 9), INN10_WEIGHTS) === digits[9];
  }
  if (raw.length === 12) {
    const digits = raw.split("").map(Number);
    const c1 = weightedChecksum(digits.slice(0, 10), INN12_WEIGHTS_1);
    const c2 = weightedChecksum(digits.slice(0, 11), INN12_WEIGHTS_2);
    return c1 === digits[10] && c2 === digits[11];
  }
  return false;
}

/** Достраивает 9-значную основу до валидного 10-значного ИНН юрлица. */
export function buildValidInn10(base9: string): string {
  if (!/^\d{9}$/.test(base9)) throw new Error("base9 must be 9 digits");
  const digits = base9.split("").map(Number);
  const check = weightedChecksum(digits, INN10_WEIGHTS);
  return base9 + String(check);
}

/** Проверяет контрольную сумму ОГРН (13 цифр) или ОГРНИП (15 цифр). */
export function isValidOgrn(raw: string): boolean {
  if (!/^\d+$/.test(raw)) return false;
  if (raw.length === 13) {
    const first12 = BigInt(raw.slice(0, 12));
    const check = Number(first12 % BigInt(11)) % 10;
    return check === Number(raw[12]);
  }
  if (raw.length === 15) {
    const first14 = BigInt(raw.slice(0, 14));
    const check = Number(first14 % BigInt(13)) % 10;
    return check === Number(raw[14]);
  }
  return false;
}

/** Достраивает 12-значную основу до валидного 13-значного ОГРН. */
export function buildValidOgrn13(base12: string): string {
  if (!/^\d{12}$/.test(base12)) throw new Error("base12 must be 12 digits");
  const first12 = BigInt(base12);
  const check = Number(first12 % BigInt(11)) % 10;
  return base12 + String(check);
}

export type QueryKind = "inn" | "ogrn" | "name";

/** Определяет, что именно ввёл пользователь: ИНН, ОГРН или название компании. */
export function detectQueryKind(rawQuery: string): QueryKind {
  const trimmed = rawQuery.trim();
  if (/^\d{10}$|^\d{12}$/.test(trimmed)) return "inn";
  if (/^\d{13}$|^\d{15}$/.test(trimmed)) return "ogrn";
  return "name";
}

export interface QueryValidationResult {
  ok: boolean;
  kind: QueryKind;
  normalized: string;
  error?: string;
}

/**
 * Проверяет ввод пользователя перед обращением к источникам. Явно отсекает
 * пустые/слишком короткие/заведомо некорректные запросы (см. обработку
 * "отсутствие компании" в API /api/check), но не требует реальной проверки
 * по реестру — в MVP это делает провайдерский слой с демо-данными.
 */
export function validateQuery(rawQuery: string): QueryValidationResult {
  const trimmed = rawQuery.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { ok: false, kind: "name", normalized: "", error: "Введите ИНН, ОГРН или название компании" };
  }
  const kind = detectQueryKind(trimmed);
  if (kind === "inn") {
    if (!isValidInn(trimmed)) {
      return { ok: false, kind, normalized: trimmed, error: "Некорректная контрольная сумма ИНН" };
    }
    if (trimmed.length === 12) {
      return {
        ok: false,
        kind,
        normalized: trimmed,
        error: "Указан ИНН физического лица/ИП — сервис пока проверяет только организации",
      };
    }
  }
  if (kind === "ogrn") {
    if (!isValidOgrn(trimmed)) {
      return { ok: false, kind, normalized: trimmed, error: "Некорректная контрольная сумма ОГРН" };
    }
    if (trimmed.length === 15) {
      return {
        ok: false,
        kind,
        normalized: trimmed,
        error: "Указан ОГРНИП — сервис пока проверяет только организации",
      };
    }
  }
  if (kind === "name" && trimmed.length < 3) {
    return { ok: false, kind, normalized: trimmed, error: "Название компании слишком короткое" };
  }
  return { ok: true, kind, normalized: trimmed };
}
