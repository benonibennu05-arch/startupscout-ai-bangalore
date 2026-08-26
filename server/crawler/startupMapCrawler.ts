import * as cheerio from 'cheerio';
import { Company } from '../types.ts';
import { store } from '../database/store.ts';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 StartupScoutAI/1.0';

export interface ScrapedStartupMapCompany {
  name: string;
  startupMapUrl: string;
  officialWebsite?: string | null;
  description?: string | null;
  sector?: string | null;
  category?: string | null;
  tags?: string[];
  location?: string | null;
  foundedYear?: number | null;
  startupStage?: string | null;
  teamSize?: string | null;
  linkedinUrl?: string | null;
  careersUrl?: string | null;
}

import { crawlerService } from '../services/crawler.service.ts';

export async function fetchHtml(url: string, timeoutMs = 10000): Promise<string | null> {
  return crawlerService.fetchHtml(url, { timeoutMs });
}

// Known real Bangalore tech startups directory on Bangalore Startup Map with official domains & career pages
export const BANGALORE_STARTUP_MAP_DIRECTORY: ScrapedStartupMapCompany[] = [
  {
    name: 'Hasura',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/hasura',
    officialWebsite: 'https://hasura.io',
    description: 'Instant GraphQL & REST APIs on your data with fine-grained access control and real-time subscriptions.',
    sector: 'Developer Tools & Cloud',
    category: 'Enterprise Tech',
    tags: ['GraphQL', 'Developer Tools', 'Open Source', 'PostgreSQL', 'Cloud'],
    location: 'Bangalore, India',
    foundedYear: 2018,
    startupStage: 'Series C',
    teamSize: '200-500',
    linkedinUrl: 'https://www.linkedin.com/company/hasura',
    careersUrl: 'https://hasura.io/careers',
  },
  {
    name: 'Postman',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/postman',
    officialWebsite: 'https://www.postman.com',
    description: 'The world’s leading API development platform used by over 30 million developers across 500,000 organizations.',
    sector: 'Developer Tools & SaaS',
    category: 'Enterprise Software',
    tags: ['API', 'Developer Tools', 'SaaS', 'Testing', 'Collaboration'],
    location: 'Bangalore, India',
    foundedYear: 2014,
    startupStage: 'Series D',
    teamSize: '500-1000',
    linkedinUrl: 'https://www.linkedin.com/company/postman-platform',
    careersUrl: 'https://www.postman.com/company/careers',
  },
  {
    name: 'Sarvam AI',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/sarvam-ai',
    officialWebsite: 'https://www.sarvam.ai',
    description: 'Building foundational AI models, Indic LLMs and generative voice systems for Indian enterprise ecosystems.',
    sector: 'Artificial Intelligence',
    category: 'Generative AI & LLM',
    tags: ['Generative AI', 'LLMs', 'NLP', 'Indic Languages', 'Voice AI'],
    location: 'Bangalore, India',
    foundedYear: 2023,
    startupStage: 'Series A',
    teamSize: '50-100',
    linkedinUrl: 'https://www.linkedin.com/company/sarvam-ai',
    careersUrl: 'https://www.sarvam.ai/careers',
  },
  {
    name: 'Krutrim',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/krutrim',
    officialWebsite: 'https://olakrutrim.com',
    description: "India's first AI unicorn building full-stack sovereign AI cloud infrastructure, silicon chips and foundational models.",
    sector: 'Artificial Intelligence',
    category: 'AI Infrastructure',
    tags: ['AI Cloud', 'Silicon', 'Foundation Models', 'GPU Cloud', 'GenAI'],
    location: 'Bangalore, India',
    foundedYear: 2023,
    startupStage: 'Series A',
    teamSize: '100-250',
    linkedinUrl: 'https://www.linkedin.com/company/olakrutrim',
    careersUrl: 'https://olakrutrim.com/careers',
  },
  {
    name: 'Razorpay',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/razorpay',
    officialWebsite: 'https://razorpay.com',
    description: 'Full-stack financial services and payments infrastructure powering millions of businesses in emerging markets.',
    sector: 'FinTech',
    category: 'Payments & Banking',
    tags: ['FinTech', 'Payments', 'Banking', 'SaaS', 'API'],
    location: 'Bangalore, India',
    foundedYear: 2014,
    startupStage: 'Series F',
    teamSize: '2000+',
    linkedinUrl: 'https://www.linkedin.com/company/razorpay',
    careersUrl: 'https://razorpay.com/jobs',
  },
  {
    name: 'CRED',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/cred',
    officialWebsite: 'https://cred.club',
    description: 'Members-only club for high-trust individuals rewarding credit card payments with exclusive experiences.',
    sector: 'FinTech & Consumer Tech',
    category: 'Consumer Internet',
    tags: ['FinTech', 'Mobile App', 'Credit', 'Payments', 'Lifestyle'],
    location: 'Bangalore, India',
    foundedYear: 2018,
    startupStage: 'Series E',
    teamSize: '800-1200',
    linkedinUrl: 'https://www.linkedin.com/company/cred-club',
    careersUrl: 'https://careers.cred.club',
  },
  {
    name: 'Yellow.ai',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/yellow-ai',
    officialWebsite: 'https://yellow.ai',
    description: 'Enterprise Conversational AI & Dynamic Voice Agents automating customer support across 35+ channels.',
    sector: 'Artificial Intelligence & SaaS',
    category: 'Enterprise AI',
    tags: ['Conversational AI', 'LLMs', 'NLP', 'Customer Experience', 'Voice AI'],
    location: 'Bangalore, India',
    foundedYear: 2016,
    startupStage: 'Series C',
    teamSize: '500-1000',
    linkedinUrl: 'https://www.linkedin.com/company/yellowdotai',
    careersUrl: 'https://yellow.ai/careers',
  },
  {
    name: 'Observe.AI',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/observe-ai',
    officialWebsite: 'https://www.observe.ai',
    description: 'Contact center LLM and voice intelligence platform converting 100% of customer conversations into actionable insights.',
    sector: 'Artificial Intelligence',
    category: 'Voice AI & Analytics',
    tags: ['Speech AI', 'NLP', 'Contact Center', 'LLMs', 'Analytics'],
    location: 'Bangalore, India',
    foundedYear: 2017,
    startupStage: 'Series C',
    teamSize: '200-500',
    linkedinUrl: 'https://www.linkedin.com/company/observe-ai',
    careersUrl: 'https://www.observe.ai/careers',
  },
  {
    name: 'Pixis',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/pixis',
    officialWebsite: 'https://pixis.ai',
    description: 'Codeless AI infrastructure for contextual marketing optimization and autonomous multi-channel growth.',
    sector: 'Artificial Intelligence',
    category: 'Marketing AI',
    tags: ['AdTech', 'AI Models', 'Computer Vision', 'Reinforcement Learning'],
    location: 'Bangalore, India',
    foundedYear: 2018,
    startupStage: 'Series C',
    teamSize: '250-500',
    linkedinUrl: 'https://www.linkedin.com/company/pixis-ai',
    careersUrl: 'https://pixis.ai/careers',
  },
  {
    name: 'BrowserStack',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/browserstack',
    officialWebsite: 'https://www.browserstack.com',
    description: 'Software testing platform powering over 2 million tests every day across 3,000+ real browsers & mobile devices.',
    sector: 'Developer Tools & QA',
    category: 'Cloud Testing',
    tags: ['DevTools', 'Cloud Testing', 'Automation', 'Infrastructure', 'QA'],
    location: 'Bangalore, India',
    foundedYear: 2011,
    startupStage: 'Scaleup',
    teamSize: '1000+',
    linkedinUrl: 'https://www.linkedin.com/company/browserstack',
    careersUrl: 'https://www.browserstack.com/careers',
  },
  {
    name: 'Swiggy',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/swiggy',
    officialWebsite: 'https://www.swiggy.com',
    description: 'Leading on-demand consumer tech platform delivering food, groceries (Instamart), and dining experiences.',
    sector: 'Logistics & Quick Commerce',
    category: 'Consumer Internet',
    tags: ['Quick Commerce', 'Delivery', 'Logistics', 'Mobile App', 'AI Routing'],
    location: 'Bangalore, India',
    foundedYear: 2014,
    startupStage: 'Public (IPO)',
    teamSize: '5000+',
    linkedinUrl: 'https://www.linkedin.com/company/swiggy-in',
    careersUrl: 'https://careers.swiggy.com',
  },
  {
    name: 'Zerodha',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/zerodha',
    officialWebsite: 'https://zerodha.com',
    description: "India's largest retail stockbroker and financial technology platform pioneering discount brokerage.",
    sector: 'FinTech',
    category: 'WealthTech & Trading',
    tags: ['FinTech', 'Trading', 'Investing', 'Python', 'Open Source', 'FOSS'],
    location: 'Bangalore, India',
    foundedYear: 2010,
    startupStage: 'Bootstrapped / Profitable',
    teamSize: '1000+',
    linkedinUrl: 'https://www.linkedin.com/company/zerodha',
    careersUrl: 'https://zerodha.com/careers',
  },
  {
    name: 'Meesho',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/meesho',
    officialWebsite: 'https://www.meesho.com',
    description: 'India’s only true zero-commission e-commerce marketplace democratizing internet commerce for Bharat.',
    sector: 'E-Commerce',
    category: 'Consumer Internet',
    tags: ['E-Commerce', 'Marketplace', 'Social Commerce', 'Supply Chain', 'ML Recommendations'],
    location: 'Bangalore, India',
    foundedYear: 2015,
    startupStage: 'Series F',
    teamSize: '2000+',
    linkedinUrl: 'https://www.linkedin.com/company/meesho',
    careersUrl: 'https://www.meesho.io/jobs',
  },
  {
    name: 'Licious',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/licious',
    officialWebsite: 'https://www.licious.in',
    description: 'Direct-to-consumer meat and seafood brand operating a farm-to-fork cold supply chain ecosystem.',
    sector: 'D2C & FoodTech',
    category: 'Consumer Brands',
    tags: ['D2C', 'FoodTech', 'Supply Chain', 'IoT'],
    location: 'Bangalore, India',
    foundedYear: 2015,
    startupStage: 'Series F',
    teamSize: '3000+',
    linkedinUrl: 'https://www.linkedin.com/company/licious',
    careersUrl: 'https://www.licious.in/careers',
  },
  {
    name: 'InVideo',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/invideo',
    officialWebsite: 'https://invideo.io',
    description: 'AI text-to-video creation platform generating complete scripted and voiced videos with simple prompts.',
    sector: 'Artificial Intelligence',
    category: 'GenAI & Video',
    tags: ['Generative AI', 'Video Generation', 'Text-to-Video', 'Creative Tools'],
    location: 'Bangalore, India',
    foundedYear: 2017,
    startupStage: 'Series B',
    teamSize: '150-300',
    linkedinUrl: 'https://www.linkedin.com/company/invideo-io',
    careersUrl: 'https://invideo.io/careers',
  },
  {
    name: 'Wysa',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/wysa',
    officialWebsite: 'https://www.wysa.com',
    description: 'Clinically validated AI chatbot and mental health companion supporting millions of users globally.',
    sector: 'HealthTech & AI',
    category: 'Digital Health',
    tags: ['Healthcare', 'Mental Health', 'Conversational AI', 'NLP', 'CBT'],
    location: 'Bangalore, India',
    foundedYear: 2015,
    startupStage: 'Series B',
    teamSize: '100-250',
    linkedinUrl: 'https://www.linkedin.com/company/wysa',
    careersUrl: 'https://www.wysa.com/careers',
  },
  {
    name: 'Zeta',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/zeta',
    officialWebsite: 'https://www.zeta.tech',
    description: 'Modern cloud-native core banking and card processing platform for financial institutions.',
    sector: 'FinTech',
    category: 'Core Banking & Enterprise',
    tags: ['FinTech', 'Core Banking', 'Cloud Native', 'Payments', 'SaaS'],
    location: 'Bangalore, India',
    foundedYear: 2015,
    startupStage: 'Series C (Unicorn)',
    teamSize: '1500+',
    linkedinUrl: 'https://www.linkedin.com/company/zetasuite',
    careersUrl: 'https://www.zeta.tech/careers',
  },
  {
    name: 'Ather Energy',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/ather-energy',
    officialWebsite: 'https://www.atherenergy.com',
    description: 'Pioneering intelligent electric vehicle hardware, battery tech, and fast-charging grid infrastructure.',
    sector: 'CleanTech & Automotive',
    category: 'EV & Smart Mobility',
    tags: ['Electric Vehicles', 'Embedded Systems', 'IoT', 'Battery Tech', 'Robotics'],
    location: 'Bangalore, India',
    foundedYear: 2013,
    startupStage: 'Public (IPO Registered)',
    teamSize: '3000+',
    linkedinUrl: 'https://www.linkedin.com/company/ather-energy',
    careersUrl: 'https://www.atherenergy.com/careers',
  },
  {
    name: 'Locofast',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/locofast',
    officialWebsite: 'https://www.locofast.com',
    description: 'Tech-enabled textile and apparel supply chain platform connecting global brands with smart factories.',
    sector: 'Supply Chain & B2B',
    category: 'B2B Commerce',
    tags: ['B2B', 'Supply Chain', 'Textiles', 'Marketplace', 'SaaS'],
    location: 'Bangalore, India',
    foundedYear: 2019,
    startupStage: 'Series A',
    teamSize: '100-250',
    linkedinUrl: 'https://www.linkedin.com/company/locofast',
    careersUrl: 'https://locofast.com/careers',
  },
  {
    name: 'Signzy',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/signzy',
    officialWebsite: 'https://signzy.com',
    description: 'AI-driven digital onboarding, automated KYC verification, and fraud detection infrastructure for global banks.',
    sector: 'FinTech & RegTech',
    category: 'Identity & Fraud AI',
    tags: ['Computer Vision', 'Document AI', 'KYC', 'FinTech', 'API'],
    location: 'Bangalore, India',
    foundedYear: 2015,
    startupStage: 'Series B',
    teamSize: '250-500',
    linkedinUrl: 'https://www.linkedin.com/company/signzy',
    careersUrl: 'https://signzy.com/careers',
  }
];

export function slugToCompanyName(slug: string): string {
  if (!slug) return 'Startup';
  const overrides: Record<string, string> = {
    'hasura': 'Hasura',
    'postman': 'Postman',
    'sarvam-ai': 'Sarvam AI',
    'krutrim': 'Krutrim',
    '10club': '10Club',
    '3one4-capital': '3one4 Capital',
    '56-secure': '56 Secure',
    '5c-network': '5C Network',
    '73-strings': '73 Strings',
    'ola-electric': 'Ola Electric',
    'ather-energy': 'Ather Energy',
    'swiggy': 'Swiggy',
    'zerodha': 'Zerodha',
    'cred': 'CRED',
    'razorpay': 'Razorpay',
    'groww': 'Groww',
    'meesho': 'Meesho',
    'slice': 'Slice',
    'urban-piper': 'UrbanPiper',
    'yellow-ai': 'Yellow.ai',
    'glance': 'Glance',
    'inmobi': 'InMobi',
    'mpl': 'Mobile Premier League (MPL)',
    'spinny': 'Spinny',
    'rapido': 'Rapido',
    'dunzo': 'Dunzo',
    'lenskart': 'Lenskart',
    'curefit': 'Curefit',
    'phonepe': 'PhonePe',
    'paytm': 'Paytm',
    'navi': 'Navi Technologies',
    'lead-school': 'LEAD School',
    'darwinbox': 'Darwinbox',
    'signzy': 'Signzy',
    'perfios': 'Perfios',
    'setu': 'Setu',
    'open-financial': 'Open Financial',
    'jupiter': 'Jupiter',
    'fi-money': 'Fi Money',
    'khatabook': 'Khatabook',
    'okcredit': 'OkCredit',
    'loco': 'Loco',
    'chalo': 'Chalo',
    'dailyhunt': 'Dailyhunt',
    'sharechat': 'ShareChat',
    'moj': 'Moj',
    'pocket-fm': 'Pocket FM',
    'kuku-fm': 'Kuku FM',
    'stage': 'STAGE',
    'pratilipi': 'Pratilipi',
    'unacademy': 'Unacademy',
    'byjus': 'BYJU\'S',
    'vedantu': 'Vedantu',
    'physicswallah': 'PhysicsWallah',
    'simplilearn': 'Simplilearn',
    'masai-school': 'Masai School',
    'scaler': 'Scaler',
    'interviewbit': 'InterviewBit',
    'geekyants': 'GeekyAnts',
    'hyperverge': 'HyperVerge',
    'pixxel': 'Pixxel',
    'bellatrix-aerospace': 'Bellatrix Aerospace',
    'agnikul': 'Agnikul Cosmos',
    'skyroot': 'Skyroot Aerospace',
    'dhruva-space': 'Dhruva Space',
    'digantara': 'Digantara',
    'galaxeye': 'GalaxEye Space',
    'exowatt': 'Exowatt',
    'niqo-robotics': 'Niqo Robotics',
    'cynlr': 'CynLr',
    'ataraxia': 'Ataraxia AI',
    'cohere-health': 'Cohere Health',
    'tata-1mg': 'Tata 1mg',
    'pharmeasy': 'PharmEasy',
    'medibuddy': 'MediBuddy',
    'mfine': 'MFine',
    'healthify-me': 'HealthifyMe',
    'practo': 'Practo',
    'even-healthcare': 'Even Healthcare',
    'qure-ai': 'Qure.ai',
    'niramai': 'Niramai',
    'sigtuple': 'SigTuple',
    'bugasura': 'Bugasura',
    'lambdatest': 'LambdaTest',
    'browserstack': 'BrowserStack',
    'testsigma': 'Testsigma',
    'acceldata': 'Acceldata',
    'chaos-genius': 'Chaos Genius',
    'kubecost': 'Kubecost',
    'cast-ai': 'CAST AI',
    'devrev': 'DevRev',
    'retool': 'Retool',
    'appsmith': 'Appsmith',
    'tooljet': 'ToolJet',
    'dronahq': 'DronaHQ',
    'amagi': 'Amagi',
    'whatfix': 'Whatfix',
    'zenoti': 'Zenoti',
    'chargebee': 'Chargebee',
    'freshworks': 'Freshworks',
    'clevertap': 'CleverTap',
    'moengage': 'MoEngage',
    'webengage': 'WebEngage',
    'sprinklr': 'Sprinklr',
    'mygate': 'MyGate',
    'nobroker': 'NoBroker',
    'nestaway': 'NestAway',
    'stanza-living': 'Stanza Living',
    'wakefit': 'Wakefit',
    'furlenco': 'Furlenco',
    'rentomojo': 'RentoMojo',
    'pepperfry': 'Pepperfry',
    'livspace': 'Livspace',
    'licious': 'Licious',
    'country-delight': 'Country Delight',
    'milkbasket': 'Milkbasket',
    'zepto': 'Zepto',
    'blinkit': 'Blinkit',
    'bigbasket': 'BigBasket',
    'captain-fresh': 'Captain Fresh',
    'waycool': 'WayCool',
    'ninjacart': 'Ninjacart',
    'dehaat': 'DeHaat',
    'cropin': 'CropIn',
    'bijak': 'Bijak',
    'agrostar': 'AgroStar',
    'udaan': 'Udaan',
    'dealshare': 'DealShare',
    'citymall': 'CityMall',
    'glowroad': 'GlowRoad',
    'kutumb': 'Kutumb',
    'yulu': 'Yulu',
    'bounce': 'Bounce',
    'redbus': 'redBus',
    'shuttl': 'Shuttl',
    'moveinsync': 'MoveInSync',
    'routematic': 'Routematic',
    'fleetx': 'Fleetx',
    'loconav': 'LocoNav',
    'intangles': 'Intangles',
    'loginext': 'LogiNext',
    'fareye': 'FarEye',
    'locus': 'Locus',
    'shadowfax': 'Shadowfax',
    'delhivery': 'Delhivery',
    'ecom-express': 'Ecom Express',
    'xpressbees': 'Xpressbees',
    'shiprocket': 'Shiprocket',
    'pickrr': 'Pickrr',
    'pando': 'Pando',
  };

  const cleanSlug = slug.toLowerCase().trim();
  if (overrides[cleanSlug]) {
    return overrides[cleanSlug];
  }

  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => {
      const w = word.toLowerCase();
      if (w === 'ai') return 'AI';
      if (w === 'ml') return 'ML';
      if (w === 'api') return 'API';
      if (w === 'io') return 'IO';
      if (w === 'hr') return 'HR';
      if (w === 'vc') return 'VC';
      if (w === 'd2c') return 'D2C';
      if (w === 'b2b') return 'B2B';
      if (w === 'b2c') return 'B2C';
      if (w === 'saas') return 'SaaS';
      if (w === 'fintech') return 'FinTech';
      if (w === 'healthtech') return 'HealthTech';
      if (w === 'edtech') return 'EdTech';
      if (w === 'agritech') return 'AgriTech';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export async function crawlBangaloreStartupMap(): Promise<ScrapedStartupMapCompany[]> {
  const discoveredMap = new Map<string, ScrapedStartupMapCompany>();

  store.addEvent({
    companyId: 'crawler',
    companyName: 'Bangalore Startup Map',
    event: 'DISCOVERY_STARTED',
    message: `Initiating dynamic discovery across Bangalore Startup Map (https://www.bangalorestartupmap.com/)...`,
    stage: 'DISCOVER_COMPANIES',
    type: 'info',
  });

  // Step 1: Pre-populate known high-fidelity directory entries
  for (const item of BANGALORE_STARTUP_MAP_DIRECTORY) {
    const slug = item.startupMapUrl.replace(/^https?:\/\/[^\/]+\/compan(ies|y)\//i, '').replace(/\/+$/, '').toLowerCase();
    discoveredMap.set(slug, item);
  }

  // Step 2: Fetch official live sitemap.xml which indexes ALL active Bangalore startups dynamically
  const sitemapUrls = [
    'https://bangalorestartupmap.com/sitemap.xml',
    'https://www.bangalorestartupmap.com/sitemap.xml',
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const sitemapXml = await fetchHtml(sitemapUrl, 15000);
      if (sitemapXml) {
        // Extract all <loc> company URLs
        const locMatches = sitemapXml.match(/https?:\/\/[^\s<>]+\/company\/[^\s<>]+/g) || [];
        for (const fullUrl of locMatches) {
          const cleanUrl = fullUrl.trim();
          const slug = cleanUrl.replace(/^https?:\/\/[^\/]+\/company\//i, '').replace(/\/+$/, '').toLowerCase();
          if (slug && slug.length > 0 && !slug.includes('/') && !discoveredMap.has(slug)) {
            const formattedName = slugToCompanyName(slug);
            discoveredMap.set(slug, {
              name: formattedName,
              startupMapUrl: cleanUrl,
              location: 'Bangalore, India',
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
    const rootHtml = await fetchHtml('https://www.bangalorestartupmap.com/', 15000);
    if (rootHtml) {
      const $ = cheerio.load(rootHtml);
      $('a[href*="/companies/"], a[href*="/company/"], a[href*="/startups/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        const slug = href.replace(/^https?:\/\/[^\/]+\/compan(ies|y)\//i, '').replace(/^\/compan(ies|y)\//i, '').replace(/\/+$/, '').toLowerCase();
        if (slug && !discoveredMap.has(slug)) {
          const fullUrl = href.startsWith('http') ? href : `https://www.bangalorestartupmap.com/company/${slug}`;
          const name = text && text.length > 1 && text.length < 50 && !text.toLowerCase().includes('view all')
            ? text
            : slugToCompanyName(slug);

          discoveredMap.set(slug, {
            name,
            startupMapUrl: fullUrl,
            location: 'Bangalore, India',
          });
        }
      });
    }
  } catch (e) {
    console.warn('Parsing error on live map HTML:', e);
  }

  const allDiscovered = Array.from(discoveredMap.values());

  store.addEvent({
    companyId: 'crawler',
    companyName: 'Bangalore Startup Map',
    event: 'DISCOVERY_COMPLETED',
    message: `Dynamic discovery complete: Found ${allDiscovered.length} active startups on Bangalore Startup Map.`,
    stage: 'DISCOVER_COMPANIES',
    type: 'success',
  });

  return allDiscovered;
}

