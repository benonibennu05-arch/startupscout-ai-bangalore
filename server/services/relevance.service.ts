import { Opportunity, UserSettings } from '../types.ts';
import { store } from '../database/store.ts';

export class RelevanceService {
  /**
   * Re-scores opportunities against updated user target roles, target skills, and internship preferences
   */
  public scoreOpportunity(opp: Opportunity, settings: UserSettings): number {
    let score = 30; // baseline

    const titleLower = opp.title.toLowerCase();
    const descLower = opp.description.toLowerCase();

    // AI / ML / LLM Boost
    const highValueAi = ['ai', 'ml', 'machine learning', 'generative ai', 'genai', 'llm', 'nlp', 'vision', 'agent', 'deep learning'];
    if (highValueAi.some((t) => titleLower.includes(t) || descLower.includes(t))) {
      score += 40;
    }

    // Backend / Python / Engineering Boost
    const engineering = ['python', 'backend', 'full stack', 'software engineer', 'systems', 'platform', 'data engineer'];
    if (engineering.some((t) => titleLower.includes(t))) {
      score += 20;
    }

    // Fresher / Intern / Early Career Boost
    if (
      opp.type === 'INTERNSHIP' ||
      opp.type === 'TRAINEE' ||
      opp.type === 'GRADUATE' ||
      opp.experienceLevel === 'FRESHER' ||
      opp.experienceLevel === 'ENTRY_LEVEL' ||
      opp.experienceLevel === 'JUNIOR' ||
      opp.experienceLevel === 'INTERN'
    ) {
      score += 15;
    }

    // Target Skills Match
    if (settings.targetSkills && settings.targetSkills.length > 0) {
      const matched = settings.targetSkills.filter((s) => opp.skills.some((os) => os.toLowerCase() === s.toLowerCase())).length;
      score += Math.min(20, matched * 5);
    }

    // Target Roles Match
    if (settings.targetRoles && settings.targetRoles.length > 0) {
      const roleMatched = settings.targetRoles.some((r) => titleLower.includes(r.toLowerCase()));
      if (roleMatched) {
        score += 15;
      }
    }

    return Math.min(100, Math.max(10, score));
  }

  /**
   * Recalculate relevance for all stored opportunities based on current user settings
   */
  public rescoreAllOpportunities(): void {
    const settings = store.getSettings();
    const opps = store.getOpportunities();
    for (const opp of opps) {
      const newScore = this.scoreOpportunity(opp, settings);
      opp.relevanceScore = newScore;
      store.upsertOpportunity(opp);
    }
  }
}

export const relevanceService = new RelevanceService();
