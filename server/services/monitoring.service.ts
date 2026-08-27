import crypto from 'crypto';
import { store } from '../database/store.ts';
import { Company, MonitoringRun, MonitoringSource, Opportunity } from '../types.ts';
import { companyResearchService } from './companyResearch.service.ts';

export class MonitoringService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  public async runMonitoringCycle(maxCompanies = 10): Promise<MonitoringRun> {
    if (this.isRunning) {
      console.log('[MonitoringService] Cycle already in progress, skipping.');
      return {
        id: `monrun_${Date.now()}`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: 'SKIPPED',
        sourcesChecked: 0,
        newOpportunitiesFound: 0,
        newInternshipsFound: 0,
        contactsUpdated: 0,
        summary: 'Skipped - another monitoring run was active',
      };
    }

    this.isRunning = true;
    const startedAt = new Date().toISOString();
    let sourcesChecked = 0;
    let newOpportunitiesFound = 0;
    let newInternshipsFound = 0;
    let contactsUpdated = 0;

    try {
      const companies = store.getCompanies();
      if (companies.length === 0) {
        this.isRunning = false;
        return {
          id: `monrun_${Date.now()}`,
          startedAt,
          completedAt: new Date().toISOString(),
          status: 'COMPLETED',
          sourcesChecked: 0,
          newOpportunitiesFound: 0,
          newInternshipsFound: 0,
          contactsUpdated: 0,
          summary: 'No companies available to monitor',
        };
      }

      // Prioritize companies with careers or job board URLs or oldest researched
      const candidateCompanies = [...companies]
        .filter((c) => c.careersUrl || c.jobBoardUrl || c.officialWebsite)
        .sort((a, b) => {
          const tA = a.lastResearchedAt ? new Date(a.lastResearchedAt).getTime() : 0;
          const tB = b.lastResearchedAt ? new Date(b.lastResearchedAt).getTime() : 0;
          return tA - tB;
        })
        .slice(0, maxCompanies);

      store.addEvent({
        eventType: 'GENERAL_DISCOVERY',
        title: 'Continuous Monitoring Cycle Started',
        description: `Monitoring cycle evaluating ${candidateCompanies.length} Bangalore tech companies for new jobs, internships, and verified contacts.`,
        severity: 'INFO',
      });

      for (const comp of candidateCompanies) {
        sourcesChecked++;
        const prevOpps = store.getOpportunitiesForCompany(comp.id);
        const prevFingerprints = new Set(prevOpps.map((o) => o.jobFingerprint || `${o.title}_${o.type}`));
        const prevContactsCount = store.getContactsForCompany(comp.id).length;

        // Perform live targeted research for this company
        const result = await companyResearchService.researchCompany(comp.id);

        if (result && result.opportunities) {
          const currentOpps = store.getOpportunitiesForCompany(comp.id);
          for (const opp of currentOpps) {
            const fp = opp.jobFingerprint || `${opp.title}_${opp.type}`;
            if (!prevFingerprints.has(fp)) {
              newOpportunitiesFound++;
              if (opp.type === 'INTERNSHIP' || opp.experienceLevel === 'INTERN') {
                newInternshipsFound++;
              }

              // Create in-app notification
              store.addNotification({
                type: opp.category === 'AI_ML' ? 'NEW_JOB_DISCOVERED' : 'NEW_JOB_DISCOVERED',
                title: `New Opportunity: ${opp.title}`,
                message: `${comp.name} posted a new ${opp.type.toLowerCase().replace('_', ' ')} (${opp.category}) in ${opp.location}.`,
                relatedCompanyId: comp.id,
                relatedOpportunityId: opp.id,
                priority: opp.category === 'AI_ML' || opp.relevanceScore >= 80 ? 'HIGH' : 'MEDIUM',
              });
            }
          }
        }

        const currentContactsCount = store.getContactsForCompany(comp.id).length;
        if (currentContactsCount > prevContactsCount) {
          contactsUpdated += currentContactsCount - prevContactsCount;
          store.addNotification({
            type: 'CONTACT_VERIFIED',
            title: `New Public Contact Verified`,
            message: `Discovered and verified new public recruitment contacts for ${comp.name}.`,
            relatedCompanyId: comp.id,
            priority: 'LOW',
          });
        }

        // Record monitoring source
        if (comp.careersUrl) {
          store.upsertMonitoringSource({
            companyId: comp.id,
            companyName: comp.name,
            sourceType: 'CAREERS_PAGE',
            sourceUrl: comp.careersUrl,
            lastCheckedAt: new Date().toISOString(),
            status: 'ACTIVE',
          });
        }
      }

      const completedAt = new Date().toISOString();
      const run: MonitoringRun = {
        id: `monrun_${Date.now()}`,
        startedAt,
        completedAt,
        status: 'COMPLETED',
        sourcesChecked,
        newOpportunitiesFound,
        newInternshipsFound,
        contactsUpdated,
        summary: `Checked ${sourcesChecked} company sources. Found ${newOpportunitiesFound} new roles (${newInternshipsFound} internships) and ${contactsUpdated} verified contacts.`,
      };

      store.addMonitoringRun(run);
      store.addEvent({
        eventType: 'MONITORING_ALERT',
        title: 'Continuous Monitoring Cycle Completed',
        description: run.summary,
        severity: newOpportunitiesFound > 0 ? 'SUCCESS' : 'INFO',
      });

      return run;
    } catch (err: any) {
      console.error('[MonitoringService] Error during monitoring cycle:', err);
      const failedRun: MonitoringRun = {
        id: `monrun_${Date.now()}`,
        startedAt,
        completedAt: new Date().toISOString(),
        status: 'FAILED',
        sourcesChecked,
        newOpportunitiesFound,
        newInternshipsFound,
        contactsUpdated,
        summary: `Monitoring cycle encountered an error: ${err?.message || 'Unknown error'}`,
      };
      store.addMonitoringRun(failedRun);
      return failedRun;
    } finally {
      this.isRunning = false;
    }
  }

  public startBackgroundScheduler(intervalMinutes = 30) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    const ms = Math.max(5, intervalMinutes) * 60 * 1000;
    console.log(`[MonitoringService] Starting continuous background scheduler every ${intervalMinutes} minutes.`);
    this.timer = setInterval(() => {
      this.runMonitoringCycle(5).catch((err) => {
        console.error('[MonitoringService] Background cycle error:', err);
      });
    }, ms);
  }

  public stopBackgroundScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[MonitoringService] Stopped background scheduler.');
    }
  }
}

export const monitoringService = new MonitoringService();
