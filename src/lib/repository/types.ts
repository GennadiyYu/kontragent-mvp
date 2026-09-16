import type { RiskLevel } from "@/types/common";

/**
 * Абстракция хранилища. MVP работает без обязательной внешней БД — реализация
 * по умолчанию (memory.ts) хранит данные в памяти процесса. Когда появится
 * потребность в персистентности (пользователи, история проверок, сохранённые
 * компании, мониторинг, кеш результатов), достаточно реализовать этот же
 * интерфейс поверх PostgreSQL/Supabase и подменить фабрику в index.ts —
 * остальной код (API-роуты, страницы) от конкретного хранилища не зависит.
 */
export interface CheckHistoryEntry {
  id: string;
  query: string;
  companyName: string;
  inn: string;
  riskScore: number;
  riskLevel: RiskLevel;
  checkedAt: string;
  userId?: string;
}

export interface SavedCompanyEntry {
  id: string;
  inn: string;
  companyName: string;
  savedAt: string;
  userId?: string;
  note?: string;
}

export interface Repository {
  history: {
    add(entry: CheckHistoryEntry): Promise<void>;
    listRecent(limit?: number, userId?: string): Promise<CheckHistoryEntry[]>;
  };
  savedCompanies: {
    save(entry: SavedCompanyEntry): Promise<void>;
    remove(id: string): Promise<void>;
    list(userId?: string): Promise<SavedCompanyEntry[]>;
  };
  cache: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  };
}
