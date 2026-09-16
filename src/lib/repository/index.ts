import { createMemoryRepository } from "./memory";
import type { Repository } from "./types";

export type { CheckHistoryEntry, Repository, SavedCompanyEntry } from "./types";

/**
 * Фабрика хранилища. Сегодня всегда возвращает in-memory реализацию.
 * Позже здесь появится ветвление по переменной окружения (например,
 * DATABASE_URL) для использования PostgreSQL/Supabase — вызывающий код
 * (API-роуты, checkCompany.ts) менять не придётся.
 */
export function getRepository(): Repository {
  return createMemoryRepository();
}
