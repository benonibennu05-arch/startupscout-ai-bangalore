import * as cheerio from 'cheerio';
import { Company } from '../types.ts';
import { store } from '../database/store.ts';
import { crawlerService } from './crawler.service.ts';
import { extractCompanyFromStartupMapPage } from '../extractors/company.extractor.ts';
import { BANGALORE_STARTUP_MAP_DIRECTORY, ScrapedStartupMapCompany, crawlBangaloreStartupMap } from '../crawler/startupMapCrawler.ts';
import { logger } from '../utils/logger.ts';

const STARTING_URL = 'https://www.bangalorestartupmap.com/';

export class StartupMapService {
  /**
   * Crawl Bangalore Startup Map to discover all startups, extract profiles, and persist into database
   */
  public async discoverCompanies(): Promise<{ discovered: number; totalStored: number }> {
    logger.info(`Starting dynamic Bangalore Startup Map discovery...`);

    const allDiscovered = await crawlBangaloreStartupMap();

    // Persist all into database with upsert deduplication
    let newlyStored = 0;
    for (const item of allDiscovered) {
      if (item.name) {
        store.upsertCompany({
          name: item.name,
          startupMapUrl: item.startupMapUrl || 'https://www.bangalorestartupmap.com/',
          officialWebsite: item.officialWebsite || null,
          description: item.description || null,
          sector: item.sector || null,
          category: item.category || null,
          tags: item.tags || [],
          location: item.location || 'Bangalore, India',
          foundedYear: item.foundedYear || null,
          startupStage: item.startupStage || null,
          teamSize: item.teamSize || null,
          linkedinUrl: item.linkedinUrl || null,
          careersUrl: item.careersUrl || null,
        });
        newlyStored++;
      }
    }

    const totalStored = store.getCompanies().length;

    store.addEvent({
      companyId: 'crawler',
      companyName: 'Bangalore Startup Map',
      event: 'DISCOVERY_COMPLETED',
      message: `Dynamic discovery indexed ${allDiscovered.length} startups from Bangalore Startup Map. Total stored: ${totalStored}.`,
      stage: 'DISCOVER_COMPANIES',
      type: 'success',
    });

    logger.info(`Completed startup discovery. Total companies in database: ${totalStored}`);
    return { discovered: allDiscovered.length, totalStored };
  }
}

export const startupMapService = new StartupMapService();
