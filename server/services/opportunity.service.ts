import { Opportunity, OpportunityFilter, OpportunityType, ExperienceLevel, RemotePolicy } from '../types.ts';
import { store } from '../database/store.ts';
import { geminiService } from '../ai/gemini.service.ts';
import { logger } from '../utils/logger.ts';

export class OpportunityService {
  /**
   * List opportunities with filtering, sorting, and pagination
   */
  public listOpportunities(filter: OpportunityFilter = {}): Opportunity[] {
    let list = store.getOpportunities();

    if (filter.companyId) {
      list = list.filter((o) => o.companyId === filter.companyId);
    }
    if (filter.type) {
      list = list.filter((o) => o.type === filter.type);
    }
    if (filter.experienceLevel) {
      list = list.filter((o) => o.experienceLevel === filter.experienceLevel);
    }
    if (filter.remote) {
      list = list.filter((o) => o.remote === filter.remote);
    }
    if (filter.status) {
      list = list.filter((o) => o.status === filter.status);
    }
    if (filter.verificationStatus) {
      list = list.filter((o) => o.verificationStatus === filter.verificationStatus);
    }
    if (filter.minRelevance) {
      list = list.filter((o) => o.relevanceScore >= filter.minRelevance!);
    }
    if (filter.isFresherFriendly) {
      list = list.filter(
        (o) =>
          o.type === 'INTERNSHIP' ||
          o.type === 'GRADUATE' ||
          o.type === 'TRAINEE' ||
          o.experienceLevel === 'FRESHER' ||
          o.experienceLevel === 'ENTRY_LEVEL' ||
          o.experienceLevel === 'JUNIOR' ||
          o.experienceLevel === 'INTERN'
      );
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.companyName.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    // Default sort: highest relevance score first
    return list.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  public getOpportunityById(id: string): Opportunity | null {
    return store.getOpportunity(id) || null;
  }

  /**
   * Classify and persist an opportunity
   */
  public async createOrUpdateOpportunity(data: Partial<Opportunity> & { companyId: string; companyName: string; title: string }): Promise<Opportunity> {
    const settings = store.getSettings();
    const now = new Date().toISOString();

    const classified = await geminiService.classifyOpportunity(
      data.title,
      data.description || '',
      data.companyName,
      settings.targetRoles,
      settings.targetSkills
    );

    return store.upsertOpportunity({
      companyId: data.companyId,
      companyName: data.companyName,
      title: data.title,
      type: data.type || classified.type,
      employmentType: classified.type === 'INTERNSHIP' ? 'Internship' : 'Full-time',
      experienceLevel: data.experienceLevel || classified.experienceLevel,
      location: data.location || 'Bangalore, India',
      remote: data.remote || classified.remote,
      description: data.description || `Open position for ${data.title} at ${data.companyName}`,
      responsibilities: classified.responsibilities,
      requirements: classified.requirements,
      skills: data.skills && data.skills.length > 0 ? data.skills : classified.skills,
      salary: data.salary || classified.salary,
      applicationUrl: data.applicationUrl || data.sourceUrl || '',
      sourceUrl: data.sourceUrl || '',
      sourceType: data.sourceType || 'OFFICIAL_CAREERS',
      verificationStatus: data.verificationStatus || 'VERIFIED',
      confidence: data.confidence || 'HIGH',
      relevanceScore: classified.relevanceScore,
      status: data.status || 'OPEN',
      discoveredAt: data.discoveredAt || now,
      lastVerifiedAt: now,
    });
  }
}

export const opportunityService = new OpportunityService();
