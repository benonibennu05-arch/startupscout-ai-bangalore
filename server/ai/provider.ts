import { OpportunityType, ExperienceLevel, EmailType } from '../types.ts';
import { geminiClient } from './geminiClient.ts';
import { heuristicClassifyJob, ClassifiedJob } from './geminiClassifier.ts';
import { logger } from '../utils/logger.ts';

export interface EmailGenerationResult {
  subject: string;
  body: string;
  source: 'ai_gemini' | 'ai_local' | 'deterministic_template';
}

export interface AIProvider {
  name: 'none' | 'gemini' | 'ollama';
  isAvailable(): boolean;
  classifyOpportunity(
    title: string,
    description: string,
    companyName: string,
    targetRoles?: string[],
    targetSkills?: string[]
  ): Promise<ClassifiedJob>;
  generateEmail(
    context: {
      recipientName?: string | null;
      recipientRole?: string | null;
      companyName: string;
      candidateName: string;
      roleTitle: string;
      candidateSkills?: string[];
      portfolioUrl?: string;
      githubUrl?: string;
      linkedinUrl?: string;
      fallbackSubject: string;
      fallbackBody: string;
    }
  ): Promise<EmailGenerationResult>;
}

/**
 * 1. NoAIProvider: Deterministic, rule-based, zero external dependencies.
 * Guaranteed never to throw or fail.
 */
export class NoAIProvider implements AIProvider {
  public name = 'none' as const;

  public isAvailable(): boolean {
    return true;
  }

  public async classifyOpportunity(
    title: string,
    description: string,
    companyName: string,
    targetRoles: string[] = [],
    targetSkills: string[] = []
  ): Promise<ClassifiedJob> {
    return heuristicClassifyJob(title, description, targetRoles, targetSkills);
  }

  public async generateEmail(context: {
    recipientName?: string | null;
    companyName: string;
    candidateName: string;
    roleTitle: string;
    fallbackSubject: string;
    fallbackBody: string;
  }): Promise<EmailGenerationResult> {
    return {
      subject: context.fallbackSubject,
      body: context.fallbackBody,
      source: 'deterministic_template',
    };
  }
}

/**
 * 2. GeminiProvider: Optional Google Gemini 3.7 Flash provider.
 * Falls back to NoAIProvider if quota is exceeded or transient error occurs.
 */
export class GeminiProvider implements AIProvider {
  public name = 'gemini' as const;
  private fallback = new NoAIProvider();

  public isAvailable(): boolean {
    return geminiClient.isAvailable();
  }

  public async classifyOpportunity(
    title: string,
    description: string,
    companyName: string,
    targetRoles: string[] = [],
    targetSkills: string[] = []
  ): Promise<ClassifiedJob> {
    if (!this.isAvailable()) {
      return this.fallback.classifyOpportunity(title, description, companyName, targetRoles, targetSkills);
    }

    try {
      const prompt = `Classify this job opportunity at ${companyName}:
Title: ${title}
Description snippet: ${description ? description.slice(0, 500) : 'N/A'}
User target roles: ${targetRoles.join(', ')}
User target skills: ${targetSkills.join(', ')}

Return ONLY valid JSON matching this schema:
{
  "type": "FULL_TIME" | "INTERNSHIP" | "CONTRACT" | "PART_TIME" | "GRADUATE",
  "experienceLevel": "FRESHER" | "INTERN" | "JUNIOR" | "MID_LEVEL" | "SENIOR" | "UNKNOWN",
  "remote": "REMOTE" | "HYBRID" | "ON_SITE" | "UNKNOWN",
  "skills": string[],
  "responsibilities": string[],
  "requirements": string[],
  "salary": string | null,
  "relevanceScore": number (0-100)
}`;

      const text = await geminiClient.safeGenerateContent({
        prompt,
      });

      if (text) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            title,
            type: (parsed.type as OpportunityType) || 'FULL_TIME',
            experienceLevel: (parsed.experienceLevel as ExperienceLevel) || 'UNKNOWN',
            remote: parsed.remote || 'UNKNOWN',
            skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : ['Software Engineering'],
            responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
            requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
            salary: parsed.salary || null,
            relevanceScore: typeof parsed.relevanceScore === 'number' ? Math.min(100, Math.max(0, parsed.relevanceScore)) : 60,
          };
        }
      }
    } catch (err: any) {
      logger.warn(`[GeminiProvider] Job classification fell back to rule-engine: ${err?.message}`);
    }

    return this.fallback.classifyOpportunity(title, description, companyName, targetRoles, targetSkills);
  }

  public async generateEmail(context: {
    recipientName?: string | null;
    recipientRole?: string | null;
    companyName: string;
    candidateName: string;
    roleTitle: string;
    candidateSkills?: string[];
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    fallbackSubject: string;
    fallbackBody: string;
  }): Promise<EmailGenerationResult> {
    if (!this.isAvailable()) {
      return this.fallback.generateEmail(context);
    }

    try {
      const prompt = `Write a high-converting, professional cold outreach email for a startup engineering position:
Recipient: ${context.recipientName || 'Hiring Team'} (${context.recipientRole || 'Recruitment'})
Company: ${context.companyName}
Applicant: ${context.candidateName}
Target Role: ${context.roleTitle}
Skills: ${(context.candidateSkills || []).join(', ')}
Portfolio: ${context.portfolioUrl || 'N/A'}
GitHub: ${context.githubUrl || 'N/A'}

Rules:
1. Subject line must be concise and engaging.
2. Tone: humble, high-agency, professional.
3. Keep body under 160 words.
4. Return ONLY JSON: {"subject": "...", "body": "..."}`;

      const text = await geminiClient.safeGenerateContent({ prompt });
      if (text) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.subject && parsed.body) {
            return {
              subject: parsed.subject.trim(),
              body: parsed.body.trim(),
              source: 'ai_gemini',
            };
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[GeminiProvider] Email generation fell back to deterministic template: ${err?.message}`);
    }

    return this.fallback.generateEmail(context);
  }
}

/**
 * 3. LocalAIProvider: Optional Ollama / local LLM provider.
 */
export class LocalAIProvider implements AIProvider {
  public name = 'ollama' as const;
  private baseUrl: string;
  private model: string;
  private fallback = new NoAIProvider();

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    this.model = model || process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  }

  public isAvailable(): boolean {
    return Boolean(process.env.OLLAMA_BASE_URL);
  }

  public async classifyOpportunity(
    title: string,
    description: string,
    companyName: string,
    targetRoles: string[] = [],
    targetSkills: string[] = []
  ): Promise<ClassifiedJob> {
    if (!this.isAvailable()) {
      return this.fallback.classifyOpportunity(title, description, companyName, targetRoles, targetSkills);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `Classify job: ${title} at ${companyName}. Return JSON with type, experienceLevel, remote, relevanceScore.`,
          stream: false,
          format: 'json',
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const data = await response.json();
        const parsed = JSON.parse(data.response || '{}');
        return {
          title,
          type: parsed.type || 'FULL_TIME',
          experienceLevel: parsed.experienceLevel || 'UNKNOWN',
          remote: parsed.remote || 'UNKNOWN',
          skills: Array.isArray(parsed.skills) ? parsed.skills : ['Engineering'],
          responsibilities: [],
          requirements: [],
          salary: null,
          relevanceScore: parsed.relevanceScore || 50,
        };
      }
    } catch {
      // Fall through to heuristic
    }

    return this.fallback.classifyOpportunity(title, description, companyName, targetRoles, targetSkills);
  }

  public async generateEmail(context: {
    recipientName?: string | null;
    companyName: string;
    candidateName: string;
    roleTitle: string;
    fallbackSubject: string;
    fallbackBody: string;
  }): Promise<EmailGenerationResult> {
    return this.fallback.generateEmail(context);
  }
}

/**
 * Factory to retrieve the active AI Provider based on runtime environment
 */
export function getActiveAIProvider(): AIProvider {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
    process.env.GEMINI_API_KEY.trim() !== ''
  );

  if (hasGeminiKey) {
    return new GeminiProvider();
  }

  if (process.env.OLLAMA_BASE_URL) {
    return new LocalAIProvider();
  }

  return new NoAIProvider();
}
