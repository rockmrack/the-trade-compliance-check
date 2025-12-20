import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { publicVerifySchema } from '@/lib/validations';
import { getCompanyData, searchCompanies } from '@/lib/services/companies-house';
import type { PublicVerificationResult, PublicContractorProfile, PublicDocumentSummary, VerificationBadge, PublicCompaniesHouseData } from '@/types';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Rate limiting for public endpoint
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'), // 100 requests per hour
  analytics: true,
  prefix: 'ratelimit:public:verify'
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.'
          }
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString()
          }
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = publicVerifySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: validationResult.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const { query, type } = validationResult.data;
    const supabase = await createServiceClient();

    // Search for contractor
    let contractorQuery = supabase
      .from('contractors')
      .select(`
        id,
        company_name,
        trading_name,
        company_number,
        trade_types,
        verification_status,
        public_profile_slug,
        onboarded_at,
        last_verified_at,
        companies_house_data
      `)
      .eq('is_active', true);

    if (type === 'company_number') {
      contractorQuery = contractorQuery.eq('company_number', query.toUpperCase());
    } else if (type === 'slug') {
      contractorQuery = contractorQuery.eq('public_profile_slug', query.toLowerCase());
    } else {
      // Fuzzy search by company name
      contractorQuery = contractorQuery.ilike('company_name', `%${query}%`);
    }

    const { data: contractors, error: dbError } = await contractorQuery.limit(1);

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to search contractors'
          }
        },
        { status: 500 }
      );
    }

    // If no contractor found
    if (!contractors || contractors.length === 0) {
      // Try to find via Companies House if it looks like a company number
      let companiesHouseResult: PublicCompaniesHouseData | undefined;

      if (/^\d{8}$|^[A-Z]{2}\d{6}$/i.test(query)) {
        try {
          const chData = await getCompanyData(query);
          companiesHouseResult = {
            companyName: chData.companyName,
            companyNumber: chData.companyNumber,
            status: chData.companyStatus,
            incorporatedDate: chData.dateOfCreation,
            registeredAddress: formatAddress(chData.registeredOfficeAddress as any),
            isActive: chData.companyStatus.toLowerCase() === 'active'
          };
        } catch {
          // Company not found on Companies House either
        }
      }

      const result: PublicVerificationResult = {
        found: false,
        verificationStatus: 'unverified',
        overallScore: 0,
        badges: [],
        ...(companiesHouseResult ? { companiesHouse: companiesHouseResult } : {}),
        disclaimer: 'This company is not registered in our verification system. This does not necessarily mean they are not legitimate - please conduct your own due diligence.'
      };

      return NextResponse.json({ success: true, data: result });
    }

    const contractor = contractors[0]!;

    // Get compliance documents
    const { data: documents } = await supabase
      .from('compliance_documents')
      .select('document_type, status, coverage_amount, expiry_date, provider_name')
      .eq('contractor_id', (contractor as any).id)
      .is('replaced_by_id', null)
      .order('expiry_date', { ascending: true });

    // Format documents for public view
    const publicDocuments: PublicDocumentSummary[] = (documents || []).map((doc) => ({
      type: (doc as any).document_type,
      status: (doc as any).status,
      coverageAmount: (doc as any).coverage_amount || undefined,
      expiryDate: (doc as any).expiry_date,
      providerName: (doc as any).provider_name
    }));

    // Get Companies House data (from cache or fresh)
    let companiesHouseData: PublicCompaniesHouseData | undefined;

    if ((contractor as any).company_number) {
      try {
        const chData = (contractor as any).companies_house_data as Record<string, unknown> ||
          await getCompanyData((contractor as any).company_number);

        companiesHouseData = {
          companyName: String(chData.companyName || (contractor as any).company_name),
          companyNumber: (contractor as any).company_number,
          status: String(chData.companyStatus || 'unknown'),
          incorporatedDate: String(chData.dateOfCreation || ''),
          registeredAddress: chData.registeredOfficeAddress
            ? formatAddress(chData.registeredOfficeAddress as Record<string, string>)
            : '',
          isActive: String(chData.companyStatus || '').toLowerCase() === 'active'
        };
      } catch (error) {
        console.error('Failed to fetch Companies House data:', error);
      }
    }

    // Calculate verification score
    const overallScore = calculateVerificationScore(contractor, publicDocuments);

    // Generate badges
    const badges = generateBadges(contractor, publicDocuments, companiesHouseData);

    // Build contractor profile
    const contractorProfile: PublicContractorProfile = {
      companyName: (contractor as any).company_name,
      tradingName: (contractor as any).trading_name || undefined,
      tradeTypes: (contractor as any).trade_types,
      verificationStatus: (contractor as any).verification_status,
      documents: publicDocuments,
      certifications: extractCertifications(publicDocuments),
      memberSince: (contractor as any).onboarded_at || (contractor as any).last_verified_at || ''
    };

    const result: PublicVerificationResult = {
      found: true,
      contractor: contractorProfile,
      ...(companiesHouseData ? { companiesHouse: companiesHouseData } : {}),
      verificationStatus: (contractor as any).verification_status,
      overallScore,
      badges,
      lastVerifiedAt: (contractor as any).last_verified_at || undefined,
      disclaimer: 'This verification is based on documents and data submitted to our system. Always conduct your own due diligence before engaging any contractor.'
    };

    return NextResponse.json(
      { success: true, data: result },
      {
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString()
        }
      }
    );
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      },
      { status: 500 }
    );
  }
}

// Helper functions
function formatAddress(address: Record<string, string | undefined>): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.county,
    address.postcode
  ].filter(Boolean);
  return parts.join(', ');
}

function calculateVerificationScore(
  contractor: {
    verification_status: string;
    company_number: string | null;
  },
  documents: PublicDocumentSummary[]
): number {
  let score = 0;

  // Verification status (40 points max)
  if (contractor.verification_status === 'verified') score += 40;
  else if (contractor.verification_status === 'partially_verified') score += 20;

  // Company registration (10 points)
  if (contractor.company_number) score += 10;

  // Valid documents (50 points max)
  const validDocs = documents.filter((d) => d.status === 'valid');
  const requiredDocTypes = ['public_liability', 'employers_liability'];

  for (const docType of requiredDocTypes) {
    if (validDocs.some((d) => d.type === docType)) {
      score += 20;
    }
  }

  // Bonus for additional valid certifications
  const additionalValid = validDocs.filter(
    (d) => !requiredDocTypes.includes(d.type)
  );
  score += Math.min(additionalValid.length * 5, 10);

  return Math.min(score, 100);
}

function generateBadges(
  contractor: {
    verification_status: string;
    onboarded_at: string | null;
  },
  documents: PublicDocumentSummary[],
  companiesHouse?: PublicCompaniesHouseData
): VerificationBadge[] {
  const badges: VerificationBadge[] = [];
  const now = new Date().toISOString();

  // Verified Partner badge
  if (contractor.verification_status === 'verified') {
    badges.push({
      type: 'verified_partner',
      label: 'Verified Partner',
      description: 'This contractor has completed our full verification process',
      earnedAt: now
    });
  }

  // Insurance Verified badge
  const hasValidInsurance = documents.some(
    (d) =>
      (d.type === 'public_liability' || d.type === 'employers_liability') &&
      d.status === 'valid'
  );
  if (hasValidInsurance) {
    badges.push({
      type: 'insurance_verified',
      label: 'Insurance Verified',
      description: 'Has valid public liability or employers liability insurance',
      earnedAt: now
    });
  }

  // Companies House Verified badge
  if (companiesHouse?.isActive) {
    badges.push({
      type: 'companies_house_verified',
      label: 'Companies House Active',
      description: 'Registered and active on Companies House',
      earnedAt: now
    });
  }

  // Gas Safe Registered badge
  const hasGasSafe = documents.some(
    (d) => d.type === 'gas_safe' && d.status === 'valid'
  );
  if (hasGasSafe) {
    badges.push({
      type: 'gas_safe_registered',
      label: 'Gas Safe Registered',
      description: 'Registered with the Gas Safe Register',
      earnedAt: now
    });
  }

  // NICEIC Approved badge
  const hasNiceic = documents.some(
    (d) => d.type === 'niceic' && d.status === 'valid'
  );
  if (hasNiceic) {
    badges.push({
      type: 'niceic_approved',
      label: 'NICEIC Approved',
      description: 'NICEIC approved contractor',
      earnedAt: now
    });
  }

  // Long Standing Member badge (1+ years)
  if (contractor.onboarded_at) {
    const onboardedDate = new Date(contractor.onboarded_at);
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    if (onboardedDate < yearAgo) {
      badges.push({
        type: 'long_standing_member',
        label: 'Long Standing Member',
        description: 'Has been a verified member for over 1 year',
        earnedAt: now
      });
    }
  }

  // Fully Compliant badge (all docs valid)
  const allDocsValid = documents.length > 0 && documents.every((d) => d.status === 'valid');
  if (allDocsValid) {
    badges.push({
      type: 'fully_compliant',
      label: 'Fully Compliant',
      description: 'All compliance documents are current and valid',
      earnedAt: now
    });
  }

  return badges;
}

function extractCertifications(documents: PublicDocumentSummary[]): string[] {
  const certTypes = ['gas_safe', 'niceic', 'napit', 'oftec', 'cscs'];
  return documents
    .filter((d) => certTypes.includes(d.type) && d.status === 'valid')
    .map((d) => d.type);
}
