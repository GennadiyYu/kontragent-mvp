import { getDb } from "@/lib/db/sqlite";

/**
 * FnsEmployeesProvider — читает реальную среднесписочную численность
 * работников (официальный открытый датасет ФНС «sshr», см.
 * scripts/import-fns-risk.mjs) из локальной БД.
 *
 * СЕМАНТИКА ОТСУТСТВИЯ ЗАПИСИ: отсутствие записи означает ТОЛЬКО «в
 * проверенном наборе ФНС по этому ИНН нет сведений о среднесписочной
 * численности за опубликованный период» — компания могла не подать
 * сведения, быть слишком молодой или не попасть в конкретную выгрузку.
 * Отсутствие записи НЕ означает «нет сотрудников».
 *
 * НАЗНАЧЕНИЕ: справочный показатель масштаба деятельности. Малая
 * численность НЕ считается самостоятельным негативным признаком — в
 * risk-engine пока не используется (задел на будущее: анализ в контексте
 * доходов и вида деятельности).
 */
export interface EmployeesRecord {
  count: number;
  periodYear: number | null;
  snapshotDate: string | null;
  sourceUrl: string;
}

/** null — компания проверена в датасете sshr, записи нет (см. семантику выше). */
export async function getEmployeeCount(inn: string): Promise<EmployeesRecord | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const row = db
      .prepare(
        `SELECT employees_count as count, period_year as periodYear, snapshot_date as snapshotDate, source_url as sourceUrl
         FROM fns_employees WHERE inn = ?`
      )
      .get(inn) as unknown as EmployeesRecord | undefined;
    return row ?? null;
  } catch (err) {
    console.warn("[fnsEmployees] ошибка чтения fns_employees:", err);
    return null;
  }
}
