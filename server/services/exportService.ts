import * as XLSX from 'xlsx';
import { store } from '../database/store.ts';
import { Company, Opportunity, Contact } from '../types.ts';

export type ExportType =
  | 'ALL_COMPANIES'
  | 'ALL_OPPORTUNITIES'
  | 'INTERNSHIPS'
  | 'AI_ML_ROLES'
  | 'FRESHER_ROLES'
  | 'WITH_EMAILS'
  | 'VERIFIED_ONLY'
  | 'FAILED_COMPANIES';

export interface ExportRow {
  Company: string;
  'Company Website': string;
  'Startup Map URL': string;
  'Job Title': string;
  'Opportunity Type': string;
  'Experience Level': string;
  Location: string;
  Remote: string;
  Skills: string;
  'Relevance Score': number | string;
  Verification: string;
  Confidence: string;
  'Application URL': string;
  'Source URL': string;
  'Public Email': string;
  'Email Type': string;
  'Discovered Date': string;
  'Last Verified': string;
}

export function generateExportData(exportType: ExportType): ExportRow[] {
  const companies = store.getCompanies();
  const opportunities = store.getOpportunities();
  const contacts = store.getContacts();

  // Create lookup maps
  const companyMap = new Map<string, Company>();
  companies.forEach((c) => companyMap.set(c.id, c));

  const contactMap = new Map<string, Contact[]>();
  contacts.forEach((c) => {
    const list = contactMap.get(c.companyId) || [];
    list.push(c);
    contactMap.set(c.companyId, list);
  });

  const rows: ExportRow[] = [];

  if (exportType === 'ALL_COMPANIES' || exportType === 'FAILED_COMPANIES') {
    const targetCompanies =
      exportType === 'FAILED_COMPANIES'
        ? companies.filter((c) => c.status === 'FAILED')
        : companies;

    for (const c of targetCompanies) {
      const compContacts = contactMap.get(c.id) || [];
      const primaryEmail = compContacts[0]?.email || 'No public recruitment email found';
      const emailType = compContacts[0]?.emailType || 'UNKNOWN';

      rows.push({
        Company: c.name,
        'Company Website': c.officialWebsite || 'Not verified',
        'Startup Map URL': c.startupMapUrl,
        'Job Title': 'N/A (Company Record)',
        'Opportunity Type': c.sector || 'Technology',
        'Experience Level': c.startupStage || 'N/A',
        Location: c.location || 'Bangalore, India',
        Remote: 'N/A',
        Skills: c.tags.join(', '),
        'Relevance Score': 'N/A',
        Verification: c.websiteVerified ? 'VERIFIED' : 'UNVERIFIED',
        Confidence: c.websiteVerified ? 'HIGH' : 'MEDIUM',
        'Application URL': c.careersUrl || '',
        'Source URL': c.startupMapUrl,
        'Public Email': primaryEmail,
        'Email Type': emailType,
        'Discovered Date': c.createdAt,
        'Last Verified': c.lastResearchedAt || 'Pending',
      });
    }
    return rows;
  }

  // Filter opportunities based on type
  let filteredOpps = opportunities;
  if (exportType === 'INTERNSHIPS') {
    filteredOpps = opportunities.filter((o) => o.type === 'INTERNSHIP' || o.type === 'TRAINEE' || o.type === 'APPRENTICESHIP');
  } else if (exportType === 'AI_ML_ROLES') {
    filteredOpps = opportunities.filter((o) => o.relevanceScore >= 60);
  } else if (exportType === 'FRESHER_ROLES') {
    filteredOpps = opportunities.filter(
      (o) =>
        o.experienceLevel === 'FRESHER' ||
        o.experienceLevel === 'ENTRY_LEVEL' ||
        o.experienceLevel === 'INTERN' ||
        o.experienceLevel === 'JUNIOR'
    );
  } else if (exportType === 'WITH_EMAILS') {
    filteredOpps = opportunities.filter((o) => {
      const compContacts = contactMap.get(o.companyId) || [];
      return compContacts.length > 0;
    });
  } else if (exportType === 'VERIFIED_ONLY') {
    filteredOpps = opportunities.filter((o) => o.verificationStatus === 'VERIFIED');
  }

  for (const opp of filteredOpps) {
    const comp = companyMap.get(opp.companyId);
    const compContacts = contactMap.get(opp.companyId) || [];
    const primaryEmail = compContacts[0]?.email || 'No public recruitment email found';
    const emailType = compContacts[0]?.emailType || 'UNKNOWN';

    rows.push({
      Company: opp.companyName,
      'Company Website': comp?.officialWebsite || 'Not verified',
      'Startup Map URL': comp?.startupMapUrl || 'https://www.bangalorestartupmap.com',
      'Job Title': opp.title,
      'Opportunity Type': opp.type,
      'Experience Level': opp.experienceLevel,
      Location: opp.location,
      Remote: opp.remote,
      Skills: opp.skills.join(', '),
      'Relevance Score': opp.relevanceScore,
      Verification: opp.verificationStatus,
      Confidence: opp.confidence,
      'Application URL': opp.applicationUrl || '',
      'Source URL': opp.sourceUrl,
      'Public Email': primaryEmail,
      'Email Type': emailType,
      'Discovered Date': opp.discoveredAt,
      'Last Verified': opp.lastVerifiedAt,
    });
  }

  return rows;
}

export function exportToCsv(exportType: ExportType): string {
  const data = generateExportData(exportType);
  if (data.length === 0) {
    return 'Company,Company Website,Startup Map URL,Job Title,Opportunity Type,Experience Level,Location,Remote,Skills,Relevance Score,Verification,Confidence,Application URL,Source URL,Public Email,Email Type,Discovered Date,Last Verified\n';
  }

  const headers = Object.keys(data[0]);
  const csvLines = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const val = (row as any)[header] ?? '';
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

export function exportToXlsxBuffer(exportType: ExportType): Buffer {
  const data = generateExportData(exportType);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, exportType.substring(0, 30));
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
