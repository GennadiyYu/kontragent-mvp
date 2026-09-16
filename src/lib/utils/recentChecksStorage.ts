"use client";

import { useSyncExternalStore } from "react";
import type { RiskLevel } from "@/types/common";

/**
 * «Последние проверки» на главной странице читаются из localStorage браузера,
 * а не из серверного репозитория (src/lib/repository) — это единственный
 * способ, который надёжно работает на serverless-хостинге (Vercel) без
 * привязки к конкретному пользователю/БД. Серверный in-memory репозиторий
 * (см. src/lib/repository/memory.ts) тоже пишет историю — он демонстрирует
 * архитектуру для будущей БД, но не является источником данных для этого UI.
 */
export interface RecentCheckEntry {
  query: string;
  inn: string;
  companyName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  checkedAt: string;
}

const STORAGE_KEY = "kontragent:recent-checks";
const UPDATED_EVENT = "kontragent:recent-checks-updated";
const MAX_ENTRIES = 8;
const EMPTY: RecentCheckEntry[] = [];

export function getRecentChecks(): RecentCheckEntry[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function addRecentCheck(entry: RecentCheckEntry): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentChecks().filter((e) => e.inn !== entry.inn);
    const next = [entry, ...existing].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(UPDATED_EVENT));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — не критично для работы сервиса
  }
}

// --- Кэшированный снимок для useSyncExternalStore ---
// getSnapshot обязан возвращать одну и ту же ссылку, пока данные не изменились,
// иначе React будет считать состояние всегда "новым" и уйдёт в цикл ре-рендеров.
let cachedRaw: string | null | undefined;
let cachedSnapshot: RecentCheckEntry[] = EMPTY;

function readSnapshot(): RecentCheckEntry[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : EMPTY;
    cachedSnapshot = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cachedSnapshot = EMPTY;
  }
  return cachedSnapshot;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(UPDATED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(UPDATED_EVENT, callback);
  };
}

/**
 * Хук для чтения «последних проверок» без гидратационного рассинхрона:
 * useSyncExternalStore возвращает пустой массив на сервере/первом клиентском
 * рендере и синхронизируется с localStorage сразу после гидратации, а также
 * реагирует на изменения из других вкладок ("storage") и из этой же вкладки
 * (кастомное событие, которое шлёт addRecentCheck).
 */
export function useRecentChecks(): RecentCheckEntry[] {
  return useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);
}
