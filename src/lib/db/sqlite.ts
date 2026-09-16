/**
 * Read-only доступ к локальной SQLite (data/kontragent.db), наполняемой
 * ETL-скриптами (npm run import:finance / import:fns-risk, см. scripts/).
 * Путь к файлу и схема ДОЛЖНЫ совпадать с scripts/lib/db.mjs.
 *
 * Абстракция намеренно узкая (getDb() возвращает соединение или null) —
 * это repository-слой для локальной БД, аналогичный src/lib/repository для
 * истории проверок. При переносе на PostgreSQL/Supabase меняется только
 * этот файл (и db.mjs у ETL) — вызывающий код (providers/financeDb.ts,
 * providers/fnsRiskDb.ts) обращается только к типизированным функциям
 * ниже, не к сырому SQL напрямую.
 *
 * node:sqlite грузится через динамический import(), а не require(): Turbopack
 * (сборщик Next.js) не умеет бандлить require() встроенного модуля с
 * префиксом "node:" и падает на этапе выполнения — await import() он
 * корректно оставляет внешним вызовом.
 */
import { existsSync } from "node:fs";
import path from "node:path";

type DatabaseSyncType = import("node:sqlite").DatabaseSync;

const DB_PATH = path.join(process.cwd(), "data", "kontragent.db");

let dbPromise: Promise<DatabaseSyncType | null> | undefined;

async function openDb(): Promise<DatabaseSyncType | null> {
  if (!existsSync(DB_PATH)) return null;
  try {
    const { DatabaseSync } = await import("node:sqlite");
    return new DatabaseSync(DB_PATH, { readOnly: true });
  } catch (err) {
    console.warn("[db] node:sqlite недоступен или БД повреждена, реальные ФНС-данные из локальной БД отключены:", err);
    return null;
  }
}

/**
 * Возвращает соединение с БД (кешируется на весь срок жизни процесса) или
 * null, если файл не найден (ETL ещё не запускался) либо node:sqlite
 * недоступен в текущем окружении выполнения (например, более старый
 * Node.js рантайм на хостинге). В обоих случаях вызывающие провайдеры
 * должны тихо откатиться на демо-данные — так же, как при недоступности
 * любого другого реального источника.
 */
export function getDb(): Promise<DatabaseSyncType | null> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}
