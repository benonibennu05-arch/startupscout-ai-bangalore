import { GoogleGenAI, Type } from '@google/genai';
import { OpportunityType, ExperienceLevel, EmailType } from '../types.ts';
import { SYSTEM_PROMPTS, buildJobClassificationPrompt } from './prompts.ts';
import { logger } from '../utils/logger.ts';

let aiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface ClassifiedJobResult {
  title: string;
  type: OpportunityType;
  experienceLevel: ExperienceLevel;
  remote: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN';
  skills: string[];
  responsibilities: string[];
  requirements: string[];
  salary: string | null;
  isFresherFriendly: boolean;
  relevanceScore: number;
}

export class GeminiService {
  /**
   * Classify an opportunity using Gemini with structured JSON schema
   */
  public async classifyOpportunity(
    title: string,
    description: string,
    companyName: string,
    targetRoles: string[] = [],
    targetSkills: string[] = []
  ): Promise<ClassifiedJobResult> {
    const ai = getGenAiClient();
    if (!ai) {
      return this.heuristicClassify(title, description, targetRoles, targetSkills);
    }

    try {
      const prompt = buildJobClassificationPrompt(title, description, companyName, targetRoles, targetSkills);

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPTS.JOB_CLASSIFIER,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              experienceLevel: { type: Type.STRING },
              remote: { type: Type.STRING },
              skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
              requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
              salary: { type: Type.STRING, nullable: true },
              isFresherFriendly: { type: Type.BOOLEAN },
              relevanceScore: { type: Type.INTEGER },
            },
            required: ['type', 'experienceLevel', 'remote', 'skills', 'responsibilities', 'requirements', 'relevanceScore'],
          },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      const parsed = JSON.parse(text);
      return {
        title,
        type: (parsed.type as OpportunityType) || 'FULL_TIME',
        experienceLevel: (parsed.experienceLevel as ExperienceLevel) || 'UNKNOWN',
        remote: parsed.remote || 'UNKNOWN',
        skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : ['Software Development'],
        responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
        requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
        salary: parsed.salary || null,
        isFresherFriendly: Boolean(parsed.isFresherFriendly),
        relevanceScore: typeof parsed.relevanceScore === 'number' ? Math.min(100, Math.max(0, parsed.relevanceScore)) : 50,
      };
    } catch (err: any) {
      logger.warn(`Gemini AI classification fallback for "${title}": ${err?.message}`);
      return this.heuristicClassify(title, description, targetRoles, targetSkills);
    }
  }

  /**
   * Rule-based heuristic fallback if Gemini key is unset or network error occurs
   */
  public heuristicClassify(
    title: string,
    rawDescription: string,
    targetRoles: string[] = [],
    targetSkills: string[] = []
  ): ClassifiedJobResult {
    const text = `${title} ${rawDescription}`.toLowerCase();

    // Type
    let type: OpportunityType = 'FULL_TIME';
    if (text.includes('intern') || text.includes('internship') || text.includes('trainee')) {
      type = 'INTERNSHIP';
    } else if (text.includes('graduate') || text.includes('campus hire')) {
      type = 'GRADUATE';
    } else if (text.includes('contract') || text.includes('freelance')) {
      type = 'CONTRACT';
    }

    // Experience
    let experienceLevel: ExperienceLevel = 'UNKNOWN';
    if (type === 'INTERNSHIP') {
      experienceLevel = 'INTERN';
    } else if (text.includes('fresher') || text.includes('0-1 year') || text.includes('entry level') || text.includes('entry-level')) {
      experienceLevel = 'FRESHER';
    } else if (text.includes('junior') || text.includes('associate') || text.includes('1-2 year')) {
      experienceLevel = 'JUNIOR';
    } else if (text.includes('senior') || text.includes('lead') || text.includes('principal') || text.includes('5+ year')) {
      experienceLevel = 'SENIOR';
    } else if (text.includes('mid') || text.includes('2-4 year') || text.includes('3-5 year')) {
      experienceLevel = 'MID';
    } else if (type === 'GRADUATE') {
      experienceLevel = 'ENTRY_LEVEL';
    }

    // Remote
    let remote: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN' = 'UNKNOWN';
    if (text.includes('remote') || text.includes('wfh')) remote = 'REMOTE';
    else if (text.includes('hybrid')) remote = 'HYBRID';
    else if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office')) remote = 'ON_SITE';

    // Skills
    const knownSkills = [
      'Python', 'PyTorch', 'TensorFlow', 'LLM', 'Generative AI', 'Transformers', 'FastAPI',
      'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'GCP',
      'LangChain', 'LlamaIndex', 'NLP', 'Computer Vision', 'Redis', 'GraphQL', 'Go', 'Rust',
      'Java', 'C++', 'C#', 'SQL', 'Kafka', 'Spark'
    ];
    const fullText = `${title} ${rawDescription}`.toLowerCase();
    const skills = knownSkills.filter((s) => {
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        return new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i').test(fullText);
      } catch {
        return fullText.includes(s.toLowerCase());
      }
    });

    // Relevance score calculation
    let relevanceScore = 35;
    const titleLower = title.toLowerCase();

    if (['ai', 'ml', 'machine learning', 'genai', 'generative ai', 'llm', 'nlp', 'vision'].some((w) => titleLower.includes(w))) {
      relevanceScore += 45;
    } else if (['software', 'backend', 'developer', 'python', 'engineer', 'data'].some((w) => titleLower.includes(w))) {
      relevanceScore += 25;
    }

    if (type === 'INTERNSHIP' || experienceLevel === 'FRESHER' || experienceLevel === 'JUNIOR') {
      relevanceScore += 15;
    }

    const matchedTargetSkills = targetSkills.filter((ts) => skills.includes(ts)).length;
    relevanceScore += Math.min(15, matchedTargetSkills * 5);
    relevanceScore = Math.min(100, Math.max(10, relevanceScore));

    const isFresherFriendly =
      type === 'INTERNSHIP' ||
      experienceLevel === 'FRESHER' ||
      experienceLevel === 'ENTRY_LEVEL' ||
      experienceLevel === 'JUNIOR' ||
      experienceLevel === 'INTERN';

    return {
      title,
      type,
      experienceLevel,
      remote,
      skills: skills.length > 0 ? skills : ['Software Engineering'],
      responsibilities: [`Contribute to design and engineering for ${title}`],
      requirements: [`Background in computer science, programming, or equivalent practical skills`],
      salary: null,
      isFresherFriendly,
      relevanceScore,
    };
  }

  public classifyEmail(email: string): { emailType: EmailType; isRecruiting: boolean } {
    const lower = email.toLowerCase();
    if (lower.startsWith('career') || lower.startsWith('careers') || lower.includes('.careers@')) {
      return { emailType: 'CAREERS', isRecruiting: true };
    }
    if (lower.startsWith('job') || lower.startsWith('jobs') || lower.includes('.jobs@')) {
      return { emailType: 'RECRUITING', isRecruiting: true };
    }
    if (lower.startsWith('talent') || lower.startsWith('hiring') || lower.startsWith('recruiting')) {
      return { emailType: 'TALENT', isRecruiting: true };
    }
    if (lower.startsWith('hr') || lower.startsWith('people') || lower.includes('@hr.')) {
      return { emailType: 'HR', isRecruiting: true };
    }
    return { emailType: 'GENERAL_CONTACT', isRecruiting: false };
  }
}

export const geminiService = new GeminiService();
