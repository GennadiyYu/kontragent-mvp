import { RISK_LEVEL_LABEL } from "@/types/common";
import type { AIProvider, AiSummaryInput, AiSummaryResult } from "./types";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 9000;

const SYSTEM_INSTRUCTION = `Ты — ассистент-аналитик сервиса проверки российских контрагентов «Контрагент».
Тебе присылают ТОЛЬКО уже проверенные структурированные факты и уже рассчитанный числовой рейтинг риска
(рассчитан отдельным программным модулем, не тобой). Твоя единственная задача — кратко и по-деловому
изложить эти факты пользователю на русском языке.

СТРОГО ЗАПРЕЩЕНО:
- придумывать любые факты, компании, суммы, даты или события, которых нет во входных данных;
- изменять, оспаривать или пересчитывать итоговый рейтинг риска — он уже рассчитан и является окончательным;
- делать выводы, не подтверждённые переданными фактами;
- упоминать источники или события, отсутствующие во входных данных.

Отвечай ТОЛЬКО валидным JSON по заданной схеме, без markdown и пояснений вне JSON.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summaryText: { type: "string", description: "Связное резюме на 3-5 предложений на русском языке" },
    keyPositives: { type: "array", items: { type: "string" }, description: "До 4 ключевых положительных факторов" },
    keyRisks: { type: "array", items: { type: "string" }, description: "До 4 ключевых факторов риска" },
    recommendation: { type: "string", description: "Одна-две фразы с рекомендацией по сотрудничеству" },
  },
  required: ["summaryText", "keyPositives", "keyRisks", "recommendation"],
} as const;

function buildUserPrompt(input: AiSummaryInput): string {
  const facts = {
    компания: {
      название: input.company.shortName,
      статус: input.company.statusLabel,
      датаРегистрации: input.company.registrationDate,
      видДеятельности: input.company.okvedName,
    },
    рейтингРиска: {
      баллИтого: input.riskAssessment.totalScore,
      уровень: RISK_LEVEL_LABEL[input.riskAssessment.level],
      категории: input.riskAssessment.categories.map((c) => ({ категория: c.category, балл: c.score, уровень: c.level })),
      факторыРиска: input.riskAssessment.riskFactors,
      положительныеФакторы: input.riskAssessment.positiveFactors,
    },
    финансы: input.finance.years.slice(0, 2).map((y) => ({ год: y.year, выручка: y.revenue, прибыль: y.netProfit })),
    арбитраж: { ответчик: input.arbitration.totalCasesAsDefendant, суммаТребований: input.arbitration.totalClaimAmountAsDefendant },
    исполнительныеПроизводства: { действующих: input.enforcement.activeCount, сумма: input.enforcement.activeAmount },
    банкротство: { активнаяПроцедура: input.bankruptcy.hasActiveCase, стадия: input.bankruptcy.stageLabel ?? null },
    закупки: { поставщикВРНП: input.procurement.isInUnreliableSuppliersRegistry },
    репутация: { негативныхУпоминаний: input.reputation.negativeMentionsCount },
  };

  return `Вот структурированные факты о компании и рассчитанный рейтинг риска (JSON):\n${JSON.stringify(facts, null, 2)}\n\nСформируй аналитическое резюме строго по этим данным согласно системной инструкции.`;
}

interface GeminiCandidateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/**
 * Провайдер на базе Google Gemini (экономичная Flash/Flash-Lite модель).
 * Используется REST API напрямую через fetch — без добавления SDK как
 * зависимости, чтобы соответствовать требованию «минимум зависимостей».
 * Название модели и ключ берутся из переменных окружения GEMINI_MODEL и
 * GEMINI_API_KEY — секреты никогда не хранятся в коде.
 */
export class GeminiAIProvider implements AIProvider {
  readonly id = "gemini" as const;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateSummary(input: AiSummaryInput): Promise<AiSummaryResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API вернул статус ${response.status}`);
      }

      const payload = (await response.json()) as GeminiCandidateResponse;
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini API вернул пустой ответ");

      const parsed = JSON.parse(text) as Partial<AiSummaryResult>;
      if (!parsed.summaryText || !parsed.recommendation) {
        throw new Error("Ответ Gemini не соответствует ожидаемой схеме");
      }

      return {
        summaryText: parsed.summaryText,
        keyPositives: Array.isArray(parsed.keyPositives) ? parsed.keyPositives : [],
        keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [],
        recommendation: parsed.recommendation,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
