import { store } from '../database/store.ts';
import { companyResearchService } from '../services/companyResearch.service.ts';
import { logger } from '../utils/logger.ts';

export class ResearchWorker {
  private isProcessing = false;

  public async processCompany(companyId: string, delayMs = 600): Promise<boolean> {
    const company = store.getCompany(companyId);
    if (!company) {
      logger.warn(`Worker could not find company with ID: ${companyId}`);
      return false;
    }

    try {
      this.isProcessing = true;
      await companyResearchService.researchCompany(company);
      if (delayMs > 0) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
      return true;
    } catch (err: any) {
      logger.error(`Worker error researching ${company.name}: ${err?.message || err}`);
      store.updateCompanyStatus(company.id, 'FAILED');
      store.addEvent({
        companyId: company.id,
        companyName: company.name,
        event: 'RESEARCH_FAILED',
        message: `Research failed: ${err?.message || 'Network/Parse error'}`,
        stage: 'RESEARCH_COMPANY',
        type: 'error',
      });
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  public getStatus() {
    return { isProcessing: this.isProcessing };
  }
}

export const researchWorker = new ResearchWorker();
