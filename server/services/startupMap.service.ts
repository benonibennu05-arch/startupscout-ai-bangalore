import * as cheerio from 'cheerio';
import { Company, StartupMapSource } from '../types.ts';
import { store } from '../database/store.ts';
import { crawlerService } from './crawler.service.ts';
import { extractCompanyFromStartupMapPage } from '../extractors/company.extractor.ts';
import { BANGALORE_STARTUP_MAP_DIRECTORY, ScrapedStartupMapCompany, crawlBangaloreStartupMap } from '../crawler/startupMapCrawler.ts';
import { HYDERABAD_STARTUP_MAP_DIRECTORY, crawlHyderabadStartupMap } from '../crawler/hyderabadStartupMapCrawler.ts';
import { logger } from '../utils/logger.ts';

const BANGALORE_STARTING_URL = 'https://www.bangalorestartupmap.com/';
const HYDERABAD_STARTING_URL = 'https://www.hyderabadstartupsmap.lol/';

export class StartupMapService {
  /**
   * Crawl Bangalore Startup Map to discover all Bangalore startups
   */
  public async discoverBangalore(): Promise<{ discovered: number; totalStored: number }> {
    logger.info(`Starting dynamic Bangalore Startup Map discovery from ${BANGALORE_STARTING_URL}...`);
    const allDiscovered = await crawlBangaloreStartupMap();

    for (const item of allDiscovered) {
      if (item.name) {
        store.upsertCompany({
          name: item.name,
          startupMapUrl: item.startupMapUrl || BANGALORE_STARTING_URL,
          officialWebsite: item.officialWebsite || null,
          description: item.description || null,
          sector: item.sector || null,
          category: item.category || null,
          tags: item.tags || [],
          location: item.location || 'Bangalore, India',
          sourceMap: 'BANGALORE',
          foundedYear: item.foundedYear || null,
          startupStage: item.startupStage || null,
          teamSize: item.teamSize || null,
          linkedinUrl: item.linkedinUrl || null,
          careersUrl: item.careersUrl || null,
        });
      }
    }

    const totalStored = store.getCompanies({ location: 'BANGALORE' }).length;

    store.addEvent({
      companyId: 'crawler_blr',
      companyName: 'Bangalore Startup Map',
      event: 'DISCOVERY_COMPLETED',
      message: `Dynamic discovery indexed ${allDiscovered.length} startups from Bangalore Startup Map (${BANGALORE_STARTING_URL}). Total Bangalore startups stored: ${totalStored}.`,
      stage: 'DISCOVER_COMPANIES',
      type: 'success',
    });

    logger.info(`Completed Bangalore startup discovery. Total Bangalore startups: ${totalStored}`);
    return { discovered: allDiscovered.length, totalStored };
  }

  /**
   * Crawl Hyderabad Startup Map to discover all Hyderabad startups
   */
  public async discoverHyderabad(): Promise<{ discovered: number; totalStored: number }> {
    logger.info(`Starting dynamic Hyderabad Startup Map discovery from ${HYDERABAD_STARTING_URL}...`);
    const allDiscovered = await crawlHyderabadStartupMap();

    for (const item of allDiscovered) {
      if (item.name) {
        store.upsertCompany({
          name: item.name,
          startupMapUrl: item.startupMapUrl || HYDERABAD_STARTING_URL,
          officialWebsite: item.officialWebsite || null,
          description: item.description || null,
          sector: item.sector || null,
          category: item.category || null,
          tags: item.tags || [],
          location: item.location || 'Hyderabad, India',
          sourceMap: 'HYDERABAD',
          foundedYear: item.foundedYear || null,
          startupStage: item.startupStage || null,
          teamSize: item.teamSize || null,
          linkedinUrl: item.linkedinUrl || null,
          careersUrl: item.careersUrl || null,
        });
      }
    }

    const totalStored = store.getCompanies({ location: 'HYDERABAD' }).length;

    store.addEvent({
      companyId: 'crawler_hyd',
      companyName: 'Hyderabad Startup Map',
      event: 'DISCOVERY_COMPLETED',
      message: `Dynamic discovery indexed ${allDiscovered.length} startups from Hyderabad Startup Map (${HYDERABAD_STARTING_URL}). Total Hyderabad startups stored: ${totalStored}.`,
      stage: 'DISCOVER_COMPANIES',
      type: 'success',
    });

    logger.info(`Completed Hyderabad startup discovery. Total Hyderabad startups: ${totalStored}`);
    return { discovered: allDiscovered.length, totalStored };
  }

  /**
   * Crawl Startup Map(s) based on source selection
   */
  public async discoverCompanies(source: StartupMapSource | 'BOTH' = 'BANGALORE'): Promise<{ discovered: number; totalStored: number }> {
    if (source === 'HYDERABAD') {
      return this.discoverHyderabad();
    } else if (source === 'BOTH') {
      const blr = await this.discoverBangalore();
      const hyd = await this.discoverHyderabad();
      return {
        discovered: blr.discovered + hyd.discovered,
        totalStored: store.getCompanies().length,
      };
    } else {
      return this.discoverBangalore();
    }
  }
}

export const startupMapService = new StartupMapService();

