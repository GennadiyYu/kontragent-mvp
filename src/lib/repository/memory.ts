import type { CheckHistoryEntry, Repository, SavedCompanyEntry } from "./types";

interface CacheRecord {
  value: unknown;
  expiresAt: number;
}

/**
 * Реализация Repository в памяти процесса — используется по умолчанию,
 * чтобы приложение запускалось без внешней БД. ВАЖНО: на serverless-платформах
 * (в т.ч. Vercel) экземпляр процесса не гарантированно переживает между
 * запросами, поэтому эти данные не следует считать надёжным хранилищем в
 * проде — это заглушка для локальной разработки и демонстрации архитектуры.
 * UI дополнительно дублирует «последние проверки» в localStorage браузера
 * (см. RecentChecks.tsx), что надёжно работает и без БД.
 */
class InMemoryRepository implements Repository {
  private historyStore: CheckHistoryEntry[] = [];
  private savedStore: Map<string, SavedCompanyEntry> = new Map();
  private cacheStore: Map<string, CacheRecord> = new Map();

  history = {
    add: async (entry: CheckHistoryEntry) => {
      this.historyStore.unshift(entry);
      this.historyStore = this.historyStore.slice(0, 200);
    },
    listRecent: async (limit = 10, userId?: string) => {
      const filtered = userId ? this.historyStore.filter((e) => e.userId === userId) : this.historyStore;
      return filtered.slice(0, limit);
    },
  };

  savedCompanies = {
    save: async (entry: SavedCompanyEntry) => {
      this.savedStore.set(entry.id, entry);
    },
    remove: async (id: string) => {
      this.savedStore.delete(id);
    },
    list: async (userId?: string) => {
      const all = [...this.savedStore.values()];
      return userId ? all.filter((e) => e.userId === userId) : all;
    },
  };

  cache = {
    get: async <T>(key: string): Promise<T | null> => {
      const record = this.cacheStore.get(key);
      if (!record) return null;
      if (Date.now() > record.expiresAt) {
        this.cacheStore.delete(key);
        return null;
      }
      return record.value as T;
    },
    set: async <T>(key: string, value: T, ttlSeconds: number): Promise<void> => {
      this.cacheStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
  };
}

// Синглтон на процесс — переживает горячие перезагрузки dev-сервера через globalThis.
const globalForRepo = globalThis as unknown as { __kontragentRepo?: InMemoryRepository };

export function createMemoryRepository(): Repository {
  if (!globalForRepo.__kontragentRepo) {
    globalForRepo.__kontragentRepo = new InMemoryRepository();
  }
  return globalForRepo.__kontragentRepo;
}
