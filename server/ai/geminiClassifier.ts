import { Type } from '@google/genai';
import { OpportunityType, ExperienceLevel, EmailType } from '../types.ts';
import { classifyEmailType, verifyExactMatchInSource } from '../extractors/email.extractor.ts';
import { geminiClient } from './geminiClient.ts';

export interface ClassifiedJob {
  title: string;
  type: OpportunityType;
  experienceLevel: ExperienceLevel;
  remote: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN';
  skills: string[];
  responsibilities: string[];
  requirements: string[];
  salary: string | null;
  relevanceScore: number;
}

export interface ClassifiedEmail {
  email: string | null;
  emailType: EmailType;
  isRecruitingRelated: boolean;
  name?: string | null;
  role?: string | null;
  confidence: number;
  supportedByEvidence: boolean;
}

// Fallback rule-based intelligence when Gemini key is not provided or rate limited
export function heuristicClassifyJob(
  title: string,
  rawDescription: string,
  targetRoles: string[],
  targetSkills: string[]
): ClassifiedJob {
  const text = `${title} ${rawDescription}`.toLowerCase();

  // Opportunity Type
  let type: OpportunityType = 'FULL_TIME';
  if (text.includes('intern') || text.includes('internship') || text.includes('summer analyst')) {
    type = 'INTERNSHIP';
  } else if (text.includes('contract') || text.includes('freelance') || text.includes('contractor')) {
    type = 'CONTRACT';
  } else if (text.includes('trainee') || text.includes('bootcamp')) {
    type = 'TRAINEE';
  } else if (text.includes('apprentice') || text.includes('apprenticeship')) {
    type = 'APPRENTICESHIP';
  } else if (text.includes('graduate') || text.includes('campus hire')) {
    type = 'GRADUATE';
  } else if (text.includes('part-time') || text.includes('part time')) {
    type = 'PART_TIME';
  }

  // Experience Level
  let experienceLevel: ExperienceLevel = 'UNKNOWN';
  if (type === 'INTERNSHIP') {
    experienceLevel = 'INTERN';
  } else if (text.includes('fresher') || text.includes('0-1 year') || text.includes('0 - 1 year') || text.includes('entry level') || text.includes('entry-level')) {
    experienceLevel = 'FRESHER';
  } else if (text.includes('junior') || text.includes('assoc') || text.includes('1-2 year') || text.includes('1 - 2 year')) {
    experienceLevel = 'JUNIOR';
  } else if (text.includes('senior') || text.includes('lead') || text.includes('principal') || text.includes('staff') || text.includes('5+ year')) {
    experienceLevel = 'SENIOR';
  } else if (text.includes('mid') || text.includes('2-4 year') || text.includes('3-5 year')) {
    experienceLevel = 'MID';
  } else if (type === 'GRADUATE') {
    experienceLevel = 'ENTRY_LEVEL';
  }

  // Remote
  let remote: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN' = 'UNKNOWN';
  if (text.includes('remote') || text.includes('work from anywhere') || text.includes('wfh')) {
    remote = 'REMOTE';
  } else if (text.includes('hybrid')) {
    remote = 'HYBRID';
  } else if (text.includes('on-site') || text.includes('onsite') || text.includes('in office') || text.includes('in-office')) {
    remote = 'ON_SITE';
  }

  // Skills
  const commonTech = [
    'Python', 'PyTorch', 'TensorFlow', 'LLM', 'Generative AI', 'Transformers', 'FastAPI',
    'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'GCP',
    'LangChain', 'LlamaIndex', 'NLP', 'Computer Vision', 'Redis', 'GraphQL', 'Go', 'Rust',
    'Java', 'C++', 'SQL', 'MongoDB', 'Next.js', 'Tailwind', 'Kafka', 'Spark', 'HuggingFace'
  ];
  const detectedSkills = commonTech.filter((skill) =>
    new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rawDescription + ' ' + title)
  );

  // Relevance Scoring (0-100)
  let score = 30; // base score for any tech job
  const titleLower = title.toLowerCase();

  // High value AI / ML terms
  const aiTerms = ['ai', 'ml', 'machine learning', 'artificial intelligence', 'genai', 'generative ai', 'llm', 'nlp', 'vision', 'agent', 'deep learning', 'data science'];
  const hasAiTitle = aiTerms.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(titleLower));
  if (hasAiTitle) score += 40;

  // Backend / Python / Engineering
  const techTerms = ['python', 'backend', 'software engineer', 'full stack', 'data engineer', 'cloud', 'systems', 'platform'];
  const hasTechTitle = techTerms.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(titleLower));
  if (hasTechTitle) score += 20;

  // Early career boost for student/fresher/intern
  if (type === 'INTERNSHIP' || experienceLevel === 'FRESHER' || experienceLevel === 'ENTRY_LEVEL' || experienceLevel === 'JUNIOR') {
    score += 15;
  }

  // Skill matches
  const targetMatchCount = targetSkills.filter((ts) => detectedSkills.includes(ts)).length;
  score += Math.min(15, targetMatchCount * 5);

  score = Math.min(100, Math.max(10, score));

  return {
    title,
    type,
    experienceLevel,
    remote,
    skills: detectedSkills.length > 0 ? detectedSkills : ['Software Engineering'],
    responsibilities: [
      `Contribute to core engineering and feature development for ${title}`,
      `Collaborate with cross-functional teams to build reliable software solutions`,
      `Maintain clean code standards, tests, and documentation`
    ],
    requirements: [
      `Experience with relevant technologies (${detectedSkills.slice(0, 3).join(', ') || 'Software Development'})`,
      `Strong analytical problem solving and communication skills`,
      `Degree or practical equivalent in Computer Science or related technical discipline`
    ],
    salary: null,
    relevanceScore: score,
  };
}

export async function classifyJobWithGemini(
  title: string,
  rawDescription: string,
  companyName: string,
  targetRoles: string[],
  targetSkills: string[]
): Promise<ClassifiedJob> {
  if (!geminiClient.isAvailable()) {
    return heuristicClassifyJob(title, rawDescription, targetRoles, targetSkills);
  }

  try {
    const prompt = `Analyze this real job listing at startup "${companyName}":
Title: "${title}"
Raw Text/Snippet:
"""
${rawDescription.slice(0, 2000)}
"""

Target Candidate Preferences:
- Target roles: ${targetRoles.slice(0, 10).join(', ')}
- Target skills: ${targetSkills.slice(0, 10).join(', ')}

Extract the following in strict JSON format:
1. type: one of "FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "APPRENTICESHIP", "TRAINEE", "GRADUATE", "OTHER"
2. experienceLevel: one of "INTERN", "FRESHER", "ENTRY_LEVEL", "JUNIOR", "MID", "SENIOR", "UNKNOWN"
3. remote: one of "REMOTE", "HYBRID", "ON_SITE", "UNKNOWN"
4. skills: array of distinct string technologies mentioned in text
5. responsibilities: array of up to 4 key responsibilities
6. requirements: array of up to 4 key requirements
7. salary: string or null if explicitly stated
8. relevanceScore: integer 0 to 100 based on fit for AI/ML/Python/Backend/Software/Intern/Fresher roles.

Strictly adhere to facts in the text. Do not invent details.`;

    if (!geminiClient.isAvailable()) {
      return heuristicClassifyJob(title, rawDescription, targetRoles, targetSkills);
    }

    const text = await geminiClient.safeGenerateContent({
      prompt,
      config: {
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
            relevanceScore: { type: Type.INTEGER },
          },
          required: ['type', 'experienceLevel', 'remote', 'skills', 'responsibilities', 'requirements', 'relevanceScore'],
        },
      },
    });

    if (!text) {
      return heuristicClassifyJob(title, rawDescription, targetRoles, targetSkills);
    }

    const parsed = JSON.parse(text || '{}');
    return {
      title,
      type: (parsed.type as OpportunityType) || 'FULL_TIME',
      experienceLevel: (parsed.experienceLevel as ExperienceLevel) || 'UNKNOWN',
      remote: parsed.remote || 'UNKNOWN',
      skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : ['Software Engineering'],
      responsibilities: Array.isArray(parsed.responsibilities) && parsed.responsibilities.length > 0 ? parsed.responsibilities : [`Deliver high quality engineering contributions`],
      requirements: Array.isArray(parsed.requirements) && parsed.requirements.length > 0 ? parsed.requirements : [`Proficiency in relevant software tools`],
      salary: parsed.salary || null,
      relevanceScore: typeof parsed.relevanceScore === 'number' ? Math.min(100, Math.max(0, parsed.relevanceScore)) : 50,
    };
  } catch (err) {
    return heuristicClassifyJob(title, rawDescription, targetRoles, targetSkills);
  }
}

/**
 * Classifies an email strictly according to evidence and rules.
 * NEVER fabricates an email address.
 */
export function classifyEmail(email: string, context = ''): ClassifiedEmail {
  const emailType = classifyEmailType(email, context);
  const isRecruitingRelated =
    emailType === 'CAREERS' ||
    emailType === 'TALENT' ||
    emailType === 'RECRUITING' ||
    emailType === 'CAMPUS_HIRING' ||
    emailType === 'HR';

  return {
    email,
    emailType,
    isRecruitingRelated,
    confidence: 90,
    supportedByEvidence: true,
  };
}

/**
 * AI-assisted classification of contact context with strict anti-hallucination constraint
 */
export async function classifyContactWithGemini(
  rawSnippet: string,
  companyName: string
): Promise<ClassifiedEmail> {
  if (!geminiClient.isAvailable()) {
    return {
      email: null,
      emailType: 'GENERAL_CONTACT',
      isRecruitingRelated: false,
      confidence: 50,
      supportedByEvidence: false,
    };
  }

  try {
    const prompt = `You are an evidence extraction system for recruitment contacts at "${companyName}".
You are strictly FORBIDDEN from inventing, guessing, inferring, completing, or generating email addresses.
You may only return an email address if the EXACT address appears verbatim in the supplied snippet.
If no exact email appears in the snippet, return email: null.
Do not construct an email from a person's name and company domain.
Do not guess hr@${companyName}.com or careers@${companyName}.com.

Source Snippet:
"""
${rawSnippet.slice(0, 1500)}
"""

Return a strict JSON object with:
- email: string | null (verbatim exact email from snippet only, otherwise null)
- emailType: "CAREERS" | "RECRUITING" | "TALENT" | "HR" | "CAMPUS_HIRING" | "FOUNDER" | "GENERAL_COMPANY" | "GENERAL_CONTACT"
- name: string | null (name of recruiter or founder if explicitly mentioned)
- role: string | null (job title/role if mentioned)
- supportedByEvidence: boolean`;

    const text = await geminiClient.safeGenerateContent({
      prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            email: { type: Type.STRING, nullable: true },
            emailType: { type: Type.STRING },
            name: { type: Type.STRING, nullable: true },
            role: { type: Type.STRING, nullable: true },
            supportedByEvidence: { type: Type.BOOLEAN },
          },
          required: ['emailType', 'supportedByEvidence'],
        },
      },
    });

    if (!text) {
      return {
        email: null,
        emailType: 'GENERAL_CONTACT',
        isRecruitingRelated: false,
        confidence: 40,
        supportedByEvidence: false,
      };
    }

    const parsed = JSON.parse(text || '{}');
    let email = parsed.email || null;

    // Hard backend verification: if AI returned an email, verify it actually exists in the snippet
    if (email && !verifyExactMatchInSource(email, rawSnippet)) {
      email = null;
    }

    const emailType = (parsed.emailType as EmailType) || 'GENERAL_CONTACT';
    const isRecruiting =
      emailType === 'CAREERS' ||
      emailType === 'TALENT' ||
      emailType === 'RECRUITING' ||
      emailType === 'CAMPUS_HIRING' ||
      emailType === 'HR';

    return {
      email,
      emailType,
      isRecruitingRelated: isRecruiting,
      name: parsed.name || null,
      role: parsed.role || null,
      confidence: email ? 90 : 60,
      supportedByEvidence: Boolean(email),
    };
  } catch (err) {
    return {
      email: null,
      emailType: 'GENERAL_CONTACT',
      isRecruitingRelated: false,
      confidence: 40,
      supportedByEvidence: false,
    };
  }
}
