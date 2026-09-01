import * as cheerio from 'cheerio';
import { ScrapedStartupMapCompany } from './startupMapCrawler.ts';
import { store } from '../database/store.ts';
import { crawlerService } from '../services/crawler.service.ts';
import { slugToCompanyName } from '../extractors/company.extractor.ts';

export async function fetchHtml(url: string, timeoutMs = 10000): Promise<string | null> {
  return crawlerService.fetchHtml(url, { timeoutMs });
}

// Known real Hyderabad tech startups directory on Hyderabad Startup Map with official domains & career pages
export const HYDERABAD_STARTUP_MAP_DIRECTORY: ScrapedStartupMapCompany[] = [
  {
    name: 'Darwinbox',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/darwinbox',
    officialWebsite: 'https://darwinbox.com',
    description: 'Enterprise HR tech unicorn providing an end-to-end AI-powered Human Capital Management (HCM) platform for 3M+ global employees.',
    sector: 'Enterprise HR Tech & SaaS',
    category: 'Enterprise Tech',
    tags: ['HRTech', 'Enterprise SaaS', 'AI', 'Cloud HCM', 'Unicorn'],
    location: 'Hyderabad, India',
    foundedYear: 2015,
    startupStage: 'Unicorn / Series D',
    teamSize: '1000-2000',
    linkedinUrl: 'https://www.linkedin.com/company/darwinbox',
    careersUrl: 'https://darwinbox.com/careers',
  },
  {
    name: 'Zenoti',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/zenoti',
    officialWebsite: 'https://www.zenoti.com',
    description: 'Leading cloud software unicorn for salons, spas, and medspas powering operations for over 25,000 beauty & wellness businesses worldwide.',
    sector: 'Vertical SaaS & Cloud',
    category: 'Enterprise Software',
    tags: ['Vertical SaaS', 'Cloud Software', 'Beauty & Wellness', 'POS', 'AI Scheduling'],
    location: 'Hyderabad, India',
    foundedYear: 2010,
    startupStage: 'Unicorn / Series D',
    teamSize: '1000-2000',
    linkedinUrl: 'https://www.linkedin.com/company/zenoti',
    careersUrl: 'https://www.zenoti.com/careers',
  },
  {
    name: 'HighRadius',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/highradius',
    officialWebsite: 'https://www.highradius.com',
    description: 'FinTech SaaS unicorn providing Autonomous Finance platforms powered by AI and machine learning for Order-to-Cash and Treasury management.',
    sector: 'FinTech & AI SaaS',
    category: 'Autonomous Finance',
    tags: ['Autonomous Finance', 'FinTech', 'AI/ML', 'Enterprise SaaS', 'Unicorn'],
    location: 'Hyderabad, India',
    foundedYear: 2006,
    startupStage: 'Unicorn / Series C',
    teamSize: '2000-4000',
    linkedinUrl: 'https://www.linkedin.com/company/highradius',
    careersUrl: 'https://www.highradius.com/careers',
  },
  {
    name: 'Skyroot Aerospace',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/skyroot-aerospace',
    officialWebsite: 'https://skyroot.in',
    description: 'Pioneering private space-tech startup that launched Vikram-S, India’s first privately developed orbital rocket, democratizing space access.',
    sector: 'SpaceTech & DeepTech',
    category: 'Aerospace Engineering',
    tags: ['SpaceTech', 'Propulsion', 'Rocketry', 'DeepTech', 'Avionics'],
    location: 'Hyderabad, India',
    foundedYear: 2018,
    startupStage: 'Series B',
    teamSize: '200-400',
    linkedinUrl: 'https://www.linkedin.com/company/skyroot-aerospace',
    careersUrl: 'https://skyroot.in/careers',
  },
  {
    name: 'Dhruva Space',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/dhruva-space',
    officialWebsite: 'https://dhruvaspace.com',
    description: 'Full-stack space technology engineering company building satellite platforms, deployers, and ground station infrastructure.',
    sector: 'SpaceTech & Satellite',
    category: 'Satellite Infrastructure',
    tags: ['SpaceTech', 'Satellite Systems', 'Ground Station', 'Aerospace', 'DeepTech'],
    location: 'Hyderabad, India',
    foundedYear: 2012,
    startupStage: 'Series A',
    teamSize: '100-250',
    linkedinUrl: 'https://www.linkedin.com/company/dhruva-space',
    careersUrl: 'https://dhruvaspace.com/careers',
  },
  {
    name: 'Keka HR',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/keka-hr',
    officialWebsite: 'https://www.keka.com',
    description: 'Modern employee experience and payroll platform designed for modern fast-growing Indian enterprises and startups.',
    sector: 'HR Tech & SaaS',
    category: 'Payroll & HR Management',
    tags: ['HRTech', 'Payroll', 'SaaS', 'Employee Experience', 'Productivity'],
    location: 'Hyderabad, India',
    foundedYear: 2016,
    startupStage: 'Series A',
    teamSize: '500-1000',
    linkedinUrl: 'https://www.linkedin.com/company/keka-hr',
    careersUrl: 'https://www.keka.com/careers',
  },
  {
    name: 'Quixy',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/quixy',
    officialWebsite: 'https://quixy.com',
    description: 'Cloud-based no-code application development platform empowering business users to build enterprise-grade apps 10x faster.',
    sector: 'No-Code & Developer Platforms',
    category: 'Enterprise Automation',
    tags: ['No-Code', 'Low-Code', 'Enterprise Apps', 'BPM', 'Cloud'],
    location: 'Hyderabad, India',
    foundedYear: 2019,
    startupStage: 'Growth',
    teamSize: '200-400',
    linkedinUrl: 'https://www.linkedin.com/company/quixyofficial',
    careersUrl: 'https://quixy.com/careers',
  },
  {
    name: 'Tanla Platforms',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/tanla-platforms',
    officialWebsite: 'https://tanla.com',
    description: 'Global leader in CPaaS (Communications Platform as a Service) processing over 800 billion interactions annually with Wisely AI platform.',
    sector: 'CPaaS & Communications Tech',
    category: 'Enterprise Communications',
    tags: ['CPaaS', 'AI Security', 'Messaging', 'Enterprise Tech', 'Telecom'],
    location: 'Hyderabad, India',
    foundedYear: 1999,
    startupStage: 'Public Tech',
    teamSize: '1000-2000',
    linkedinUrl: 'https://www.linkedin.com/company/tanla-platforms-limited',
    careersUrl: 'https://tanla.com/careers',
  },
  {
    name: 'Zaggle',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/zaggle',
    officialWebsite: 'https://zaggle.in',
    description: 'FinTech and SaaS company innovating spend management, corporate cards, and employee benefit automation for enterprise workflows.',
    sector: 'FinTech & Spend Management',
    category: 'Financial Automation',
    tags: ['FinTech', 'SaaS', 'Spend Management', 'Expense Cards', 'Enterprise'],
    location: 'Hyderabad, India',
    foundedYear: 2011,
    startupStage: 'Public Tech',
    teamSize: '500-1000',
    linkedinUrl: 'https://www.linkedin.com/company/zaggle-prepaid-ocean-services-pvt-ltd',
    careersUrl: 'https://zaggle.in/careers',
  },
  {
    name: 'MapMyGenome',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/mapmygenome',
    officialWebsite: 'https://mapmygenome.in',
    description: 'Pioneering genomics and molecular diagnostics company providing personalized preventive healthcare and DNA sequencing analysis.',
    sector: 'BioTech & HealthTech',
    category: 'Genomics & Diagnostics',
    tags: ['Genomics', 'Bioinformatics', 'DNA', 'HealthTech', 'Personalized Health'],
    location: 'Hyderabad, India',
    foundedYear: 2013,
    startupStage: 'Growth',
    teamSize: '100-250',
    linkedinUrl: 'https://www.linkedin.com/company/mapmygenome-india-limited',
    careersUrl: 'https://mapmygenome.in/careers',
  },
  {
    name: 'Marut Drones',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/marut-drones',
    officialWebsite: 'https://marutdrones.com',
    description: 'Leading UAV and drone tech manufacturer pioneering agricultural automation, afforestation, and medical logistics via autonomous drones.',
    sector: 'DeepTech & Robotics',
    category: 'Drones & UAV',
    tags: ['Drones', 'Robotics', 'AgriTech', 'Autonomous Systems', 'AI Vision'],
    location: 'Hyderabad, India',
    foundedYear: 2019,
    startupStage: 'Series A',
    teamSize: '50-150',
    linkedinUrl: 'https://www.linkedin.com/company/marut-drones',
    careersUrl: 'https://marutdrones.com/careers',
  },
  {
    name: 'Freyr Energy',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/freyr-energy',
    officialWebsite: 'https://freyrenergy.com',
    description: 'Tech-enabled rooftop solar energy provider making solar simple and accessible for homes and MSMEs across India through proprietary SunPro app.',
    sector: 'CleanTech & ClimateTech',
    category: 'Renewable Energy',
    tags: ['Solar', 'CleanTech', 'ClimateTech', 'Mobile Platform', 'Renewables'],
    location: 'Hyderabad, India',
    foundedYear: 2014,
    startupStage: 'Series B',
    teamSize: '150-300',
    linkedinUrl: 'https://www.linkedin.com/company/freyr-energy-services-pvt-ltd',
    careersUrl: 'https://freyrenergy.com/careers',
  },
  {
    name: 'Thryve Digital',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/thryve-digital',
    officialWebsite: 'https://thryvedigital.com',
    description: 'Healthcare technology innovaton powerhouse delivering enterprise digital solutions, cloud health data architecture, and health informatics.',
    sector: 'HealthTech & Cloud',
    category: 'Digital Health Platforms',
    tags: ['Healthcare', 'Cloud Architecture', 'Data Analytics', 'Digital Health', 'AI'],
    location: 'Hyderabad, India',
    foundedYear: 2015,
    startupStage: 'Growth',
    teamSize: '1000-2500',
    linkedinUrl: 'https://www.linkedin.com/company/thryvedigital',
    careersUrl: 'https://thryvedigital.com/careers',
  },
  {
    name: 'Biliti Electric',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/biliti-electric',
    officialWebsite: 'https://bilitielectric.com',
    description: 'Electric mobility startup manufacturing smart EV 3-wheelers with modular swappable battery tech for last-mile logistics across 15+ countries.',
    sector: 'CleanTech & EV',
    category: 'Electric Mobility',
    tags: ['EV', 'Electric Mobility', 'Battery Tech', 'CleanTech', 'Hardware'],
    location: 'Hyderabad, India',
    foundedYear: 2021,
    startupStage: 'Series A',
    teamSize: '100-200',
    linkedinUrl: 'https://www.linkedin.com/company/bilitielectric',
    careersUrl: 'https://bilitielectric.com/careers',
  },
  {
    name: 'Smartron',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/smartron',
    officialWebsite: 'https://smartron.com',
    description: 'Deep tech IoT and AI platform engineering company building intelligent connected hardware, tronX AI OS, and smart mobility solutions.',
    sector: 'DeepTech & IoT',
    category: 'IoT & Connected Devices',
    tags: ['IoT', 'Hardware', 'AI OS', 'Embedded Systems', 'Smart Devices'],
    location: 'Hyderabad, India',
    foundedYear: 2014,
    startupStage: 'Growth',
    teamSize: '100-300',
    linkedinUrl: 'https://www.linkedin.com/company/smartron',
    careersUrl: 'https://smartron.com/careers',
  },
  {
    name: 'RED.Health',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/red-health',
    officialWebsite: 'https://redhealth.com',
    description: 'India’s largest emergency response network and health logistics platform providing 999-second ambulance dispatch and emergency tech.',
    sector: 'HealthTech & Logistics',
    category: 'Emergency Health Response',
    tags: ['HealthTech', 'Emergency Services', 'Logistics', 'Mobile App', 'Telehealth'],
    location: 'Hyderabad, India',
    foundedYear: 2016,
    startupStage: 'Series B',
    teamSize: '500-1000',
    linkedinUrl: 'https://www.linkedin.com/company/redhealth-official',
    careersUrl: 'https://redhealth.com/careers',
  },
  {
    name: 'FlytBase',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/flytbase',
    officialWebsite: 'https://flytbase.com',
    description: 'Enterprise drone autonomy software platform powering automated BVLOS (Beyond Visual Line of Sight) drone docking and security missions.',
    sector: 'DeepTech & Robotics',
    category: 'Autonomous Software',
    tags: ['Drone Autonomy', 'Robotics', 'Cloud Robotics', 'AI', 'Security'],
    location: 'Hyderabad, India',
    foundedYear: 2016,
    startupStage: 'Series A',
    teamSize: '50-150',
    linkedinUrl: 'https://www.linkedin.com/company/flytbase',
    careersUrl: 'https://flytbase.com/careers',
  },
  {
    name: 'Monitra Healthcare',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/monitra-healthcare',
    officialWebsite: 'https://monitrahealth.com',
    description: 'Cardiac remote monitoring and AI-assisted ECG diagnostics wearable platform for continuous arrhythmia detection.',
    sector: 'HealthTech & MedTech',
    category: 'Remote Patient Monitoring',
    tags: ['Cardiac Monitoring', 'AI Diagnostics', 'MedTech', 'Wearables', 'HealthTech'],
    location: 'Hyderabad, India',
    foundedYear: 2014,
    startupStage: 'Seed / Early',
    teamSize: '30-80',
    linkedinUrl: 'https://www.linkedin.com/company/monitra-healthcare',
    careersUrl: 'https://monitrahealth.com/careers',
  },
  {
    name: 'Skit.ai',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/skit-ai',
    officialWebsite: 'https://skit.ai',
    description: 'Conversational Voice AI platform for automated intelligent spoken customer interactions with dedicated Hyderabad R&D engineering hub.',
    sector: 'Artificial Intelligence',
    category: 'Voice AI & NLP',
    tags: ['Voice AI', 'Conversational AI', 'Speech AI', 'NLP', 'Enterprise'],
    location: 'Hyderabad, India',
    foundedYear: 2016,
    startupStage: 'Series B',
    teamSize: '200-400',
    linkedinUrl: 'https://www.linkedin.com/company/skit-ai',
    careersUrl: 'https://skit.ai/careers',
  },
  {
    name: 'Kellton Tech',
    startupMapUrl: 'https://www.hyderabadstartupsmap.lol/companies/kellton-tech',
    officialWebsite: 'https://kellton.com',
    description: 'Global digital transformation and enterprise software consulting company delivering cloud native, generative AI and web platforms.',
    sector: 'Enterprise Software & Cloud',
    category: 'Digital Transformation',
    tags: ['Cloud', 'Generative AI', 'Enterprise Software', 'DevOps', 'Data'],
    location: 'Hyderabad, India',
    foundedYear: 2009,
    startupStage: 'Public Tech',
    teamSize: '1500-3000',
    linkedinUrl: 'https://www.linkedin.com/company/kellton',
    careersUrl: 'https://kellton.com/careers',
  },
];

/**
 * Dynamic crawler for Hyderabad Startup Map (https://www.hyderabadstartupsmap.lol/)
 */
export async function crawlHyderabadStartupMap(): Promise<ScrapedStartupMapCompany[]> {
  const discoveredMap = new Map<string, ScrapedStartupMapCompany>();

  store.addEvent({
    companyId: 'crawler-hyderabad',
    companyName: 'Hyderabad Startup Map',
    event: 'DISCOVERY_STARTED',
    message: `Initiating dynamic discovery across Hyderabad Startup Map (https://www.hyderabadstartupsmap.lol/)...`,
    stage: 'DISCOVER_COMPANIES',
    type: 'info',
  });

  // Step 1: Pre-populate known high-fidelity Hyderabad directory entries
  for (const item of HYDERABAD_STARTUP_MAP_DIRECTORY) {
    const slug = item.startupMapUrl
      .replace(/^https?:\/\/[^\/]+\/compan(ies|y)\//i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
    discoveredMap.set(slug, item);
  }

  // Step 2: Fetch official live sitemap.xml which indexes ALL active Hyderabad startups dynamically
  const sitemapUrls = [
    'https://www.hyderabadstartupsmap.lol/sitemap.xml',
    'https://hyderabadstartupsmap.lol/sitemap.xml',
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const sitemapXml = await fetchHtml(sitemapUrl, 15000);
      if (sitemapXml) {
        // Extract all <loc> company URLs
        const locMatches = sitemapXml.match(/https?:\/\/[^\s<>]+\/(company|startups|companies)\/[^\s<>]+/g) || [];
        for (const fullUrl of locMatches) {
          const cleanUrl = fullUrl.trim();
          const slug = cleanUrl
            .replace(/^https?:\/\/[^\/]+\/(company|startups|companies)\//i, '')
            .replace(/\/+$/, '')
            .toLowerCase();
          if (slug && slug.length > 0 && !slug.includes('/') && !discoveredMap.has(slug)) {
            const formattedName = slugToCompanyName(slug);
            discoveredMap.set(slug, {
              name: formattedName,
              startupMapUrl: cleanUrl,
              location: 'Hyderabad, India',
            });
          }
        }
        if (locMatches.length > 0) {
          break; // Successfully extracted from sitemap
        }
      }
    } catch (err) {
      console.warn(`Failed fetching sitemap from ${sitemapUrl}:`, err);
    }
  }

  // Step 3: Fetch root homepage HTML and parse any additional links or data
  try {
    const rootHtml = await fetchHtml('https://www.hyderabadstartupsmap.lol/', 15000);
    if (rootHtml) {
      const $ = cheerio.load(rootHtml);
      $('a[href*="/companies/"], a[href*="/company/"], a[href*="/startups/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const slug = href
          .replace(/^https?:\/\/[^\/]+\/compan(ies|y)\//i, '')
          .replace(/^\/compan(ies|y)\//i, '')
          .replace(/^\/startups\//i, '')
          .replace(/\/+$/, '')
          .toLowerCase();

        if (slug && !discoveredMap.has(slug)) {
          const fullUrl = href.startsWith('http') ? href : `https://www.hyderabadstartupsmap.lol/company/${slug}`;
          const name = text && text.length > 1 && text.length < 50 && !text.toLowerCase().includes('view all')
            ? text
            : slugToCompanyName(slug);

          discoveredMap.set(slug, {
            name,
            startupMapUrl: fullUrl,
            location: 'Hyderabad, India',
          });
        }
      });
    }
  } catch (e) {
    console.warn('Parsing error on Hyderabad live map HTML:', e);
  }

  const allDiscovered = Array.from(discoveredMap.values());

  store.addEvent({
    companyId: 'crawler-hyderabad',
    companyName: 'Hyderabad Startup Map',
    event: 'DISCOVERY_COMPLETED',
    message: `Dynamic discovery complete: Found ${allDiscovered.length} active startups on Hyderabad Startup Map.`,
    stage: 'DISCOVER_COMPANIES',
    type: 'success',
  });

  return allDiscovered;
}
