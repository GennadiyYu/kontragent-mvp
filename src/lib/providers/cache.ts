/**
 * Простой in-memory TTL-кеш для ответов реальных источников (DaData, ЦБ РФ
 * и т.д.). Живёт в памяти процесса — сбрасывается при холодном старте
 * serverless-функции, но в рамках одного тёплого инстанса Vercel исключает
 * повторные обращения к внешнему API при повторных проверках одного и того
 * же контрагента. Для персистентного кеша между инстансами в будущем модуль
 * можно заменить на Vercel KV/Redis, не меняя вызывающий код (см. cached()).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Возвращает значение из кеша, если оно есть и не истекло. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Оборачивает асинхронную загрузку: при попадании в кеш не вызывает fn. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  cacheSet(key, value, ttlMs);
  return value;
}
