/**
 * Opportunity Classifier
 * Analyzes job titles and descriptions to extract categories, internship tags,
 * fresher friendliness, and AI/ML relevance without artificially restricting jobs.
 */

import { OpportunityCategory, OpportunityType, AiMlRelevance, ExperienceLevel } from '../../types.ts';

export interface ClassificationResult {
  category: OpportunityCategory;
  type: OpportunityType;
  experienceLevel: ExperienceLevel;
  aiMlRelevance: AiMlRelevance;
  relevanceScore: number; // 0 - 100
  isInternship: boolean;
  isFresherFriendly: boolean;
  isGraduateRole: boolean;
  isApprenticeship: boolean;
  skills: string[];
}

const AI_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'neural network',
  'llm',
  'nlp',
  'natural language processing',
  'computer vision',
  'genai',
  'generative ai',
  'langchain',
  'pytorch',
  'tensorflow',
  'huggingface',
  'rag',
  'transformer',
  'prompt engineering',
  'agent',
  'data scientist',
];

const INTERNSHIP_KEYWORDS = [
  'intern',
  'internship',
  'trainee',
  'apprentice',
  'apprenticeship',
  'co-op',
  'coop',
  'fellowship',
  'summer analyst',
  'student',
  'graduate trainee',
  'management trainee',
];

const FRESHER_KEYWORDS = [
  'fresher',
  'graduate',
  'entry level',
  '0-1 year',
  '0 to 1 year',
  'junior',
  'associate',
  'campus',
  'new grad',
  'early career',
];

export function classifyOpportunity(title: string, description: string = ''): ClassificationResult {
  const combined = `${title} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // 1. Internship Detection
  const isInternship = INTERNSHIP_KEYWORDS.some((kw) => {
    // Word boundary check for short terms like 'co-op' or 'intern'
    const reg = new RegExp(`\\b${kw}\\b`, 'i');
    return reg.test(titleLower) || reg.test(description.slice(0, 500));
  });

  const isApprenticeship = titleLower.includes('apprentice') || combined.includes('apprenticeship');
  const isGraduateRole = titleLower.includes('graduate') || titleLower.includes('campus') || titleLower.includes('new grad');
  const isFresherFriendly =
    isInternship ||
    isGraduateRole ||
    FRESHER_KEYWORDS.some((kw) => titleLower.includes(kw) || combined.slice(0, 500).includes(kw));

  // 2. Experience Level
  let experienceLevel: ExperienceLevel = 'MID';
  if (isInternship) {
    experienceLevel = 'INTERN';
  } else if (isFresherFriendly || titleLower.includes('junior') || titleLower.includes('associate')) {
    experienceLevel = 'ENTRY_LEVEL';
  } else if (titleLower.includes('lead') || titleLower.includes('staff') || titleLower.includes('principal') || titleLower.includes('architect')) {
    experienceLevel = 'LEAD';
  } else if (titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('sr ')) {
    experienceLevel = 'SENIOR';
  } else if (titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('head of')) {
    experienceLevel = 'EXECUTIVE';
  }

  // 3. Opportunity Category
  let category: OpportunityCategory = 'Software Engineering';
  if (titleLower.includes('data') || titleLower.includes('analytics') || titleLower.includes('bi analyst')) {
    category = 'Data Science';
  } else if (AI_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(titleLower))) {
    category = 'AI / ML';
  } else if (titleLower.includes('product') || titleLower.includes('program manager')) {
    category = 'Product';
  } else if (titleLower.includes('design') || titleLower.includes('ux') || titleLower.includes('ui')) {
    category = 'Design';
  } else if (titleLower.includes('devops') || titleLower.includes('sre') || titleLower.includes('cloud') || titleLower.includes('infrastructure')) {
    category = 'DevOps';
  } else if (titleLower.includes('qa') || titleLower.includes('test') || titleLower.includes('quality')) {
    category = 'QA / Testing';
  } else if (titleLower.includes('sales') || titleLower.includes('business development') || titleLower.includes('account executive')) {
    category = 'Sales';
  } else if (titleLower.includes('marketing') || titleLower.includes('growth') || titleLower.includes('seo') || titleLower.includes('content')) {
    category = 'Marketing';
  } else if (titleLower.includes('hr') || titleLower.includes('recruiter') || titleLower.includes('talent') || titleLower.includes('people')) {
    category = 'HR';
  } else if (titleLower.includes('finance') || titleLower.includes('accountant') || titleLower.includes('payroll')) {
    category = 'Finance';
  } else if (titleLower.includes('operations') || titleLower.includes('support') || titleLower.includes('customer success')) {
    category = 'Operations';
  }

  // 4. AI/ML Relevance Score
  let aiMatches = 0;
  for (const kw of AI_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(titleLower)) aiMatches += 3;
    else if (new RegExp(`\\b${kw}\\b`, 'i').test(combined)) aiMatches += 1;
  }

  let aiMlRelevance: AiMlRelevance = 'NONE';
  let relevanceScore = 40; // baseline tech relevance

  if (aiMatches >= 4) {
    aiMlRelevance = 'CORE_AI_ML';
    relevanceScore = Math.min(98, 85 + aiMatches * 2);
  } else if (aiMatches >= 2) {
    aiMlRelevance = 'AI_ADJACENT';
    relevanceScore = Math.min(84, 70 + aiMatches * 3);
  } else if (aiMatches === 1) {
    aiMlRelevance = 'AI_APPLIED';
    relevanceScore = 60;
  } else if (category === 'Software Engineering' || category === 'Data Science') {
    aiMlRelevance = 'LOW';
    relevanceScore = 55;
  }

  // Opportunity Type
  const type: OpportunityType = isInternship ? 'INTERNSHIP' : 'FULL_TIME';

  // 5. Skills extraction
  const skillList = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Go', 'Golang', 'Java', 'Kotlin', 'C++',
    'Rust', 'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis',
    'PyTorch', 'TensorFlow', 'LLM', 'GraphQL', 'Next.js', 'Tailwind', 'Kafka', 'Spark', 'Figma'
  ];
  const skills: string[] = [];
  for (const sk of skillList) {
    if (new RegExp(`\\b${sk.replace('+', '\\+')}\\b`, 'i').test(combined)) {
      skills.push(sk);
    }
  }

  return {
    category,
    type,
    experienceLevel,
    aiMlRelevance,
    relevanceScore,
    isInternship,
    isFresherFriendly,
    isGraduateRole,
    isApprenticeship,
    skills,
  };
}
