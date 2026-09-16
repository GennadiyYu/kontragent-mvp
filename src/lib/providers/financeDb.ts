import { getDb } from "@/lib/db/sqlite";

export interface FinanceDbRow {
  inn: string;
  reportYear: number;
  revenue: number;
  expense: number;
  snapshotDate: string | null;
  sourceUrl: string;
  retrievedAt: string;
}

/**
 * Читает реальные записи выручки/расходов для компании (все доступные годы,
 * по убыванию). Датасет ФНС "revexp" публикуется как один снимок в год —
 * сейчас, как правило, будет ровно одна запись за самый свежий год; со
 * временем при регулярных запусках `npm run import:finance` накопится
 * история. Возвращает [], если БД недоступна или данных по ИНН нет.
 */
export async function getFinanceRecords(inn: string): Promise<FinanceDbRow[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT inn, report_year as reportYear, revenue, expense, snapshot_date as snapshotDate, imported_at as retrievedAt, source_url as sourceUrl
         FROM finance_revexp WHERE inn = ? ORDER BY report_year DESC`
      )
      .all(inn) as unknown as FinanceDbRow[];
    return rows;
  } catch (err) {
    console.warn("[financeDb] ошибка чтения finance_revexp:", err);
    return [];
  }
}
