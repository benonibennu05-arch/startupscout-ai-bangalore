import { NormalizedLocation } from './careerLocationParser.ts';
import { ClassificationResult } from './careerClassifier.ts';

export interface ExtractedJob {
  sourceJobId: string;
  title: string;
  description: string;
  department?: string;
  location: NormalizedLocation;
  applicationUrl: string;
  sourceJobUrl: string;
  classification: ClassificationResult;
  contentHash: string;
  sourcePublishedAt?: string | null;
  contactEmail?: string;
}

export interface CareerPlatformAdapter {
  name: string;
  matches(url: string, html?: string): boolean;
  extractJobs(
    companyName: string,
    careerUrl: string,
    html?: string
  ): Promise<{ jobs: ExtractedJob[]; error?: string; statusText?: string }>;
}
