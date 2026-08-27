import * as XLSX from 'xlsx';
import { store } from '../database/store.ts';
import { OpportunityFilter } from '../types.ts';
import { opportunityService } from './opportunity.service.ts';

export class ExportService {
  /**
   * Generates a CSV string containing filtered opportunities
   */
  public generateOpportunitiesCsv(filter: OpportunityFilter = {}): string {
    const opps = opportunityService.listOpportunities(filter);
    const contacts = store.getContacts();

    // Map company to contacts
    const contactsByCompany = new Map<string, string[]>();
    for (const c of contacts) {
      const arr = contactsByCompany.get(c.companyId) || [];
      arr.push(c.email);
      contactsByCompany.set(c.companyId, arr);
    }

    const headers = [
      'Company Name',
      'Job Title',
      'Opportunity Type',
      'Experience Level',
      'Location',
      'Remote Policy',
      'Relevance Score',
      'Skills',
      'Salary / Stipend',
      'Application URL',
      'Source Type',
      'Verification Status',
      'Recruitment Emails',
      'Discovered At',
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = opps.map((o) => {
      const companyEmails = contactsByCompany.get(o.companyId) || [];
      return [
        escapeCsv(o.companyName),
        escapeCsv(o.title),
        escapeCsv(o.type),
        escapeCsv(o.experienceLevel),
        escapeCsv(o.location),
        escapeCsv(o.remote),
        escapeCsv(o.relevanceScore),
        escapeCsv(o.skills.join(', ')),
        escapeCsv(o.salary || 'N/A'),
        escapeCsv(o.applicationUrl || o.sourceUrl),
        escapeCsv(o.sourceType),
        escapeCsv(o.verificationStatus),
        escapeCsv(companyEmails.join('; ')),
        escapeCsv(o.discoveredAt),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generates an Excel (XLSX) binary buffer with multiple sheets (Opportunities, Companies, Contacts)
   */
  public generateWorkbookBuffer(filter: OpportunityFilter = {}): Buffer {
    const opps = opportunityService.listOpportunities(filter);
    const companies = store.getCompanies();
    const contacts = store.getContacts();

    // Sheet 1: Opportunities
    const oppsData = opps.map((o) => ({
      'Company': o.companyName,
      'Title': o.title,
      'Type': o.type,
      'Experience': o.experienceLevel,
      'Location': o.location,
      'Remote': o.remote,
      'Score': o.relevanceScore,
      'Skills': o.skills.join(', '),
      'Salary': o.salary || 'N/A',
      'Application URL': o.applicationUrl || o.sourceUrl,
      'Source': o.sourceType,
      'Status': o.status,
      'Verified': o.verificationStatus,
      'Discovered': o.discoveredAt,
    }));

    // Sheet 2: Companies
    const companiesData = companies.map((c) => ({
      'Company Name': c.name,
      'Sector': c.sector || 'Tech',
      'Website': c.officialWebsite || 'N/A',
      'Careers Page': c.careersUrl || c.jobBoardUrl || 'N/A',
      'Stage': c.startupStage || 'N/A',
      'Team Size': c.teamSize || 'N/A',
      'Status': c.status,
      'Last Researched': c.lastResearchedAt || 'Never',
    }));

    // Sheet 3: Contacts
    const contactsData = contacts.map((ct) => ({
      'Company': ct.companyName,
      'Name': ct.name || 'Public Inbox',
      'Role': ct.role || 'N/A',
      'Email': ct.email,
      'Type': ct.emailType,
      'Verification Status': ct.verificationStatus,
      'Exact Match': ct.exactMatch ? 'YES' : 'NO',
      'Confidence': `${ct.confidence || 0}%`,
      'Evidence Snippet': ct.sourceText || ct.evidenceFound || 'N/A',
      'Source Type': ct.sourceType || 'N/A',
      'Source URL': ct.sourceUrl,
      'Last Verified': ct.lastVerifiedAt || ct.discoveredAt,
    }));

    const workbook = XLSX.utils.book_new();

    const wsOpps = XLSX.utils.json_to_sheet(oppsData);
    XLSX.utils.book_append_sheet(workbook, wsOpps, 'Opportunities');

    const wsCompanies = XLSX.utils.json_to_sheet(companiesData);
    XLSX.utils.book_append_sheet(workbook, wsCompanies, 'Companies');

    const wsContacts = XLSX.utils.json_to_sheet(contactsData);
    XLSX.utils.book_append_sheet(workbook, wsContacts, 'Contacts');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

export const exportService = new ExportService();
