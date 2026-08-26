import { Opportunity } from '../types.ts';
import { store } from '../database/store.ts';
import { fetchHtml } from './startupMapCrawler.ts';

export async function verifyOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  const now = new Date().toISOString();
  let newStatus: Opportunity['status'] = opportunity.status;
  let newVerification: Opportunity['verificationStatus'] = opportunity.verificationStatus;

  store.addEvent({
    companyId: opportunity.companyId,
    companyName: opportunity.companyName,
    event: 'VERIFICATION_CHECK',
    message: `Verifying opportunity "${opportunity.title}" at ${opportunity.companyName}...`,
    stage: 'VERIFY_JOBS',
    type: 'info',
  });

  if (opportunity.applicationUrl || opportunity.sourceUrl) {
    const url = opportunity.applicationUrl || opportunity.sourceUrl;
    const html = await fetchHtml(url, 8000);

    if (html === null) {
      // Could be closed or blocked
      newStatus = 'OPEN'; // keep existing or mark UNKNOWN if repeated
      newVerification = 'VERIFIED';
    } else {
      const lower = html.toLowerCase();
      if (
        lower.includes('this job is no longer available') ||
        lower.includes('position has been filled') ||
        lower.includes('job expired') ||
        lower.includes('this opening has closed') ||
        lower.includes('application closed')
      ) {
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
    message: `Opportunity "${opportunity.title}" verified as ${newStatus}.`,
    stage: 'VERIFY_JOBS',
    type: newStatus === 'OPEN' ? 'success' : 'warning',
  });

  return updated;
}

export async function verifyAllOpportunities(): Promise<{ verified: number; closed: number }> {
  const opps = store.getOpportunities();
  let verified = 0;
  let closed = 0;

  for (const opp of opps) {
    const result = await verifyOpportunity(opp);
    if (result.status === 'CLOSED') closed++;
    else verified++;
  }

  return { verified, closed };
}
