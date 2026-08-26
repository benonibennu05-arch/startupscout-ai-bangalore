import { verificationService } from '../services/verification.service.ts';
import { logger } from '../utils/logger.ts';

export class VerificationWorker {
  private isVerifying = false;

  public async runBatchVerification() {
    if (this.isVerifying) {
      logger.warn('Verification batch is already running.');
      return;
    }

    try {
      this.isVerifying = true;
      const results = await verificationService.verifyAllOpportunities();
      logger.info(`Verification worker completed batch: ${results.verified} active, ${results.closed} closed.`);
      return results;
    } catch (err: any) {
      logger.error(`Verification worker failed: ${err?.message}`);
      throw err;
    } finally {
      this.isVerifying = false;
    }
  }

  public getStatus() {
    return { isVerifying: this.isVerifying };
  }
}

export const verificationWorker = new VerificationWorker();
