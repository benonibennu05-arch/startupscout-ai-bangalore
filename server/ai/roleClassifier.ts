import {
  OpportunityCategory,
  AiMlRelevance,
  ExperienceLevel,
  OpportunityType,
  RemotePolicy,
  CandidateProfile,
} from '../types.ts';

export interface RoleClassificationResult {
  category: OpportunityCategory;
  aiMlRelevance: AiMlRelevance;
  type: OpportunityType;
  experienceLevel: ExperienceLevel;
  remote: RemotePolicy;
  isFresherFriendly: boolean;
  isInternship: boolean;
  skills: string[];
  relevanceScore: number;
  personalMatchScore: number;
  jobFingerprint: string;
}

export function generateJobFingerprint(companyName: string, title: string, location?: string): string {
  const normCompany = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normLoc = (location || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${normCompany}_${normTitle}_${normLoc}`;
}

export function classifyRole(
  title: string,
  rawDescription: string = '',
  companyName: string = '',
  location: string = 'Bangalore, India',
  candidate?: CandidateProfile
): RoleClassificationResult {
  const text = `${title} ${rawDescription}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // 1. Employment Type
  let type: OpportunityType = 'FULL_TIME';
  if (
    text.includes('intern') ||
    text.includes('internship') ||
    text.includes('trainee') ||
    text.includes('fellowship') ||
    text.includes('apprentice')
  ) {
    type = 'INTERNSHIP';
  } else if (text.includes('contract') || text.includes('freelance') || text.includes('consultant')) {
    type = 'CONTRACT';
  } else if (text.includes('part-time') || text.includes('part time')) {
    type = 'PART_TIME';
  } else if (text.includes('graduate') || text.includes('campus')) {
    type = 'GRADUATE';
  }

  // 2. Experience Level
  let experienceLevel: ExperienceLevel = 'UNKNOWN';
  if (type === 'INTERNSHIP') {
    experienceLevel = 'INTERN';
  } else if (
    text.includes('fresher') ||
    text.includes('0-1 year') ||
    text.includes('0 to 1 year') ||
    text.includes('entry level') ||
    text.includes('entry-level') ||
    text.includes('fresh graduate') ||
    text.includes('college hire')
  ) {
    experienceLevel = 'FRESHER';
  } else if (
    text.includes('junior') ||
    text.includes('associate') ||
    text.includes('1-2 year') ||
    text.includes('1 to 2 year') ||
    text.includes('1-3 year')
  ) {
    experienceLevel = 'JUNIOR';
  } else if (
    text.includes('director') ||
    text.includes('vp ') ||
    text.includes('vice president') ||
    text.includes('head of')
  ) {
    experienceLevel = 'DIRECTOR';
  } else if (
    text.includes('lead') ||
    text.includes('principal') ||
    text.includes('staff') ||
    text.includes('architect') ||
    text.includes('manager')
  ) {
    experienceLevel = text.includes('manager') ? 'MANAGER' : 'LEAD';
  } else if (
    text.includes('senior') ||
    text.includes('sr.') ||
    text.includes('sr ') ||
    text.includes('5+ year') ||
    text.includes('6+ year') ||
    text.includes('7+ year')
  ) {
    experienceLevel = 'SENIOR';
  } else if (
    text.includes('mid') ||
    text.includes('2-4 year') ||
    text.includes('2-5 year') ||
    text.includes('3-5 year') ||
    text.includes('3+ year')
  ) {
    experienceLevel = 'MID';
  } else if (type === 'GRADUATE') {
    experienceLevel = 'ENTRY_LEVEL';
  }

  // 3. Category Detection
  let category: OpportunityCategory = 'Other';

  if (
    /\b(ai|artificial intelligence|machine learning|ml|deep learning|genai|generative ai|llm|large language model|agentic|nlp|computer vision|vision|speech ai|transformers|diffusion|prompt|reinforcement learning|mlops|ai research)\b/i.test(
      titleLower
    )
  ) {
    category = 'AI / ML';
  } else if (/\b(data science|data scientist)\b/i.test(titleLower)) {
    category = 'Data Science';
  } else if (/\b(data engineer|data platform|etl|pipeline|spark|kafka|databricks|snowflake)\b/i.test(titleLower)) {
    category = 'Data Engineering';
  } else if (/\b(data analyst|business analyst|bi analyst|tableau|power bi|analytics)\b/i.test(titleLower)) {
    category = 'Data Analytics';
  } else if (/\b(backend|back-end|node|python developer|golang|go engineer|java engineer|rust|c\+\+|api engineer|database)\b/i.test(titleLower)) {
    category = 'Backend';
  } else if (/\b(frontend|front-end|react|vue|angular|ui developer|web developer|nextjs)\b/i.test(titleLower)) {
    category = 'Frontend';
  } else if (/\b(full stack|fullstack|full-stack)\b/i.test(titleLower)) {
    category = 'Full Stack';
  } else if (/\b(mobile|android|ios|flutter|react native|swift|kotlin)\b/i.test(titleLower)) {
    category = 'Mobile';
  } else if (/\b(devops|sre|site reliability|infrastructure|cloud|kubernetes|docker|aws|gcp|platform engineer)\b/i.test(titleLower)) {
    category = 'DevOps';
  } else if (/\b(security|cybersecurity|infosec|soc|penetration)\b/i.test(titleLower)) {
    category = 'Cybersecurity';
  } else if (/\b(qa|quality assurance|sdet|test engineer|automation testing)\b/i.test(titleLower)) {
    category = 'QA / Testing';
  } else if (/\b(product manager|product owner|apm|associate product manager|technical product manager)\b/i.test(titleLower)) {
    category = 'Product Management';
  } else if (/\b(product|growth product)\b/i.test(titleLower)) {
    category = 'Product';
  } else if (/\b(ui\/ux|ux\/ui|ux designer|product designer|graphic designer|visual designer|brand designer|design)\b/i.test(titleLower)) {
    category = 'Design';
  } else if (/\b(marketing|growth|seo|content|social media|brand marketing|performance marketing)\b/i.test(titleLower)) {
    category = 'Marketing';
  } else if (/\b(sales|account executive|sdr|bdr|inside sales|revenue|enterprise sales)\b/i.test(titleLower)) {
    category = 'Sales';
  } else if (/\b(business development|bizdev|partnerships|alliances)\b/i.test(titleLower)) {
    category = 'Business Development';
  } else if (/\b(operations|supply chain|logistics|procurement|strategy & ops)\b/i.test(titleLower)) {
    category = 'Operations';
  } else if (/\b(finance|accountant|fp&a|accounting|tax|auditor|payroll)\b/i.test(titleLower)) {
    category = 'Finance';
  } else if (/\b(hr|human resources|people ops|talent partner|recruiter|recruiting|talent acquisition)\b/i.test(titleLower)) {
    category = 'HR';
  } else if (/\b(customer success|support engineer|customer support|client success)\b/i.test(titleLower)) {
    category = 'Customer Success';
  } else if (/\b(software engineer|software developer|swe|developer|programmer|engineer)\b/i.test(titleLower)) {
    category = 'Software Engineering';
  } else if (/\b(researcher|scientist|research scientist)\b/i.test(titleLower)) {
    category = 'Research';
  } else if (/\b(legal|counsel|paralegal|compliance)\b/i.test(titleLower)) {
    category = 'Legal';
  }

  // 4. AI/ML Relevance Determination
  let aiMlRelevance: AiMlRelevance = 'NONE';
  const hasStrongAiKeyword = /\b(ai|artificial intelligence|machine learning|ml|deep learning|genai|generative ai|llm|large language models|agentic|autonomous agents|nlp|natural language|computer vision|speech ai|transformers|diffusion|prompt engineer|reinforcement learning|mlops|ai researcher|rag|vector search)\b/i.test(
    titleLower
  );

  const hasDescriptionAi = /\b(pytorch|tensorflow|hugging face|langchain|llamaindex|vector database|fine-tuning|openai|gemini|anthropic|machine learning model|neural network|embedding)\b/i.test(
    text
  );

  if (hasStrongAiKeyword) {
    aiMlRelevance = 'HIGH';
  } else if (
    category === 'Data Science' ||
    (category === 'Data Engineering' && hasDescriptionAi) ||
    ((category === 'Backend' || category === 'Software Engineering' || category === 'Full Stack') && hasDescriptionAi)
  ) {
    aiMlRelevance = 'MEDIUM';
  } else if (
    category === 'Software Engineering' ||
    category === 'Backend' ||
    category === 'Frontend' ||
    category === 'Full Stack' ||
    category === 'Data Analytics' ||
    category === 'DevOps'
  ) {
    aiMlRelevance = 'LOW';
  } else {
    aiMlRelevance = 'NONE';
  }

  // 5. Remote Policy
  let remote: RemotePolicy = 'UNKNOWN';
  if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) {
    remote = 'REMOTE';
  } else if (text.includes('hybrid')) {
    remote = 'HYBRID';
  } else if (text.includes('on-site') || text.includes('onsite') || text.includes('in office') || text.includes('in-office')) {
    remote = 'ON_SITE';
  }

  // 6. Skills Extraction
  const knownSkills = [
    'Python', 'PyTorch', 'TensorFlow', 'LLM', 'Generative AI', 'Transformers', 'FastAPI',
    'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'GCP',
    'LangChain', 'LlamaIndex', 'NLP', 'Computer Vision', 'Redis', 'GraphQL', 'Go', 'Rust',
    'Java', 'C++', 'SQL', 'Kafka', 'Spark', 'Figma', 'Next.js', 'Tailwind CSS', 'Scikit-Learn',
    'MongoDB', 'CI/CD', 'Git', 'Linux'
  ];

  const skills = knownSkills.filter((s) => {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i').test(text);
    } catch {
      return text.includes(s.toLowerCase());
    }
  });

  if (skills.length === 0) {
    if (category === 'AI / ML') skills.push('Python', 'PyTorch', 'Machine Learning');
    else if (category === 'Backend') skills.push('Python', 'PostgreSQL', 'APIs');
    else if (category === 'Frontend') skills.push('React', 'TypeScript', 'CSS');
    else if (category === 'Design') skills.push('Figma', 'UI/UX Design');
    else if (category === 'Product Management') skills.push('Product Roadmap', 'Analytics');
    else skills.push('Problem Solving', 'Communication');
  }

  // 7. Relevance & Personal Match Score (Targeted to Teja Matta: AI/ML & Software, PyTorch, LangChain, Python)
  let relevanceScore = 40;
  if (category === 'AI / ML') relevanceScore += 40;
  else if (category === 'Data Science') relevanceScore += 30;
  else if (category === 'Backend' || category === 'Software Engineering' || category === 'Full Stack') relevanceScore += 20;
  else if (category === 'Data Engineering' || category === 'DevOps') relevanceScore += 15;

  if (type === 'INTERNSHIP' || experienceLevel === 'INTERN' || experienceLevel === 'FRESHER' || experienceLevel === 'ENTRY_LEVEL') {
    relevanceScore += 15;
  }
  relevanceScore = Math.min(100, Math.max(15, relevanceScore));

  // Personal Match Score specifically for candidate
  let personalMatchScore = 35;
  if (aiMlRelevance === 'HIGH') personalMatchScore += 45;
  else if (aiMlRelevance === 'MEDIUM') personalMatchScore += 30;
  else if (aiMlRelevance === 'LOW') personalMatchScore += 15;

  if (type === 'INTERNSHIP' || experienceLevel === 'INTERN' || experienceLevel === 'FRESHER' || experienceLevel === 'JUNIOR') {
    personalMatchScore += 15;
  }

  const matchedSkillsCount = skills.filter((sk) =>
    ['Python', 'PyTorch', 'TensorFlow', 'Generative AI', 'LLMs', 'LangChain', 'FastAPI', 'TypeScript', 'Node.js', 'PostgreSQL'].includes(sk)
  ).length;
  personalMatchScore += Math.min(15, matchedSkillsCount * 3);
  personalMatchScore = Math.min(99, Math.max(20, personalMatchScore));

  const isFresherFriendly =
    type === 'INTERNSHIP' ||
    experienceLevel === 'INTERN' ||
    experienceLevel === 'FRESHER' ||
    experienceLevel === 'ENTRY_LEVEL' ||
    experienceLevel === 'JUNIOR';

  const isInternship = type === 'INTERNSHIP' || experienceLevel === 'INTERN';

  const jobFingerprint = generateJobFingerprint(companyName, title, location);

  return {
    category,
    aiMlRelevance,
    type,
    experienceLevel,
    remote,
    isFresherFriendly,
    isInternship,
    skills,
    relevanceScore,
    personalMatchScore,
    jobFingerprint,
  };
}
