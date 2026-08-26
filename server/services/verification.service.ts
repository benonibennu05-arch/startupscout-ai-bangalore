import { Opportunity, VerificationStatus, OpportunityStatus } from '../types.ts';
import { store } from '../database/store.ts';
import { crawlerService } from './crawler.service.ts';
import { logger } from '../utils/logger.ts';

const CLOSED_JOB_PHRASES = [
  'this job is no longer available',
  'position has been filled',
  'job expired',
  'this opening has closed',
  'application closed',
  'no longer accepting applications',
  'this position has expired',
  '404 not found',
  'page not found',
];

export class VerificationService {
  /**
   * Verify an opportunity by checking its source/application URL
   */
  public async verifyOpportunity(opportunity: Opportunity): Promise<Opportunity> {
    const url = opportunity.applicationUrl || opportunity.sourceUrl;
    let newStatus: OpportunityStatus = opportunity.status;
    let newVerification: VerificationStatus = opportunity.verificationStatus;

    if (url && url.startsWith('http')) {
      const html = await crawlerService.fetchHtml(url, { timeoutMs: 7000 });

      if (html) {
        const lower = html.toLowerCase();
        const isClosed = CLOSED_JOB_PHRASES.some((phrase) => lower.includes(phrase));

        if (isClosed) {
          newStatus = 'CLOSED';
          newVerification = 'CLOSED';
        } else {
          newStatus = 'OPEN';
          newVerification = 'VERIFIED';
        }
      } else {
        // Check link status
        const check = await crawlerService.checkLinkStatus(url, 5000);
        if (check.status === 404 || check.status === 410) {
          newStatus = 'CLOSED';
          newVerification = 'CLOSED';
        } else {
          newStatus = 'OPEN';
          newVerification = 'VERIFIED';
        }
      }
    }

    store.updateOpportunityStatus(opportunity.id, newStatus, newVerification);
    const updated = store.getOpportunity(opportunity.id)!;

    store.addEvent({
      companyId: opportunity.companyId,
      companyName: opportunity.companyName,
      event: 'VERIFICATION_RESULT',
      message: `Verified "${opportunity.title}" at ${opportunity.companyName}: marked as ${newStatus} (${newVerification}).`,
      stage: 'VERIFY_JOBS',
      type: newStatus === 'OPEN' ? 'success' : 'warning',
    });

    return updated;
  }

  /**
   * Verify all stored opportunities in parallel batching
   */
  public async verifyAllOpportunities(): Promise<{ verified: number; closed: number; total: number }> {
    const opportunities = store.getOpportunities();
    let verified = 0;
    let closed = 0;

    store.addEvent({
      companyId: 'verifier',
      companyName: 'Opportunity Verifier',
      event: 'BATCH_VERIFICATION_STARTED',
      message: `Starting batch verification across all ${opportunities.length} opportunities...`,
      stage: 'VERIFY_JOBS',
      type: 'info',
    });

    for (const opp of opportunities) {
      try {
        const res = await this.verifyOpportunity(opp);
        if (res.status === 'CLOSED') closed++;
        else verified++;
      } catch (err: any) {
        logger.warn(`Verification error on ${opp.id}: ${err?.message}`);
        verified++;
      }
    }

    store.addEvent({
      companyId: 'verifier',
      companyName: 'Opportunity Verifier',
      event: 'BATCH_VERIFICATION_COMPLETED',
      message: `Batch verification finished. ${verified} open/verified, ${closed} closed out of ${opportunities.length} total.`,
      stage: 'VERIFY_JOBS',
      type: 'success',
    });

    return { verified, closed, total: opportunities.length };
  }
}

export const verificationService = new VerificationService();
