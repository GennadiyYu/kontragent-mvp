/**
 * Оборачивает асинхронную операцию в ограничение по времени и в защиту от
 * необработанных исключений. Гарантирует, что недоступность/зависание
 * одного источника не «уронит» всю проверку контрагента — вызывающий код
 * (aggregate.ts) всегда получает предсказуемый результат: либо данные,
 * либо явный статус ошибки/таймаута.
 */
export interface TimeoutResult<T> {
  ok: boolean;
  timedOut: boolean;
  value: T | null;
  error?: string;
  latencyMs: number;
}

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<TimeoutResult<T>> {
  const controller = new AbortController();
  const started = Date.now();
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`Источник не ответил за ${timeoutMs} мс`));
    }, timeoutMs);
    // Не удерживаем процесс живым из-за таймера (актуально для Node runtime).
    if (typeof timer === "object" && "unref" in timer) (timer as { unref: () => void }).unref();
  });

  try {
    const value = await Promise.race([operation(controller.signal), timeoutPromise]);
    return { ok: true, timedOut: false, value, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      timedOut,
      value: null,
      error: err instanceof Error ? err.message : "Неизвестная ошибка источника",
      latencyMs: Date.now() - started,
    };
  }
}
