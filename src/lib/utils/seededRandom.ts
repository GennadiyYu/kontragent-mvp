/**
 * Детерминированный генератор псевдослучайных чисел, засеваемый строкой
 * (обычно — ИНН компании). Позволяет генерировать демонстрационные данные,
 * которые остаются стабильными между повторными запросами по одной и той же
 * компании, не требуя базы данных.
 */

// FNV-1a: быстрый и стабильный хэш строки в 32-битное целое.
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: компактный PRNG с хорошим распределением для демо-целей.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRandom {
  private rand: () => number;

  constructor(seed: string) {
    this.rand = mulberry32(fnv1a(seed));
  }

  /** Число с плавающей точкой в [0, 1). */
  next(): number {
    return this.rand();
  }

  /** Целое число в диапазоне [min, max] включительно. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Число с плавающей точкой в диапазоне [min, max). */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** true с вероятностью probability (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Случайный элемент массива. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Случайное подмножество массива размером от min до max элементов. */
  sample<T>(items: readonly T[], min: number, max: number): T[] {
    const count = Math.min(items.length, this.int(min, max));
    const pool = [...items];
    const result: T[] = [];
    for (let i = 0; i < count; i++) {
      const idx = this.int(0, pool.length - 1);
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }
}
