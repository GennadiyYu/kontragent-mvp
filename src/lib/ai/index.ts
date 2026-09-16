import type { AiSummary } from "@/types/dossier";
import { GeminiAIProvider } from "./gemini";
import { templateAIProvider } from "./fallback";
import type { AiSummaryInput } from "./types";

const DEMO_DISCLAIMER =
  "Аналитическое заключение сформировано на основе демонстрационных данных и правил Risk Engine. Не является официальным заключением и не заменяет юридическую или финансовую экспертизу.";

/**
 * Единая точка входа для получения AI-резюме досье. Пытается использовать
 * Gemini (если задан GEMINI_API_KEY), при любой ошибке — включая отсутствие
 * ключа, сетевой сбой или некорректный ответ — прозрачно откатывается на
 * детерминированный шаблонный провайдер, чтобы сервис оставался полностью
 * работоспособным без ИИ (требование ТЗ).
 */
export async function generateAiSummary(input: AiSummaryInput): Promise<AiSummary> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;

  if (apiKey) {
    try {
      const provider = new GeminiAIProvider(apiKey, model);
      const result = await provider.generateSummary(input);
      return {
        generatedBy: "gemini",
        summaryText: result.summaryText,
        keyPositives: result.keyPositives,
        keyRisks: result.keyRisks,
        recommendation: result.recommendation,
        disclaimer: DEMO_DISCLAIMER,
        generatedAt: new Date().toISOString(),
        modelName: model,
      };
    } catch (err) {
      console.warn("[ai] Gemini недоступен, используется шаблонное заключение:", err instanceof Error ? err.message : err);
    }
  }

  const result = await templateAIProvider.generateSummary(input);
  return {
    generatedBy: "template",
    summaryText: result.summaryText,
    keyPositives: result.keyPositives,
    keyRisks: result.keyRisks,
    recommendation: result.recommendation,
    disclaimer: DEMO_DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };
}
