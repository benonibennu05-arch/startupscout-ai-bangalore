import { SourceAdapter } from './sourceAdapter.interface.ts';
import { bangaloreStartupMapAdapter } from './bangaloreStartupMap.adapter.ts';
import { hyderabadStartupMapAdapter } from './hyderabadStartupMap.adapter.ts';
import { whereWeWorkAdapter } from './whereWeWork.adapter.ts';
import { frontlinesCareerPagesAdapter } from './frontlines.adapter.ts';
import { StartupMapSource, SourceSyncResult } from '../types.ts';
import { logger } from '../utils/logger.ts';

export class AdapterRegistry {
  private adapters = new Map<string, SourceAdapter>();

  constructor() {
    this.register(bangaloreStartupMapAdapter);
    this.register(hyderabadStartupMapAdapter);
    this.register(whereWeWorkAdapter);
    this.register(frontlinesCareerPagesAdapter);
  }

  public register(adapter: SourceAdapter): void {
    const keys = [
      adapter.id,
      adapter.id.toLowerCase(),
      adapter.id.replace(/^src_/, ''),
      adapter.sourceMap,
      adapter.sourceMap.toLowerCase(),
      adapter.name.toLowerCase(),
    ];

    if (adapter.id.includes('bangalore')) {
      keys.push('bangalore', 'blr', 'bangalore_startup_map', 'bangalorestartupmap');
    }
    if (adapter.id.includes('hyderabad')) {
      keys.push('hyderabad', 'hyd', 'hyderabad_startup_map', 'hyderabadstartupsmap');
    }
    if (adapter.id.includes('wherewework')) {
      keys.push('wherewework', 'www', 'where_we_work');
    }
    if (adapter.id.includes('frontlines')) {
      keys.push('frontlines', 'frontlinesmedia', 'frontlines_career_directory', 'flm');
    }

    for (const key of keys) {
      this.adapters.set(key.toLowerCase().trim(), adapter);
    }
  }

  public getAdapter(idOrSource: string): SourceAdapter | undefined {
    if (!idOrSource) return undefined;
    const clean = idOrSource.toLowerCase().trim().replace(/^src_/, '');
    return this.adapters.get(clean) || this.adapters.get(idOrSource.toLowerCase().trim()) || this.adapters.get(idOrSource);
  }

  public get(idOrSource: string): SourceAdapter | undefined {
    return this.getAdapter(idOrSource);
  }

  public getAll(): SourceAdapter[] {
    return this.getAllAdapters();
  }

  public getAllAdapters(): SourceAdapter[] {
    // Return unique adapter instances
    return Array.from(new Set(this.adapters.values()));
  }

  public async syncAll(options: { forceFull?: boolean; queueResearch?: boolean } = {}): Promise<Record<string, SourceSyncResult>> {
    const results: Record<string, SourceSyncResult> = {};
    const uniqueAdapters = this.getAllAdapters();

    logger.info(`[AdapterRegistry] Running multi-source sync across ${uniqueAdapters.length} registered sources...`);

    for (const adapter of uniqueAdapters) {
      try {
        const res = await adapter.sync(options);
        results[adapter.id] = res;
      } catch (err: any) {
        logger.error(`[AdapterRegistry] Sync failed for adapter ${adapter.name}: ${err?.message}`);
      }
    }

    return results;
  }
}

export const adapterRegistry = new AdapterRegistry();
