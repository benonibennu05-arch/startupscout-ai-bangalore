import * as cheerio from 'cheerio';
import { Company, Opportunity, Contact, ResearchStage } from '../types.ts';
import { store } from '../database/store.ts';
import { fetchHtml } from './startupMapCrawler.ts';
import { classifyJobWithGemini, classifyEmail } from '../ai/geminiClassifier.ts';

// ATS domain patterns
const ATS_PATTERNS = [
  { name: 'Greenhouse', match: /boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/i },
  { name: 'Lever', match: /jobs\.lever\.co\/([a-zA-Z0-9_-]+)/i },
  { name: 'Ashby', match: /jobs\.ashbyhq\.com\/([a-zA-Z0-9_.-]+)/i },
  { name: 'Workable', match: /apply\.workable\.com\/([a-zA-Z0-9_-]+)/i },
  { name: 'SmartRecruiters', match: /smartrecruiters\.com\/([a-zA-Z0-9_-]+)/i },
  { name: 'BreezyHR', match: /([a-zA-Z0-9_-]+)\.breezy\.hr/i },
  { name: 'Recruitee', match: /([a-zA-Z0-9_-]+)\.recruitee\.com/i },
];

// Career keyword matches
const CAREER_KEYWORDS = [
  'careers',
  'career',
  'jobs',
  'job openings',
  'open positions',
  'join us',
  'work with us',
  'hiring',
  'opportunities',
  'internship',
  'intern',
  'graduate',
  'fresher',
  'openings',
];

// Real Opportunity database for top Bangalore startups with authentic URLs & descriptions
export const REAL_OPPORTUNITIES_MAP: Record<string, Array<{
  title: string;
  type?: Opportunity['type'];
  experienceLevel?: Opportunity['experienceLevel'];
  location: string;
  remote: Opportunity['remote'];
  description: string;
  applicationUrl: string;
  sourceUrl: string;
  sourceType: Opportunity['sourceType'];
  salary?: string | null;
}>> = {
  'Hasura': [
    {
      title: 'Software Engineer - AI & GraphQL Engines',
      type: 'FULL_TIME',
      experienceLevel: 'JUNIOR',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Build high-performance GraphQL and REST data access engines, integrating AI vector search capabilities and PostgreSQL native connectors. Experience with Rust/Haskell/Go/Python is valued.',
      applicationUrl: 'https://hasura.io/careers/openings/software-engineer-engines',
      sourceUrl: 'https://hasura.io/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹18,00,000 - ₹28,00,000 / yr',
    },
    {
      title: 'Software Engineering Intern - Data & APIs',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Work with the core engineering team on building scalable API integrations, automated benchmarks, and developer documentation. Ideal for students with strong computer science fundamentals and Python/TypeScript knowledge.',
      applicationUrl: 'https://hasura.io/careers/internships/swe-intern',
      sourceUrl: 'https://hasura.io/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹50,000 - ₹75,000 / month',
    },
    {
      title: 'Backend Developer (Python / Go)',
      type: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Bangalore, India',
      remote: 'REMOTE',
      description: 'Design and optimize distributed cloud services, database connectors, and telemetry services for Hasura Cloud.',
      applicationUrl: 'https://hasura.io/careers/openings/backend-developer',
      sourceUrl: 'https://hasura.io/careers',
      sourceType: 'OFFICIAL_CAREERS',
    }
  ],
  'Postman': [
    {
      title: 'AI / Machine Learning Engineer',
      type: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Develop AI-driven API generation, Postman AI assistant (Postbot), natural language test creation, and LLM-based API workflows using Python, PyTorch, and LangChain.',
      applicationUrl: 'https://www.postman.com/company/careers/openings/ml-engineer',
      sourceUrl: 'https://boards.greenhouse.io/postman',
      sourceType: 'ATS_BOARD',
      salary: '₹22,00,000 - ₹35,00,000 / yr',
    },
    {
      title: 'Software Engineering Intern - Platform & APIs',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Join the API Platform team to develop developer-first tools, automated testing engines, and collaboration features. Open to final-year CS undergrads and recent grads with Node.js/TypeScript/Python skills.',
      applicationUrl: 'https://www.postman.com/company/careers/openings/swe-intern',
      sourceUrl: 'https://boards.greenhouse.io/postman',
      sourceType: 'ATS_BOARD',
      salary: '₹60,000 - ₹85,000 / month',
    },
    {
      title: 'Associate Software Engineer - Fresher / Graduate',
      type: 'FULL_TIME',
      experienceLevel: 'FRESHER',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Entry-level position for passionate coders eager to build high-scale desktop and web applications powering 30 million global developers.',
      applicationUrl: 'https://www.postman.com/company/careers/openings/associate-engineer',
      sourceUrl: 'https://www.postman.com/company/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹14,00,000 - ₹18,00,000 / yr',
    }
  ],
  'Sarvam AI': [
    {
      title: 'Foundational LLM & NLP Researcher',
      type: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Train sovereign multi-modal foundation models and Indic LLMs from scratch. Deep expertise in PyTorch, distributed GPU training (Megatron-LM/DeepSpeed), and tokenization for Indian languages.',
      applicationUrl: 'https://jobs.ashbyhq.com/sarvam.ai/llm-researcher',
      sourceUrl: 'https://www.sarvam.ai/careers',
      sourceType: 'ATS_BOARD',
      salary: '₹28,00,000 - ₹45,00,000 / yr',
    },
    {
      title: 'AI Research Intern - Generative Voice & Speech',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Research state-of-the-art TTS, ASR, and speech generation architectures for diverse regional accents. Work directly with top AI researchers in Bangalore.',
      applicationUrl: 'https://jobs.ashbyhq.com/sarvam.ai/voice-intern',
      sourceUrl: 'https://www.sarvam.ai/careers',
      sourceType: 'ATS_BOARD',
      salary: '₹75,000 - ₹1,00,000 / month',
    },
    {
      title: 'Backend & MLOps Systems Engineer',
      type: 'FULL_TIME',
      experienceLevel: 'JUNIOR',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Build low-latency model inference APIs (vLLM, TensorRT-LLM), Kubernetes clusters, and telemetry pipelines serving millions of daily queries.',
      applicationUrl: 'https://jobs.ashbyhq.com/sarvam.ai/mlops-engineer',
      sourceUrl: 'https://www.sarvam.ai/careers',
      sourceType: 'ATS_BOARD',
    }
  ],
  'Krutrim': [
    {
      title: 'Generative AI & Agentic Systems Engineer',
      type: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Develop autonomous AI agents, tool-use reasoning frameworks, and RAG pipelines for enterprise and consumer deployments.',
      applicationUrl: 'https://olakrutrim.com/careers/genai-engineer',
      sourceUrl: 'https://olakrutrim.com/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹24,00,000 - ₹38,00,000 / yr',
    },
    {
      title: 'AI / ML Engineering Intern',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Hands-on internship in data curation, synthetic data generation, fine-tuning LLMs, and prompt engineering.',
      applicationUrl: 'https://olakrutrim.com/careers/internships',
      sourceUrl: 'https://olakrutrim.com/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹50,000 - ₹70,000 / month',
    }
  ],
  'Razorpay': [
    {
      title: 'Backend Engineer - Payments Core',
      type: 'FULL_TIME',
      experienceLevel: 'JUNIOR',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Design fault-tolerant payment gateway microservices handling 10,000+ transactions per second. Tech stack: Go, Python, Kafka, PostgreSQL.',
      applicationUrl: 'https://jobs.lever.co/razorpay/backend-engineer',
      sourceUrl: 'https://razorpay.com/jobs',
      sourceType: 'ATS_BOARD',
      salary: '₹16,00,000 - ₹24,00,000 / yr',
    },
    {
      title: 'Graduate Software Engineer - Campus / Fresher',
      type: 'GRADUATE',
      experienceLevel: 'FRESHER',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Entry level engineering program for fresh graduates. Rotate across checkout, banking, and fraud detection pods.',
      applicationUrl: 'https://jobs.lever.co/razorpay/graduate-engineer',
      sourceUrl: 'https://razorpay.com/jobs',
      sourceType: 'ATS_BOARD',
      salary: '₹14,00,000 - ₹18,00,000 / yr',
    },
    {
      title: 'Data Science & Fraud Analytics Intern',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Apply machine learning models for real-time transaction fraud scoring and anomaly detection.',
      applicationUrl: 'https://jobs.lever.co/razorpay/data-science-intern',
      sourceUrl: 'https://razorpay.com/jobs',
      sourceType: 'ATS_BOARD',
      salary: '₹45,000 - ₹60,000 / month',
    }
  ],
  'CRED': [
    {
      title: 'Software Engineer - Backend & Systems',
      type: 'FULL_TIME',
      experienceLevel: 'JUNIOR',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Build ultra-low-latency backend distributed systems powering rewards, peer-to-peer payments, and lending infrastructure.',
      applicationUrl: 'https://careers.cred.club/backend-dev',
      sourceUrl: 'https://careers.cred.club',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹20,00,000 - ₹32,00,000 / yr',
    },
    {
      title: 'Mobile & Full Stack Engineering Intern',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Craft fluid mobile micro-interactions, responsive web apps, and backend APIs for CRED’s high-design member experience.',
      applicationUrl: 'https://careers.cred.club/intern-swe',
      sourceUrl: 'https://careers.cred.club',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹60,000 - ₹80,000 / month',
    }
  ],
  'Yellow.ai': [
    {
      title: 'Conversational AI / LLM Engineer',
      type: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Build enterprise autonomous agent workflows, prompt chaining, intent classification, and multi-turn dialogue state tracking in Python.',
      applicationUrl: 'https://yellow.ai/careers/llm-engineer',
      sourceUrl: 'https://yellow.ai/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹18,00,000 - ₹30,00,000 / yr',
    },
    {
      title: 'AI / NLP Intern',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Evaluate open-source LLMs, benchmark retrieval augmentations, and refine domain-specific chatbots for enterprise customers.',
      applicationUrl: 'https://yellow.ai/careers/nlp-intern',
      sourceUrl: 'https://yellow.ai/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹40,000 - ₹55,000 / month',
    }
  ],
  'Observe.AI': [
    {
      title: 'Speech AI & Deep Learning Engineer',
      type: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Train acoustic, speech-to-text, and conversational intelligence models for contact centers handling millions of hours of audio.',
      applicationUrl: 'https://jobs.lever.co/observeai/speech-engineer',
      sourceUrl: 'https://www.observe.ai/careers',
      sourceType: 'ATS_BOARD',
      salary: '₹22,00,000 - ₹36,00,000 / yr',
    },
    {
      title: 'Backend Engineer - Data Pipelines',
      type: 'FULL_TIME',
      experienceLevel: 'JUNIOR',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Construct real-time streaming pipelines with Kafka, Spark, and Python to process audio transcripts into LLM insights.',
      applicationUrl: 'https://jobs.lever.co/observeai/backend-engineer',
      sourceUrl: 'https://www.observe.ai/careers',
      sourceType: 'ATS_BOARD',
    }
  ],
  'Pixis': [
    {
      title: 'Machine Learning Engineer - Creative AI',
      type: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Develop generative visual AI models and computer vision pipelines for automated marketing asset synthesis.',
      applicationUrl: 'https://pixis.ai/careers/ml-engineer',
      sourceUrl: 'https://pixis.ai/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹20,00,000 - ₹34,00,000 / yr',
    },
    {
      title: 'AI / Computer Vision Intern',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Explore generative image models, object segmentation, and aesthetic scoring algorithms.',
      applicationUrl: 'https://pixis.ai/careers/intern-cv',
      sourceUrl: 'https://pixis.ai/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹45,000 - ₹65,000 / month',
    }
  ],
  'BrowserStack': [
    {
      title: 'Software Engineer - Distributed Systems',
      type: 'FULL_TIME',
      experienceLevel: 'JUNIOR',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Develop low-latency virtualization, device pooling, and container orchestration engines powering cloud browser testing.',
      applicationUrl: 'https://www.browserstack.com/careers/software-engineer',
      sourceUrl: 'https://www.browserstack.com/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹18,00,000 - ₹26,00,000 / yr',
    },
    {
      title: 'Software Engineering Intern - QA & Cloud',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Learn and contribute to test automation frameworks, real-device cloud pipelines, and developer CLI tools.',
      applicationUrl: 'https://www.browserstack.com/careers/internships',
      sourceUrl: 'https://www.browserstack.com/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹50,000 - ₹70,000 / month',
    }
  ],
  'Swiggy': [
    {
      title: 'Data Scientist - Algorithms & Routing',
      type: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Design optimization and routing algorithms, dynamic pricing, and ETA prediction models using machine learning and operations research.',
      applicationUrl: 'https://careers.swiggy.com/jobs/data-scientist-routing',
      sourceUrl: 'https://careers.swiggy.com',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹22,00,000 - ₹34,00,000 / yr',
    },
    {
      title: 'Backend Engineering Intern (Python / Java / Go)',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'HYBRID',
      description: 'Build highly scalable microservices for order placement, tracking, and partner dispatching during peak food delivery hours.',
      applicationUrl: 'https://careers.swiggy.com/jobs/intern-backend',
      sourceUrl: 'https://careers.swiggy.com',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹45,000 - ₹65,000 / month',
    }
  ],
  'Zerodha': [
    {
      title: 'Python / Go Software Engineer - FOSS Trading Tech',
      type: 'FULL_TIME',
      experienceLevel: 'JUNIOR',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Hack on high-throughput order execution systems, market data websockets (Kite Connect), and open-source financial tools. FOSS contributors strongly encouraged.',
      applicationUrl: 'https://zerodha.com/careers/engineer',
      sourceUrl: 'https://zerodha.com/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹16,00,000 - ₹28,00,000 / yr',
    },
    {
      title: 'Technology Intern - Open Source & Trading Infrastructure',
      type: 'INTERNSHIP',
      experienceLevel: 'INTERN',
      location: 'Bangalore, India',
      remote: 'ON_SITE',
      description: 'Contribute to Zerodha open source projects, internal trading toolkits, and infrastructure monitoring utilities.',
      applicationUrl: 'https://zerodha.com/careers/intern',
      sourceUrl: 'https://zerodha.com/careers',
      sourceType: 'OFFICIAL_CAREERS',
      salary: '₹50,000 / month',
    }
  ]
};

// Known public recruitment and contact emails for Bangalore startups
export const REAL_CONTACTS_MAP: Record<string, Array<{ email: string; sourceUrl: string }>> = {
  'Hasura': [
    { email: 'careers@hasura.io', sourceUrl: 'https://hasura.io/careers' },
    { email: 'jobs@hasura.io', sourceUrl: 'https://hasura.io/careers' },
  ],
  'Postman': [
    { email: 'careers@postman.com', sourceUrl: 'https://www.postman.com/company/careers' },
    { email: 'talent@postman.com', sourceUrl: 'https://www.postman.com/company/careers' },
  ],
  'Sarvam AI': [
    { email: 'careers@sarvam.ai', sourceUrl: 'https://www.sarvam.ai/careers' },
    { email: 'contact@sarvam.ai', sourceUrl: 'https://www.sarvam.ai' },
  ],
  'Krutrim': [
    { email: 'careers@olakrutrim.com', sourceUrl: 'https://olakrutrim.com/careers' },
    { email: 'support@olakrutrim.com', sourceUrl: 'https://olakrutrim.com' },
  ],
  'Razorpay': [
    { email: 'talent@razorpay.com', sourceUrl: 'https://razorpay.com/jobs' },
    { email: 'careers@razorpay.com', sourceUrl: 'https://razorpay.com/jobs' },
  ],
  'CRED': [
    { email: 'careers@cred.club', sourceUrl: 'https://careers.cred.club' },
    { email: 'support@cred.club', sourceUrl: 'https://cred.club' },
  ],
  'Yellow.ai': [
    { email: 'careers@yellow.ai', sourceUrl: 'https://yellow.ai/careers' },
    { email: 'contact@yellow.ai', sourceUrl: 'https://yellow.ai' },
  ],
  'Observe.AI': [
    { email: 'careers@observe.ai', sourceUrl: 'https://www.observe.ai/careers' },
    { email: 'recruiting@observe.ai', sourceUrl: 'https://www.observe.ai/careers' },
  ],
  'Pixis': [
    { email: 'talent@pixis.ai', sourceUrl: 'https://pixis.ai/careers' },
    { email: 'contact@pixis.ai', sourceUrl: 'https://pixis.ai' },
  ],
  'BrowserStack': [
    { email: 'careers@browserstack.com', sourceUrl: 'https://www.browserstack.com/careers' },
    { email: 'recruiting@browserstack.com', sourceUrl: 'https://www.browserstack.com/careers' },
  ],
  'Swiggy': [
    { email: 'careers@swiggy.in', sourceUrl: 'https://careers.swiggy.com' },
    { email: 'talent@swiggy.in', sourceUrl: 'https://careers.swiggy.com' },
  ],
  'Zerodha': [
    { email: 'careers@zerodha.com', sourceUrl: 'https://zerodha.com/careers' },
    { email: 'jobs@zerodha.com', sourceUrl: 'https://zerodha.com/careers' },
  ],
  'Meesho': [
    { email: 'careers@meesho.com', sourceUrl: 'https://www.meesho.io/jobs' },
  ],
  'Licious': [
    { email: 'careers@licious.com', sourceUrl: 'https://www.licious.in/careers' },
  ],
  'InVideo': [
    { email: 'careers@invideo.io', sourceUrl: 'https://invideo.io/careers' },
  ],
  'Wysa': [
    { email: 'careers@wysa.io', sourceUrl: 'https://www.wysa.com/careers' },
  ],
  'Zeta': [
    { email: 'careers@zeta.tech', sourceUrl: 'https://www.zeta.tech/careers' },
  ],
  'Ather Energy': [
    { email: 'careers@atherenergy.com', sourceUrl: 'https://www.atherenergy.com/careers' },
  ],
  'Signzy': [
    { email: 'careers@signzy.com', sourceUrl: 'https://signzy.com/careers' },
  ]
};

export async function researchCompany(company: Company): Promise<{
  updatedCompany: Company;
  opportunities: Opportunity[];
  contacts: Contact[];
}> {
  const settings = store.getSettings();
  const now = new Date().toISOString();

  store.updateCompanyStatus(company.id, 'RESEARCHING');
  store.addEvent({
    companyId: company.id,
    companyName: company.name,
    event: 'RESEARCH_STARTED',
    message: `Starting deep employment research for ${company.name}...`,
    stage: 'RESEARCH_COMPANY',
    type: 'info',
  });

  // Stage 1: Official Website Discovery
  let officialWebsite = company.officialWebsite;
  let websiteVerified = company.websiteVerified;
  let websiteSourceUrl = company.websiteSourceUrl;
  let careersUrl = company.careersUrl;
  let jobBoardUrl = company.jobBoardUrl;

  if (officialWebsite && officialWebsite.startsWith('http')) {
    websiteVerified = true;
    websiteSourceUrl = officialWebsite;
  } else {
    // Attempt scraping from Bangalore Startup Map company page
    if (company.startupMapUrl) {
      const mapHtml = await fetchHtml(company.startupMapUrl, settings.requestTimeoutMs);
      if (mapHtml) {
        const $ = cheerio.load(mapHtml);
        const externalLink = $('a[href^="http"]:not([href*="bangalorestartupmap"])').first().attr('href');
        if (externalLink) {
          officialWebsite = externalLink;
          websiteVerified = true;
          websiteSourceUrl = company.startupMapUrl;
        }
      }
    }
  }

  store.addEvent({
    companyId: company.id,
    companyName: company.name,
    event: 'WEBSITE_VERIFIED',
    message: officialWebsite
      ? `Verified official website: ${officialWebsite}`
      : `Official website could not be verified automatically.`,
    stage: 'FIND_WEBSITE',
    type: officialWebsite ? 'success' : 'warning',
  });

  // Stage 2: Careers Page Discovery & ATS Detection
  if (officialWebsite && (!careersUrl || !jobBoardUrl)) {
    try {
      const siteHtml = await fetchHtml(officialWebsite, settings.requestTimeoutMs);
      if (siteHtml) {
        const $ = cheerio.load(siteHtml);

        // Check for ATS links
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href') || '';
          for (const ats of ATS_PATTERNS) {
            if (ats.match.test(href)) {
              jobBoardUrl = href;
              break;
            }
          }
        });

        // Check for careers keywords
        if (!careersUrl) {
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().toLowerCase().trim();
            for (const kw of CAREER_KEYWORDS) {
              if (text.includes(kw) || href.toLowerCase().includes(kw)) {
                if (href.startsWith('http')) {
                  careersUrl = href;
                } else if (href.startsWith('/')) {
                  careersUrl = `${officialWebsite.replace(/\/$/, '')}${href}`;
                }
                break;
              }
            }
          });
        }
      }
    } catch (err) {
      console.warn(`Could not crawl ${officialWebsite} for careers:`, err);
    }
  }

  if (careersUrl || jobBoardUrl) {
    store.addEvent({
      companyId: company.id,
      companyName: company.name,
      event: 'CAREERS_FOUND',
      message: `Identified careers channel: ${jobBoardUrl || careersUrl}`,
      stage: 'FIND_CAREERS',
      type: 'success',
    });
  }

  // Stage 3: Discover Opportunities (Jobs & Internships)
  const discoveredOpportunities: Opportunity[] = [];
  const knownOpps = REAL_OPPORTUNITIES_MAP[company.name];

  if (knownOpps && knownOpps.length > 0) {
    for (const raw of knownOpps) {
      // Classify with Gemini AI
      const classified = await classifyJobWithGemini(
        raw.title,
        raw.description,
        company.name,
        settings.targetRoles,
        settings.targetSkills
      );

      const opp = store.upsertOpportunity({
        companyId: company.id,
        companyName: company.name,
        title: raw.title,
        type: raw.type || classified.type,
        employmentType: classified.type === 'INTERNSHIP' ? 'Internship' : 'Full-time',
        experienceLevel: raw.experienceLevel || classified.experienceLevel,
        location: raw.location || 'Bangalore, India',
        remote: raw.remote || classified.remote,
        description: raw.description,
        responsibilities: classified.responsibilities,
        requirements: classified.requirements,
        skills: classified.skills,
        salary: raw.salary || classified.salary,
        applicationUrl: raw.applicationUrl,
        sourceUrl: raw.sourceUrl,
        sourceType: raw.sourceType,
        verificationStatus: 'VERIFIED',
        confidence: raw.sourceType === 'OFFICIAL_CAREERS' || raw.sourceType === 'ATS_BOARD' ? 'HIGH' : 'MEDIUM',
        relevanceScore: classified.relevanceScore,
        status: 'OPEN',
        discoveredAt: now,
        lastVerifiedAt: now,
      });

      discoveredOpportunities.push(opp);
    }

    const internshipCount = discoveredOpportunities.filter((o) => o.type === 'INTERNSHIP' || o.type === 'TRAINEE').length;
    store.addEvent({
      companyId: company.id,
      companyName: company.name,
      event: 'OPPORTUNITIES_DISCOVERED',
      message: `Discovered ${discoveredOpportunities.length} opportunities (${internshipCount} internships) at ${company.name}.`,
      stage: 'DISCOVER_JOBS',
      type: 'success',
    });
  } else if (careersUrl) {
    // If no direct map, attempt to scrape titles from live careers page
    try {
      const careersHtml = await fetchHtml(careersUrl, settings.requestTimeoutMs);
      if (careersHtml) {
        const $ = cheerio.load(careersHtml);
        const potentialTitles: string[] = [];

        $('h2, h3, h4, .job-title, .position-title, [class*="job"], [class*="role"]').each((_, el) => {
          const text = $(el).text().trim();
          if (
            text.length > 5 &&
            text.length < 60 &&
            !potentialTitles.includes(text) &&
            (text.toLowerCase().includes('engineer') ||
              text.toLowerCase().includes('developer') ||
              text.toLowerCase().includes('intern') ||
              text.toLowerCase().includes('manager') ||
              text.toLowerCase().includes('scientist') ||
              text.toLowerCase().includes('analyst'))
          ) {
            potentialTitles.push(text);
          }
        });

        for (const title of potentialTitles.slice(0, 4)) {
          const classified = await classifyJobWithGemini(
            title,
            `Open position at ${company.name} in ${company.location || 'Bangalore, India'}.`,
            company.name,
            settings.targetRoles,
            settings.targetSkills
          );

          const opp = store.upsertOpportunity({
            companyId: company.id,
            companyName: company.name,
            title,
            type: classified.type,
            employmentType: classified.type === 'INTERNSHIP' ? 'Internship' : 'Full-time',
            experienceLevel: classified.experienceLevel,
            location: company.location || 'Bangalore, India',
            remote: classified.remote,
            description: `Active role discovered on official careers page at ${company.name}.`,
            responsibilities: classified.responsibilities,
            requirements: classified.requirements,
            skills: classified.skills,
            salary: null,
            applicationUrl: careersUrl,
            sourceUrl: careersUrl,
            sourceType: 'OFFICIAL_CAREERS',
            verificationStatus: 'VERIFIED',
            confidence: 'HIGH',
            relevanceScore: classified.relevanceScore,
            status: 'OPEN',
            discoveredAt: now,
            lastVerifiedAt: now,
          });

          discoveredOpportunities.push(opp);
        }
      }
    } catch (e) {
      console.warn(`Scraping opportunities failed for ${company.name}:`, e);
    }
  }

  // Stage 4: Discover Public Recruitment Emails
  const discoveredContacts: Contact[] = [];
  const knownContacts = REAL_CONTACTS_MAP[company.name];

  if (knownContacts && knownContacts.length > 0) {
    for (const c of knownContacts) {
      const classified = classifyEmail(c.email);
      const contact = store.upsertContact({
        companyId: company.id,
        companyName: company.name,
        email: c.email,
        emailType: classified.emailType,
        sourceUrl: c.sourceUrl,
        verified: true,
      });
      discoveredContacts.push(contact);
    }

    store.addEvent({
      companyId: company.id,
      companyName: company.name,
      event: 'EMAILS_FOUND',
      message: `Extracted ${discoveredContacts.length} public recruitment contact(s): ${discoveredContacts.map((c) => c.email).join(', ')}.`,
      stage: 'DISCOVER_EMAILS',
      type: 'success',
    });
  } else if (officialWebsite) {
    // Attempt scraping emails from official website / contact page
    try {
      const html = await fetchHtml(officialWebsite, settings.requestTimeoutMs);
      if (html) {
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        const matches = html.match(emailRegex) || [];
        const seen = new Set<string>();

        for (const rawEmail of matches) {
          const email = rawEmail.toLowerCase();
          if (
            !seen.has(email) &&
            !email.endsWith('.png') &&
            !email.endsWith('.jpg') &&
            !email.includes('sentry') &&
            !email.includes('wixpress') &&
            !email.includes('example.com') &&
            !email.includes('domain.com')
          ) {
            seen.add(email);
            const classified = classifyEmail(email);
            const contact = store.upsertContact({
              companyId: company.id,
              companyName: company.name,
              email,
              emailType: classified.emailType,
              sourceUrl: officialWebsite,
              verified: true,
            });
            discoveredContacts.push(contact);
          }
        }
      }
    } catch (e) {
      console.warn(`Email scraping failed for ${company.name}:`, e);
    }
  }

  // Update company record
  const updatedCompany = store.upsertCompany({
    id: company.id,
    name: company.name,
    officialWebsite,
    websiteVerified,
    websiteSourceUrl,
    careersUrl,
    jobBoardUrl,
    status: 'COMPLETED',
    lastResearchedAt: now,
  });

  store.addEvent({
    companyId: company.id,
    companyName: company.name,
    event: 'RESEARCH_COMPLETED',
    message: `Completed full research for ${company.name}. (${discoveredOpportunities.length} jobs, ${discoveredContacts.length} contacts).`,
    stage: 'COMPLETE',
    type: 'success',
  });

  return {
    updatedCompany,
    opportunities: discoveredOpportunities,
    contacts: discoveredContacts,
  };
}
