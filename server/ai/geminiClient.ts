import { GoogleGenAI, GenerateContentConfig } from '@google/genai';
import { logger } from '../utils/logger.ts';

interface CircuitState {
  isRateLimited: boolean;
  cooldownUntil: number;
  lastError: string | null;
  consecutiveFailures: number;
}

class GeminiClientManager {
  private client: GoogleGenAI | null = null;
  private circuitState: CircuitState = {
    isRateLimited: false,
    cooldownUntil: 0,
    lastError: null,
    consecutiveFailures: 0,
  };
  private readonly defaultModel = 'gemini-3.7-flash';

  public getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      return null;
    }
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.client;
  }

  public isAvailable(): boolean {
    const client = this.getClient();
    if (!client) return false;

    // Check circuit breaker
    if (this.circuitState.isRateLimited) {
      if (Date.now() > this.circuitState.cooldownUntil) {
        // Cooldown passed, reset circuit
        this.circuitState.isRateLimited = false;
        this.circuitState.consecutiveFailures = 0;
        logger.info('Gemini API rate limit cooldown period expired. Resuming AI calls.');
        return true;
      }
      return false;
    }

    return true;
  }

  public getStatus() {
    return {
      hasKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      isAvailable: this.isAvailable(),
      isRateLimited: this.circuitState.isRateLimited,
      cooldownRemainingSeconds: Math.max(0, Math.ceil((this.circuitState.cooldownUntil - Date.now()) / 1000)),
      lastError: this.circuitState.lastError,
    };
  }

  public tripCircuit(err: any, suggestedCooldownMs = 45000) {
    const errorMessage = err?.message || String(err);
    const isQuota =
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('rate-limits');

    // Parse retry delay from error if available
    let cooldownMs = suggestedCooldownMs;
    const retryMatch = errorMessage.match(/retry in ([0-9.]+)s/i) || errorMessage.match(/"retryDelay":\s*"([0-9]+)s"/i);
    if (retryMatch && retryMatch[1]) {
      const parsedSec = parseFloat(retryMatch[1]);
      if (!isNaN(parsedSec) && parsedSec > 0) {
        cooldownMs = Math.ceil(parsedSec * 1000) + 2000;
      }
    }

    this.circuitState.isRateLimited = true;
    this.circuitState.cooldownUntil = Date.now() + cooldownMs;
    this.circuitState.lastError = isQuota ? 'Quota/Rate limit reached (429)' : errorMessage.slice(0, 120);
    this.circuitState.consecutiveFailures++;

    logger.info(
      `Gemini rate-limit circuit activated for ${Math.round(cooldownMs / 1000)}s (${this.circuitState.lastError}). Using high-fidelity heuristic and deterministic templates.`
    );
  }

  public async safeGenerateContent(options: {
    prompt: string;
    model?: string;
    config?: GenerateContentConfig;
  }): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const ai = this.getClient();
    if (!ai) return null;

    try {
      const response = await ai.models.generateContent({
        model: options.model || this.defaultModel,
        contents: options.prompt,
        config: options.config,
      });

      // Successful call resets failure count
      this.circuitState.consecutiveFailures = 0;
      return response.text?.trim() || null;
    } catch (err: any) {
      const msg = err?.message || String(err);
      const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota');

      if (is429) {
        this.tripCircuit(err);
      } else {
        logger.warn(`Gemini generation transient error: ${msg.slice(0, 100)}`);
      }
      return null;
    }
  }
}

export const geminiClient = new GeminiClientManager();
