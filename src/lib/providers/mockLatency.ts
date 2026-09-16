import { SeededRandom } from "@/lib/utils/seededRandom";

/**
 * Имитирует сетевую задержку внешнего источника, чтобы UI и агрегатор вели
 * себя так же, как с реальным API (включая обработку в withTimeout).
 * Задержка детерминирована по seed+source, чтобы поведение было
 * воспроизводимым при повторных проверках одной и той же компании.
 */
export async function simulateLatency(seed: string, source: string, minMs = 150, maxMs = 650): Promise<void> {
  const rnd = new SeededRandom(`${seed}:latency:${source}`);
  const delay = rnd.int(minMs, maxMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
