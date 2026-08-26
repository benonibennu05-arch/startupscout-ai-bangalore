import { store } from '../database/store.ts';
import { verificationWorker } from '../workers/verification.worker.ts';
import { logger } from '../utils/logger.ts';

export type VerificationQueueStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export class VerificationQueueManager {
  private status: VerificationQueueStatus = 'IDLE';
  private lastRunResults: { verified: number; closed: number; total: number } | null = null;
  private listeners: Array<(data: any) => void> = [];

  public getStatus() {
    return {
      status: this.status,
      lastRunResults: this.lastRunResults,
      isVerifying: this.status === 'RUNNING',
    };
  }

  public subscribe(listener: (data: any) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private broadcast(event: string, payload: any) {
    for (const listener of this.listeners) {
      try {
        listener({ event, payload, timestamp: new Date().toISOString() });
      } catch (e) {
        // ignore
      }
    }
  }

  public async startVerification() {
    if (this.status === 'RUNNING') {
      return this.getStatus();
    }

    this.status = 'RUNNING';
    this.broadcast('VERIFICATION_STARTED', { startedAt: new Date().toISOString() });

    store.addEvent({
      companyId: 'verification',
      companyName: 'Verification Service',
      event: 'VERIFICATION_STARTED',
      message: 'Asynchronous link and ATS verification process started in background...',
      stage: 'VERIFY_JOBS',
      type: 'info',
    });

    // Run asynchronously without blocking caller
    (async () => {
      try {
        const results = await verificationWorker.runBatchVerification();
        this.lastRunResults = results || { verified: 0, closed: 0, total: 0 };
        this.status = 'COMPLETED';

        store.addEvent({
          companyId: 'verification',
          companyName: 'Verification Service',
          event: 'VERIFICATION_COMPLETED',
          message: `Verification complete: ${this.lastRunResults.verified} verified active, ${this.lastRunResults.closed} expired/closed.`,
          stage: 'VERIFY_JOBS',
          type: 'success',
        });

        this.broadcast('VERIFICATION_COMPLETED', this.lastRunResults);
      } catch (err: any) {
        this.status = 'FAILED';
        logger.error(`Verification queue failed: ${err?.message}`);
        this.broadcast('VERIFICATION_FAILED', { error: err?.message });
      }
    })();

    return this.getStatus();
  }
}

export const verificationQueue = new VerificationQueueManager();
