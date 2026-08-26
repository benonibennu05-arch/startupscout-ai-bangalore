export const SYSTEM_PROMPTS = {
  JOB_CLASSIFIER: `You are an expert technical recruiter and intelligence analyst evaluating real job listings for Bangalore startups.
Your goal is to parse retrieved job listing texts, extracting verified roles, identifying internships, early-career eligibility, tech stack, and calculating a relevance score (0-100) based on candidate preferences.
Strict Evidence Rule: Base your answers ONLY on the provided job text. Do not invent or assume details not present.`,
};

export function buildJobClassificationPrompt(
  title: string,
  rawDescription: string,
  companyName: string,
  targetRoles: string[],
  targetSkills: string[]
): string {
  return `Analyze this verified startup opportunity:
Company: "${companyName}"
Job Title: "${title}"
Snippet / Content:
"""
${rawDescription.slice(0, 3000)}
"""

Target Preferences:
- Preferred Roles: ${targetRoles.slice(0, 15).join(', ')}
- Preferred Skills: ${targetSkills.slice(0, 15).join(', ')}

Return a strict JSON object with:
- type: "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT" | "APPRENTICESHIP" | "TRAINEE" | "GRADUATE" | "OTHER"
- experienceLevel: "INTERN" | "FRESHER" | "ENTRY_LEVEL" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE" | "UNKNOWN"
- remote: "REMOTE" | "HYBRID" | "ON_SITE" | "UNKNOWN"
- skills: array of specific technologies/tools mentioned
- responsibilities: array of up to 4 key tasks
- requirements: array of up to 4 key requirements
- salary: string if compensation/stipend is explicitly stated, otherwise null
- isFresherFriendly: boolean (true if 0-2 yrs exp, fresher, graduate, or internship)
- relevanceScore: integer 0-100 (high for AI/ML/LLM/Python/Backend/Software/Intern/Fresher roles)`;
}
