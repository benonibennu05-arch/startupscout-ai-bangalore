import { Opportunity, OpportunityFilter, OpportunityType, ExperienceLevel, RemotePolicy, OpportunityCategory, AiMlRelevance } from '../types.ts';
import { store } from '../database/store.ts';
import { classifyRole } from '../ai/roleClassifier.ts';
import { logger } from '../utils/logger.ts';

export class OpportunityService {
  /**
   * List opportunities with filtering, sorting, and pagination
   */
  public listOpportunities(
    filter: OpportunityFilter & { sort?: 'relevance' | 'match' | 'newest' | 'company' } = {}
  ): Opportunity[] {
    return store.getOpportunities(filter);
  }

  public getOpportunityById(id: string): Opportunity | null {
    return store.getOpportunity(id) || null;
  }

  public saveJob(opportunityId: string, priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH', notes = '') {
    return store.saveJob(opportunityId, priority, notes);
  }

  public unsaveJob(opportunityId: string) {
    return store.unsaveJob(opportunityId);
  }

  public updateJobStatus(opportunityId: string, status: 'SAVED' | 'APPLIED' | 'INTERVIEWING' | 'OFFER' | 'REJECTED' | 'NOT_INTERESTED') {
    const opp = store.getOpportunity(opportunityId);
    if (opp) {
      opp.userApplicationStatus = status;
      if (status === 'SAVED') {
        opp.isSaved = true;
      }
      const savedRec = store.getSavedJobs().find((s) => s.opportunityId === opportunityId);
      if (savedRec) {
        store.updateSavedJob(savedRec.id, { status });
      } else if (status === 'SAVED' || status === 'APPLIED') {
        store.saveJob(opportunityId, 'HIGH', `Status updated to ${status}`);
      }
      return opp;
    }
    return null;
  }

  /**
   * Classify and persist an opportunity
   */
  public createOrUpdateOpportunity(data: Partial<Opportunity> & { companyId: string; companyName: string; title: string }): Opportunity {
    const now = new Date().toISOString();
    const candidateProfile = store.getCandidateProfile();

    const classified = classifyRole(
      data.title,
      data.description || '',
      data.companyName,
      data.location,
      candidateProfile
    );

    return store.upsertOpportunity({
      companyId: data.companyId,
      companyName: data.companyName,
      title: data.title,
      category: data.category || classified.category,
      aiMlRelevance: data.aiMlRelevance || classified.aiMlRelevance,
      type: data.type || classified.type,
      employmentType: classified.type === 'INTERNSHIP' ? 'Internship' : 'Full-time',
      experienceLevel: data.experienceLevel || classified.experienceLevel,
      location: data.location || 'Bangalore, India',
      remote: data.remote || classified.remote,
      description: data.description || `Open position for ${data.title} at ${data.companyName}`,
      responsibilities: data.responsibilities || classified.responsibilities,
      requirements: data.requirements || classified.requirements,
      skills: data.skills && data.skills.length > 0 ? data.skills : classified.skills,
      salary: data.salary || classified.salary,
      applicationUrl: data.applicationUrl || data.sourceUrl || '',
      sourceUrl: data.sourceUrl || '',
      sourceType: data.sourceType || 'OFFICIAL_CAREERS',
      verificationStatus: data.verificationStatus || 'VERIFIED',
      confidence: data.confidence || 'HIGH',
      relevanceScore: data.relevanceScore !== undefined ? data.relevanceScore : classified.relevanceScore,
      personalMatchScore: data.personalMatchScore !== undefined ? data.personalMatchScore : classified.personalMatchScore,
      jobFingerprint: data.jobFingerprint || classified.jobFingerprint,
      status: data.status || 'OPEN',
      discoveredAt: data.discoveredAt || now,
      firstSeenAt: data.firstSeenAt || now,
      lastSeenAt: now,
      lastVerifiedAt: now,
    });
  }
}

export const opportunityService = new OpportunityService();

