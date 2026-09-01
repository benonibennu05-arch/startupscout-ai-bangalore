import { Company, ResearchRun, ResearchStage, ResearchMode, ActiveWorkerInfo, ResearchMetrics, LocationScope, StartupMapSource } from '../types.ts';
import { store } from '../database/store.ts';
import { crawlBangaloreStartupMap } from '../crawler/startupMapCrawler.ts';
import { crawlHyderabadStartupMap } from '../crawler/hyderabadStartupMapCrawler.ts';
import { companyResearchService } from '../services/companyResearch.service.ts';
import { verificationQueue } from './verificationQueue.ts';
import { logger } from '../utils/logger.ts';

export type QueueStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

class ResearchQueueManager {
  private status: QueueStatus = 'IDLE';
  private mode: ResearchMode = 'FAST';
  private concurrency: number = 10;
  private locationScope: LocationScope = 'BANGALORE';
  private currentRun: ResearchRun | null = null;
  private queue: string[] = []; // Company IDs to process
  private activeWorkers: Map<number, ActiveWorkerInfo> = new Map();
  private currentStage: ResearchStage = 'DISCOVER_COMPANIES';
  private abortController: AbortController | null = null;
  private listeners: Array<(data: any) => void> = [];

  // Metrics tracking
  private runStartTime: number = 0;
  private completedInRun: number = 0;
  private totalDurationsMs: number = 0;
  private geminiCallsCount: number = 0;
  private timeoutsCount: number = 0;
  private rateLimitedCount: number = 0;
  private workerPromises: Array<Promise<void>> = [];

  public getStatus(location?: LocationScope) {
    const activeLoc = location || this.locationScope || 'BANGALORE';
    const elapsedSeconds = this.runStartTime > 0 && this.status === 'RUNNING'
      ? Math.max(1, Math.round((Date.now() - this.runStartTime) / 1000))
      : 0;

    const elapsedMinutes = elapsedSeconds / 60;
    const companiesPerMinute = elapsedMinutes > 0
      ? Number((this.completedInRun / elapsedMinutes).toFixed(1))
      : 0;

    const remainingCompanies = this.queue.length + this.activeWorkers.size;
    const estimatedRemainingMinutes = companiesPerMinute > 0 && remainingCompanies > 0
      ? Number((remainingCompanies / companiesPerMinute).toFixed(1))
      : null;

    const avgCompanyDurationMs = this.completedInRun > 0
      ? Math.round(this.totalDurationsMs / this.completedInRun)
      : 0;

    const metrics: ResearchMetrics = {
      companiesPerMinute,
      estimatedRemainingMinutes,
      avgCompanyDurationMs,
      geminiCallsCount: this.geminiCallsCount,
      timeoutsCount: this.timeoutsCount,
      rateLimitedCount: this.rateLimitedCount,
      activeWorkersCount: this.activeWorkers.size,
      concurrency: this.concurrency,
      mode: this.mode,
      elapsedSeconds,
    };

    return {
      status: this.status,
      mode: this.mode,
      concurrency: this.concurrency,
      locationScope: this.locationScope,
      currentRun: this.currentRun,
      queueLength: this.queue.length,
      activeWorkers: Array.from(this.activeWorkers.values()),
      currentStage: this.currentStage,
      metrics,
      stats: store.getStats(activeLoc),
    };
  }

  public subscribe(listener: (data: any) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public broadcast(event: string, payload: any) {
    for (const listener of this.listeners) {
      try {
        listener({ event, payload, timestamp: new Date().toISOString() });
      } catch (e) {
        // ignore
      }
    }
  }

  public setConcurrency(concurrency: number) {
    this.concurrency = Math.max(1, Math.min(30, concurrency));
    logger.info(`Research concurrency set to: ${this.concurrency}`);
    this.broadcast('SETTINGS_UPDATED', { concurrency: this.concurrency });
  }

  public setMode(mode: ResearchMode) {
    this.mode = mode;
    logger.info(`Research mode set to: ${this.mode}`);
    this.broadcast('SETTINGS_UPDATED', { mode: this.mode });
  }

  public setLocationScope(location: LocationScope) {
    this.locationScope = location;
    logger.info(`Research location scope set to: ${this.locationScope}`);
    this.broadcast('SETTINGS_UPDATED', { locationScope: this.locationScope });
  }

  private normalizeLocation(loc?: string): LocationScope {
    if (!loc) return this.locationScope || 'BANGALORE';
    const lower = loc.toLowerCase();
    if (lower.includes('hyd')) return 'HYDERABAD';
    if (lower.includes('both') || lower.includes('all')) return 'BOTH';
    return 'BANGALORE';
  }

  private async discoverForLocation(location: LocationScope) {
    if (location === 'HYDERABAD') {
      const discovered = await crawlHyderabadStartupMap();
      for (const item of discovered) {
        store.upsertCompany({ ...item, sourceMap: 'HYDERABAD', location: item.location || 'Hyderabad, India' });
      }
    } else if (location === 'BOTH') {
      const blr = await crawlBangaloreStartupMap();
      for (const item of blr) {
        store.upsertCompany({ ...item, sourceMap: 'BANGALORE', location: item.location || 'Bangalore, India' });
      }
      const hyd = await crawlHyderabadStartupMap();
      for (const item of hyd) {
        store.upsertCompany({ ...item, sourceMap: 'HYDERABAD', location: item.location || 'Hyderabad, India' });
      }
    } else {
      const discovered = await crawlBangaloreStartupMap();
      for (const item of discovered) {
        store.upsertCompany({ ...item, sourceMap: 'BANGALORE', location: item.location || 'Bangalore, India' });
      }
    }
  }

  // --- Start Test Batch: 10 companies in parallel ---
  public async startTest10(mode: ResearchMode = 'FAST', concurrency: number = 10, location?: LocationScope | string) {
    if (this.status === 'RUNNING') {
      throw new Error('Research is already running. Please pause or stop first.');
    }

    const loc = this.normalizeLocation(location);
    this.locationScope = loc;
    this.mode = mode;
    this.concurrency = Math.min(10, Math.max(2, concurrency));
    this.status = 'RUNNING';
    this.runStartTime = Date.now();
    this.completedInRun = 0;
    this.totalDurationsMs = 0;
    this.geminiCallsCount = 0;
    this.timeoutsCount = 0;
    this.rateLimitedCount = 0;
    this.abortController = new AbortController();

    // Ensure we have companies discovered for the selected location
    let companies = store.getCompanies({ location: loc });
    if (companies.length < 5) {
      await this.discoverForLocation(loc);
      companies = store.getCompanies({ location: loc });
    }

    const uncompleted = companies.filter((c) => c.status !== 'COMPLETED');
    const pool = uncompleted.length >= 10 ? uncompleted : companies;
    const testBatch = pool.slice(0, 10);
    this.queue = testBatch.map((c) => c.id);

    const sourceMapValue: StartupMapSource = loc === 'HYDERABAD' ? 'HYDERABAD' : 'BANGALORE';
    this.currentRun = store.createResearchRun('TEST_10', testBatch.length);
    this.currentRun.mode = this.mode;
    this.currentRun.concurrency = this.concurrency;
    this.currentRun.location = loc;
    this.currentRun.sourceMap = sourceMapValue;

    store.addEvent({
      companyId: 'queue',
      companyName: 'Research Queue',
      event: 'TEST_BATCH_STARTED',
      message: `Starting Parallel 10-Company Test Batch for ${loc} (${this.concurrency} workers, ${this.mode} mode).`,
      stage: 'RESEARCH_COMPANY',
      type: 'info',
    });

    this.currentStage = 'RESEARCH_COMPANY';
    this.broadcast('STAGE_CHANGE', { stage: 'RESEARCH_COMPANY' });
    this.startWorkerPool();

    return this.getStatus(loc);
  }

  // --- Start Full Research: All Companies dynamically discovered ---
  public async startFullResearch(
    mode: ResearchMode = 'FAST',
    concurrency: number = 10,
    forceRefresh = false,
    location?: LocationScope | string
  ) {
    if (this.status === 'RUNNING') {
      throw new Error('Research is already running. Please pause or stop first.');
    }

    const loc = this.normalizeLocation(location);
    this.locationScope = loc;
    this.mode = mode;
    this.concurrency = Math.max(2, Math.min(25, concurrency));
    this.status = 'RUNNING';
    this.runStartTime = Date.now();
    this.completedInRun = 0;
    this.totalDurationsMs = 0;
    this.geminiCallsCount = 0;
    this.timeoutsCount = 0;
    this.rateLimitedCount = 0;
    this.abortController = new AbortController();

    this.currentStage = 'DISCOVER_COMPANIES';
    this.broadcast('STAGE_CHANGE', { stage: 'DISCOVER_COMPANIES' });

    // Step 1: Dynamic Discovery Producer for the chosen location
    await this.discoverForLocation(loc);

    const allCompanies = store.getCompanies({ location: loc });
    const toQueue = forceRefresh
      ? allCompanies
      : allCompanies.filter((c) => c.status !== 'COMPLETED');

    const finalQueue = toQueue.length > 0 ? toQueue : allCompanies;
    this.queue = finalQueue.map((c) => c.id);

    const sourceMapValue: StartupMapSource = loc === 'HYDERABAD' ? 'HYDERABAD' : 'BANGALORE';
    this.currentRun = store.createResearchRun('FULL_MAP', finalQueue.length);
    this.currentRun.mode = this.mode;
    this.currentRun.concurrency = this.concurrency;
    this.currentRun.location = loc;
    this.currentRun.sourceMap = sourceMapValue;

    const mapLabel = loc === 'HYDERABAD' ? 'Hyderabad Startups Map' : loc === 'BOTH' ? 'Bangalore & Hyderabad Maps' : 'Bangalore Startup Map';
    store.addEvent({
      companyId: 'queue',
      companyName: 'Research Queue',
      event: 'FULL_RESEARCH_STARTED',
      message: `Initiated High-Speed Parallel Research for ${finalQueue.length} ${loc} companies from ${mapLabel} with ${this.concurrency} concurrent workers in ${this.mode} mode.`,
      stage: 'RESEARCH_COMPANY',
      type: 'info',
    });

    this.currentStage = 'RESEARCH_COMPANY';
    this.broadcast('STAGE_CHANGE', { stage: 'RESEARCH_COMPANY' });

    // Step 2: Spawn Parallel Consumer Worker Pool
    this.startWorkerPool();

    return this.getStatus(loc);
  }

  // --- Pause Research ---
  public pauseResearch() {
    if (this.status === 'RUNNING') {
      this.status = 'PAUSED';
      if (this.currentRun) {
        store.updateResearchRun(this.currentRun.id, { status: 'PAUSED' });
      }
      store.addEvent({
        companyId: 'queue',
        companyName: 'Research Queue',
        event: 'RESEARCH_PAUSED',
        message: `Research paused. ${this.queue.length} companies queued.`,
        type: 'warning',
      });
      this.broadcast('STATUS_CHANGE', this.getStatus());
    }
    return this.getStatus();
  }

  // --- Resume Research ---
  public resumeResearch() {
    if (this.status === 'PAUSED') {
      this.status = 'RUNNING';
      if (this.currentRun) {
        store.updateResearchRun(this.currentRun.id, { status: 'RUNNING' });
      }
      store.addEvent({
        companyId: 'queue',
        companyName: 'Research Queue',
        event: 'RESEARCH_RESUMED',
        message: `Parallel research resumed with ${this.concurrency} workers.`,
        type: 'info',
      });
      this.startWorkerPool();
    }
    return this.getStatus();
  }

  // --- Stop Research ---
  public stopResearch() {
    this.status = 'STOPPED';
    this.queue = [];
    this.activeWorkers.clear();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.currentRun) {
      store.updateResearchRun(this.currentRun.id, {
        status: 'STOPPED',
        completedAt: new Date().toISOString(),
      });
    }
    store.addEvent({
      companyId: 'queue',
      companyName: 'Research Queue',
      event: 'RESEARCH_STOPPED',
      message: `Research stopped by user.`,
      type: 'warning',
    });
    this.broadcast('STATUS_CHANGE', this.getStatus());
    return this.getStatus();
  }

  // --- Retry Failed Companies ---
  public retryFailed(concurrency = 10, location?: LocationScope | string) {
    const loc = this.normalizeLocation(location);
    const failed = store.getCompanies({ location: loc }).filter((c) => c.status === 'FAILED');
    if (failed.length === 0) {
      return this.getStatus(loc);
    }

    this.concurrency = Math.min(20, Math.max(2, concurrency));
    this.queue = failed.map((c) => c.id);
    this.status = 'RUNNING';
    this.runStartTime = Date.now();
    this.completedInRun = 0;
    this.totalDurationsMs = 0;
    this.currentRun = store.createResearchRun('RETRY_FAILED', failed.length);
    this.currentRun.location = loc;

    store.addEvent({
      companyId: 'queue',
      companyName: 'Research Queue',
      event: 'RETRY_FAILED_STARTED',
      message: `Retrying research for ${failed.length} failed ${loc} companies with ${this.concurrency} workers.`,
      type: 'info',
    });

    this.startWorkerPool();
    return this.getStatus(loc);
  }

  // --- Start Incremental Research: Only uncompleted, stale, or changed companies ---
  public async startIncrementalResearch(mode: ResearchMode = 'FAST', concurrency: number = 10, location?: LocationScope | string) {
    if (this.status === 'RUNNING') {
      throw new Error('Research is already running. Please pause or stop first.');
    }

    const loc = this.normalizeLocation(location);
    this.locationScope = loc;
    this.mode = mode;
    this.concurrency = Math.max(2, Math.min(25, concurrency));
    this.status = 'RUNNING';
    this.runStartTime = Date.now();
    this.completedInRun = 0;
    this.totalDurationsMs = 0;
    this.geminiCallsCount = 0;
    this.timeoutsCount = 0;
    this.rateLimitedCount = 0;
    this.abortController = new AbortController();

    const allCompanies = store.getCompanies({ location: loc });
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Filter to companies that need research: not completed, failed, or researched > 7 days ago
    const toQueue = allCompanies.filter((c) => {
      if (c.status !== 'COMPLETED') return true;
      if (!c.lastResearchedAt) return true;
      const last = new Date(c.lastResearchedAt).getTime();
      return isNaN(last) || last < sevenDaysAgo;
    });

    const finalQueue = toQueue.length > 0 ? toQueue : allCompanies.slice(0, 20);
    this.queue = finalQueue.map((c) => c.id);

    this.currentRun = store.createResearchRun('CUSTOM_SELECTION', finalQueue.length);
    this.currentRun.mode = this.mode;
    this.currentRun.concurrency = this.concurrency;
    this.currentRun.location = loc;

    store.addEvent({
      companyId: 'queue',
      companyName: 'Research Queue',
      event: 'INCREMENTAL_RESEARCH_STARTED',
      message: `Started Incremental Research for ${finalQueue.length} ${loc} startups requiring updates (${this.concurrency} workers, ${this.mode} mode).`,
      stage: 'RESEARCH_COMPANY',
      type: 'info',
    });

    this.currentStage = 'RESEARCH_COMPANY';
    this.broadcast('STAGE_CHANGE', { stage: 'RESEARCH_COMPANY' });
    this.startWorkerPool();

    return this.getStatus(loc);
  }

  // --- Start Research for New Companies Only ---
  public async startNewCompaniesResearch(mode: ResearchMode = 'FAST', concurrency: number = 10, location?: LocationScope | string) {
    if (this.status === 'RUNNING') {
      throw new Error('Research is already running. Please pause or stop first.');
    }

    const loc = this.normalizeLocation(location);
    this.locationScope = loc;
    this.mode = mode;
    this.concurrency = Math.max(2, Math.min(25, concurrency));
    this.status = 'RUNNING';
    this.runStartTime = Date.now();
    this.completedInRun = 0;
    this.totalDurationsMs = 0;
    this.geminiCallsCount = 0;
    this.timeoutsCount = 0;
    this.rateLimitedCount = 0;
    this.abortController = new AbortController();

    this.currentStage = 'DISCOVER_COMPANIES';
    this.broadcast('STAGE_CHANGE', { stage: 'DISCOVER_COMPANIES' });

    // Step 1: Discover from Map
    await this.discoverForLocation(loc);

    const allCompanies = store.getCompanies({ location: loc });
    const newOnly = allCompanies.filter((c) => !c.lastResearchedAt || c.status === 'PENDING' || c.status === 'DISCOVERED' || c.status === 'QUEUED');

    const finalQueue = newOnly.length > 0 ? newOnly : allCompanies.slice(0, 10);
    this.queue = finalQueue.map((c) => c.id);

    this.currentRun = store.createResearchRun('CUSTOM_SELECTION', finalQueue.length);
    this.currentRun.mode = this.mode;
    this.currentRun.concurrency = this.concurrency;
    this.currentRun.location = loc;

    store.addEvent({
      companyId: 'queue',
      companyName: 'Research Queue',
      event: 'NEW_COMPANIES_RESEARCH_STARTED',
      message: `Started Research for ${finalQueue.length} newly discovered ${loc} startups (${this.concurrency} workers, ${this.mode} mode).`,
      stage: 'RESEARCH_COMPANY',
      type: 'info',
    });

    this.currentStage = 'RESEARCH_COMPANY';
    this.broadcast('STAGE_CHANGE', { stage: 'RESEARCH_COMPANY' });
    this.startWorkerPool();

    return this.getStatus(loc);
  }

  // --- Start Failed-Only Research ---
  public startFailedOnlyResearch(concurrency = 10, location?: LocationScope | string) {
    return this.retryFailed(concurrency, location);
  }

  // --- Research Single Company on Demand ---
  public async researchSingle(companyId: string) {
    const comp = store.getCompany(companyId);
    if (!comp) throw new Error('Company not found');

    const result = await companyResearchService.researchCompany(comp, {
      mode: this.mode,
      forceRefresh: true,
    });
    this.broadcast('COMPANY_UPDATED', result);
    return result;
  }

  // --- Re-Verify All Opportunities (Asynchronously) ---
  public async verifyAll() {
    return verificationQueue.startVerification();
  }

  // --- High-Speed Parallel Worker Pool ---
  private startWorkerPool() {
    this.workerPromises = [];

    // Spawn N workers up to concurrency
    for (let workerId = 1; workerId <= this.concurrency; workerId++) {
      this.workerPromises.push(this.runWorker(workerId));
    }
  }

  private async runWorker(workerId: number) {
    while (this.status === 'RUNNING' && this.queue.length > 0) {
      const companyId = this.queue.shift();
      if (!companyId) break;

      const company = store.getCompany(companyId);
      if (!company) continue;

      // Register active worker
      this.activeWorkers.set(workerId, {
        workerId,
        companyId,
        companyName: company.name,
        stage: 'RESEARCH_COMPANY',
        startedAt: new Date().toISOString(),
      });

      this.broadcast('RESEARCH_TICK', this.getStatus());

      try {
        const result = await companyResearchService.researchCompany(company, {
          mode: this.mode,
        });

        this.completedInRun += 1;
        this.totalDurationsMs += result.durationMs;
        this.geminiCallsCount += result.geminiCalls;

        // Update run stats in store
        if (this.currentRun) {
          const run = store.getResearchRun(this.currentRun.id);
          if (run) {
            run.completedCompanies += 1;
            const internships = result.opportunities.filter(
              (o) => o.type === 'INTERNSHIP' || o.type === 'TRAINEE'
            ).length;
            const jobs = result.opportunities.length - internships;
            run.jobsFound += jobs;
            run.internshipsFound += internships;
            run.emailsFound += result.contacts.length;
            store.updateResearchRun(run.id, run);
          }
        }
      } catch (err: any) {
        logger.error(`Worker #${workerId} error researching ${company.name}: ${err?.message}`);
        store.updateCompanyStatus(companyId, 'FAILED');
        store.logError({
          companyId,
          companyName: company.name,
          stage: 'RESEARCH_COMPANY',
          error: err?.message || 'Network or parse error',
          attempt: 1,
        });

        if (this.currentRun) {
          const run = store.getResearchRun(this.currentRun.id);
          if (run) {
            run.failedCompanies += 1;
            store.updateResearchRun(run.id, run);
          }
        }
      } finally {
        this.activeWorkers.delete(workerId);
        this.broadcast('RESEARCH_TICK', this.getStatus());
      }
    }

    // Check if entire queue has drained
    if (this.status === 'RUNNING' && this.queue.length === 0 && this.activeWorkers.size === 0) {
      this.status = 'IDLE';
      this.currentStage = 'COMPLETE';
      if (this.currentRun) {
        store.updateResearchRun(this.currentRun.id, {
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        });
      }

      store.addEvent({
        companyId: 'queue',
        companyName: 'Research Queue',
        event: 'QUEUE_COMPLETED',
        message: `High-Speed Parallel Research Run Complete! Processed ${this.completedInRun} startups.`,
        stage: 'COMPLETE',
        type: 'success',
      });

      this.broadcast('RESEARCH_COMPLETED', this.getStatus());
    }
  }
}

export const researchQueue = new ResearchQueueManager();
