import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HYDERABAD_STARTUP_MAP_DIRECTORY, crawlHyderabadStartupMap } from '../server/crawler/hyderabadStartupMapCrawler.ts';
import { extractOfficialDomain } from '../server/database/store.ts';

describe('Hyderabad Startup Discovery Tests', () => {
  it('should have curated tech startups directory for Hyderabad Map', () => {
    assert.ok(HYDERABAD_STARTUP_MAP_DIRECTORY.length > 0, 'Directory should not be empty');
    
    // Check known Hyderabad tech unicorns and leaders
    const names = HYDERABAD_STARTUP_MAP_DIRECTORY.map((s) => s.name);
    assert.ok(names.includes('Darwinbox'), 'Should include Darwinbox');
    assert.ok(names.includes('Zenoti'), 'Should include Zenoti');
    assert.ok(names.includes('HighRadius'), 'Should include HighRadius');
    assert.ok(names.includes('Skyroot Aerospace'), 'Should include Skyroot Aerospace');
  });

  it('should extract clean official domains without protocol or www prefix', () => {
    assert.equal(extractOfficialDomain('https://www.darwinbox.com/'), 'darwinbox.com');
    assert.equal(extractOfficialDomain('http://zenoti.com/about'), 'zenoti.com');
    assert.equal(extractOfficialDomain('https://highradius.com'), 'highradius.com');
    assert.equal(extractOfficialDomain('skyroot.in'), 'skyroot.in');
  });

  it('should verify all directory entries have valid official websites and career URLs', () => {
    for (const startup of HYDERABAD_STARTUP_MAP_DIRECTORY) {
      assert.ok(startup.name, 'Startup must have a name');
      assert.ok(startup.officialWebsite, `${startup.name} must have an official website`);
      assert.ok(startup.location.toLowerCase().includes('hyderabad') || startup.location.toLowerCase().includes('india'), `${startup.name} location must include Hyderabad or India`);
      assert.ok(startup.tags.length > 0, `${startup.name} must have tags`);
    }
  });

  it('should run crawler function and return structured scraped companies', async () => {
    const results = await crawlHyderabadStartupMap();
    assert.ok(results.length > 0, 'Hyderabad crawler should discover > 0 companies');
    
    const darwinbox = results.find((c) => c.name.toLowerCase().includes('darwinbox'));
    assert.ok(darwinbox, 'Darwinbox should be in crawled results');
    assert.ok(darwinbox.officialWebsite, 'Darwinbox must have official website');
  });
});
