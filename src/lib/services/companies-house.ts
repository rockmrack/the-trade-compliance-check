import { Redis } from '@upstash/redis';
import type { CompaniesHouseData, CompanyOfficer, FilingHistoryItem } from '@/types';

// ============ CONFIGURATION ============

const COMPANIES_HOUSE_API_URL = 'https://api.company-information.service.gov.uk';
const CACHE_TTL_SECONDS = 86400; // 24 hours

// Initialize Redis for caching
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

// ============ TYPES ============

interface CompaniesHouseAPICompany {
  company_number: string;
  company_name: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  date_of_cessation?: string;
  registered_office_address: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  sic_codes?: string[];
  has_charges: boolean;
  has_insolvency_history: boolean;
  can_file: boolean;
  accounts?: {
    last_accounts?: {
      made_up_to: string;
    };
    next_due?: string;
  };
  confirmation_statement?: {
    last_made_up_to: string;
  };
}

interface CompaniesHouseAPISearchResult {
  items: Array<{
    company_number: string;
    company_name: string;
    company_status: string;
    company_type: string;
    address_snippet: string;
    date_of_creation: string;
    matches?: {
      title?: number[];
    };
  }>;
  total_results: number;
}

interface CompaniesHouseAPIOfficers {
  items: Array<{
    name: string;
    officer_role: string;
    appointed_on: string;
    resigned_on?: string;
    nationality?: string;
    occupation?: string;
    address?: {
      premises?: string;
      address_line_1?: string;
      locality?: string;
      region?: string;
      postal_code?: string;
      country?: string;
    };
  }>;
}

interface CompaniesHouseAPIFilingHistory {
  items: Array<{
    category: string;
    date: string;
    description: string;
    type: string;
  }>;
}

// ============ API CLIENT ============

class CompaniesHouseClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.COMPANIES_HOUSE_API_KEY!;
    if (!this.apiKey) {
      console.warn('Companies House API key not configured');
    }
  }

  private getAuthHeader(): string {
    // Companies House uses Basic auth with API key as username and empty password
    return `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${COMPANIES_HOUSE_API_URL}${endpoint}`, {
      headers: {
        Authorization: this.getAuthHeader(),
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new CompaniesHouseError('Company not found', 'NOT_FOUND', 404);
      }
      if (response.status === 429) {
        throw new CompaniesHouseError(
          'Rate limit exceeded',
          'RATE_LIMITED',
          429
        );
      }
      throw new CompaniesHouseError(
        `API error: ${response.status}`,
        'API_ERROR',
        response.status
      );
    }

    return response.json();
  }

  async getCompany(companyNumber: string): Promise<CompaniesHouseAPICompany> {
    // Normalize company number (pad with leading zeros if needed)
    const normalizedNumber = companyNumber.padStart(8, '0');
    return this.fetch<CompaniesHouseAPICompany>(
      `/company/${normalizedNumber}`
    );
  }

  async searchCompanies(
    query: string,
    limit: number = 10
  ): Promise<CompaniesHouseAPISearchResult> {
    const encodedQuery = encodeURIComponent(query);
    return this.fetch<CompaniesHouseAPISearchResult>(
      `/search/companies?q=${encodedQuery}&items_per_page=${limit}`
    );
  }

  async getOfficers(companyNumber: string): Promise<CompaniesHouseAPIOfficers> {
    const normalizedNumber = companyNumber.padStart(8, '0');
    return this.fetch<CompaniesHouseAPIOfficers>(
      `/company/${normalizedNumber}/officers`
    );
  }

  async getFilingHistory(
    companyNumber: string,
    limit: number = 10
  ): Promise<CompaniesHouseAPIFilingHistory> {
    const normalizedNumber = companyNumber.padStart(8, '0');
    return this.fetch<CompaniesHouseAPIFilingHistory>(
      `/company/${normalizedNumber}/filing-history?items_per_page=${limit}`
    );
  }
}

// ============ ERROR CLASS ============

export class CompaniesHouseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'CompaniesHouseError';
  }
}

// ============ CACHED SERVICE ============

const client = new CompaniesHouseClient();

export async function getCompanyData(
  companyNumber: string,
  forceRefresh: boolean = false
): Promise<CompaniesHouseData> {
  const cacheKey = `ch:company:${companyNumber}`;

  // Check cache first
  if (!forceRefresh) {
    try {
      const cached = await redis.get<CompaniesHouseData>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }
  }

  // Fetch from API
  const [companyData, officersData, filingData] = await Promise.all([
    client.getCompany(companyNumber),
    client.getOfficers(companyNumber).catch(() => ({ items: [] })),
    client.getFilingHistory(companyNumber).catch(() => ({ items: [] }))
  ]);

  // Transform to our format
  const result: CompaniesHouseData = {
    companyNumber: companyData.company_number,
    companyName: companyData.company_name,
    companyStatus: companyData.company_status,
    companyType: formatCompanyType(companyData.company_type),
    dateOfCreation: companyData.date_of_creation,
    dateOfCessation: companyData.date_of_cessation,
    registeredOfficeAddress: {
      line1: companyData.registered_office_address.address_line_1 || '',
      line2: companyData.registered_office_address.address_line_2,
      city: companyData.registered_office_address.locality || '',
      county: companyData.registered_office_address.region,
      postcode: companyData.registered_office_address.postal_code || '',
      country: companyData.registered_office_address.country || 'United Kingdom'
    },
    sicCodes: companyData.sic_codes || [],
    hasCharges: companyData.has_charges,
    hasInsolvencyHistory: companyData.has_insolvency_history,
    canFile: companyData.can_file,
    lastAccountsDate: companyData.accounts?.last_accounts?.made_up_to,
    nextAccountsDue: companyData.accounts?.next_due,
    lastConfirmationStatementDate:
      companyData.confirmation_statement?.last_made_up_to,
    officers: officersData.items.map(
      (officer): CompanyOfficer => ({
        name: officer.name,
        role: formatOfficerRole(officer.officer_role),
        appointedOn: officer.appointed_on,
        resignedOn: officer.resigned_on,
        nationality: officer.nationality,
        occupation: officer.occupation,
        address: {
          line1: officer.address?.address_line_1,
          city: officer.address?.locality,
          county: officer.address?.region,
          postcode: officer.address?.postal_code,
          country: officer.address?.country
        }
      })
    ),
    filingHistory: filingData.items.map(
      (filing): FilingHistoryItem => ({
        category: filing.category,
        date: filing.date,
        description: filing.description,
        type: filing.type
      })
    ),
    fetchedAt: new Date().toISOString()
  };

  // Cache the result
  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, result);
  } catch (error) {
    console.error('Redis cache set error:', error);
  }

  return result;
}

export async function searchCompanies(
  query: string,
  limit: number = 10
): Promise<
  Array<{
    companyNumber: string;
    companyName: string;
    companyStatus: string;
    address: string;
    dateOfCreation: string;
  }>
> {
  const cacheKey = `ch:search:${query.toLowerCase()}:${limit}`;

  // Check cache
  try {
    const cached = await redis.get<
      Array<{
        companyNumber: string;
        companyName: string;
        companyStatus: string;
        address: string;
        dateOfCreation: string;
      }>
    >(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.error('Redis cache error:', error);
  }

  const result = await client.searchCompanies(query, limit);

  const companies = result.items.map((item) => ({
    companyNumber: item.company_number,
    companyName: item.company_name,
    companyStatus: item.company_status,
    address: item.address_snippet,
    dateOfCreation: item.date_of_creation
  }));

  // Cache for shorter duration (1 hour) since search results can change
  try {
    await redis.setex(cacheKey, 3600, companies);
  } catch (error) {
    console.error('Redis cache set error:', error);
  }

  return companies;
}

export async function verifyCompanyStatus(
  companyNumber: string
): Promise<{
  isActive: boolean;
  status: string;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}> {
  const data = await getCompanyData(companyNumber);
  const warnings: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Check company status
  const activeStatuses = ['active', 'registered'];
  const isActive = activeStatuses.includes(data.companyStatus.toLowerCase());

  if (!isActive) {
    warnings.push(
      `Company status is "${formatCompanyStatus(data.companyStatus)}"`
    );
    riskLevel = 'high';
  }

  // Check for insolvency history
  if (data.hasInsolvencyHistory) {
    warnings.push('Company has insolvency history');
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }

  // Check for charges
  if (data.hasCharges) {
    warnings.push('Company has outstanding charges registered');
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }

  // Check for overdue accounts
  if (data.nextAccountsDue) {
    const accountsDue = new Date(data.nextAccountsDue);
    if (accountsDue < new Date()) {
      warnings.push('Company accounts are overdue');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }
  }

  // Check company age (new companies may be higher risk)
  const creationDate = new Date(data.dateOfCreation);
  const ageInYears =
    (Date.now() - creationDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
  if (ageInYears < 1) {
    warnings.push('Company incorporated less than 1 year ago');
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }

  return {
    isActive,
    status: formatCompanyStatus(data.companyStatus),
    riskLevel,
    warnings
  };
}

// ============ HELPER FUNCTIONS ============

function formatCompanyType(type: string): string {
  const mapping: Record<string, string> = {
    ltd: 'Private Limited Company',
    'private-limited-guarant-nsc': 'Private Limited by Guarantee',
    'private-limited-guarant-nsc-limited-exemption':
      'Private Limited by Guarantee',
    'private-unlimited': 'Private Unlimited Company',
    'private-unlimited-nsc': 'Private Unlimited Company',
    plc: 'Public Limited Company',
    'old-public-company': 'Old Public Company',
    'private-limited-shares-section-30-exemption': 'Private Limited Company',
    llp: 'Limited Liability Partnership',
    'registered-overseas-entity': 'Overseas Entity',
    'royal-charter': 'Royal Charter Company',
    'investment-company-with-variable-capital': 'Investment Company',
    'unregistered-company': 'Unregistered Company',
    'scottish-partnership': 'Scottish Partnership'
  };
  return mapping[type] || type;
}

function formatCompanyStatus(status: string): string {
  const mapping: Record<string, string> = {
    active: 'Active',
    dissolved: 'Dissolved',
    liquidation: 'Liquidation',
    receivership: 'Receivership',
    administration: 'Administration',
    'voluntary-arrangement': 'Voluntary Arrangement',
    'converted-closed': 'Converted/Closed',
    'insolvency-proceedings': 'Insolvency Proceedings',
    registered: 'Registered',
    removed: 'Removed'
  };
  return mapping[status] || status;
}

function formatOfficerRole(role: string): string {
  const mapping: Record<string, string> = {
    director: 'Director',
    secretary: 'Secretary',
    'corporate-director': 'Corporate Director',
    'corporate-secretary': 'Corporate Secretary',
    'corporate-nominee-director': 'Corporate Nominee Director',
    'corporate-nominee-secretary': 'Corporate Nominee Secretary',
    'judicial-factor': 'Judicial Factor',
    'llp-designated-member': 'LLP Designated Member',
    'llp-member': 'LLP Member',
    member: 'Member',
    'nominee-director': 'Nominee Director',
    'nominee-secretary': 'Nominee Secretary',
    receiver: 'Receiver',
    'corporate-manager': 'Corporate Manager',
    manager: 'Manager'
  };
  return mapping[role] || role;
}
