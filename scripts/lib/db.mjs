// Общий доступ к локальной SQLite для ETL-скриптов (scripts/import-*.mjs).
// Используется встроенный node:sqlite (Node 22.5+) — без внешних зависимостей.
// Путь к файлу БД и SQL-схема здесь являются источником истины; читающий слой
// приложения (src/lib/db/sqlite.ts) использует тот же путь и ожидает эти же
// таблицы — при изменении схемы обновляйте оба места.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = join(__dirname, "..", "..", "data", "kontragent.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS finance_revexp (
  inn TEXT NOT NULL,
  report_year INTEGER NOT NULL,
  revenue REAL,
  expense REAL,
  snapshot_date TEXT,
  imported_at TEXT NOT NULL,
  source_url TEXT NOT NULL,
  PRIMARY KEY (inn, report_year)
);
CREATE INDEX IF NOT EXISTS idx_finance_revexp_inn ON finance_revexp(inn);

CREATE TABLE IF NOT EXISTS fns_tax_debt (
  inn TEXT PRIMARY KEY,
  total_amount REAL NOT NULL,
  snapshot_date TEXT,
  imported_at TEXT NOT NULL,
  source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fns_tax_paid (
  inn TEXT PRIMARY KEY,
  total_amount REAL NOT NULL,
  period_year INTEGER,
  snapshot_date TEXT,
  imported_at TEXT NOT NULL,
  source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fns_employees (
  inn TEXT PRIMARY KEY,
  employees_count INTEGER NOT NULL,
  period_year INTEGER,
  snapshot_date TEXT,
  imported_at TEXT NOT NULL,
  source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fns_special_regime (
  inn TEXT PRIMARY KEY,
  is_esxn INTEGER NOT NULL DEFAULT 0,
  is_usn INTEGER NOT NULL DEFAULT 0,
  is_ausn INTEGER NOT NULL DEFAULT 0,
  is_srp INTEGER NOT NULL DEFAULT 0,
  snapshot_date TEXT,
  imported_at TEXT NOT NULL,
  source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fns_disqualified (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  birth_date TEXT,
  company_name_raw TEXT,
  company_name_normalized TEXT,
  position TEXT,
  start_date TEXT,
  end_date TEXT,
  imported_at TEXT NOT NULL,
  source_url TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fns_disqualified_company ON fns_disqualified(company_name_normalized);

CREATE TABLE IF NOT EXISTS import_runs (
  dataset TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  source_url TEXT NOT NULL
);
`;

export function openDb() {
  mkdirSync(join(__dirname, "..", "..", "data"), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

/** Нормализация названия компании для сопоставления по тексту (без ОПФ, кавычек, регистра, лишних пробелов). */
export function normalizeCompanyName(name) {
  return name
    .toUpperCase()
    .replace(/[«»"']/g, "")
    .replace(/^(ООО|АО|ПАО|ЗАО|ОАО|ИП)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function recordImportRun(db, dataset, rowCount, sourceUrl) {
  db.prepare(
    "INSERT INTO import_runs (dataset, imported_at, row_count, source_url) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(dataset) DO UPDATE SET imported_at = excluded.imported_at, row_count = excluded.row_count, source_url = excluded.source_url"
  ).run(dataset, new Date().toISOString(), rowCount, sourceUrl);
}
