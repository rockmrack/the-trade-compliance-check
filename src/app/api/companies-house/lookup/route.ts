import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { lookupCompany, searchCompanies, type CompanyProfile } from '@/lib/services/companies-house';

// GET - Search or lookup companies
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyNumber = searchParams.get('companyNumber');
    const query = searchParams.get('query');

    if (companyNumber) {
      // Lookup specific company by number
      try {
        const company = await lookupCompany(companyNumber);

        return NextResponse.json({
          success: true,
          data: company
        });
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'LOOKUP_FAILED',
              message: error.message || 'Failed to lookup company'
            }
          },
          { status: error.statusCode || (error.message?.includes('not found') ? 404 : 500) }
        );
      }
    } else if (query) {
      // Search companies by name
      try {
        const companies = await searchCompanies(query);

        return NextResponse.json({
          success: true,
          data: {
            items: companies,
            total: companies.length
          }
        });
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SEARCH_FAILED',
              message: error.message || 'Failed to search companies'
            }
          },
          { status: error.statusCode || 500 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either companyNumber or query parameter is required'
          }
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Companies House API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } },
      { status: 500 }
    );
  }
}

// POST - Verify company status and update contractor
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { companyNumber, contractorId } = await request.json();

    if (!companyNumber) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Company number is required' } },
        { status: 400 }
      );
    }

    // Lookup company
    let company: CompanyProfile;
    try {
      company = await lookupCompany(companyNumber);
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LOOKUP_FAILED',
            message: error.message || 'Failed to lookup company'
          }
        },
        { status: error.statusCode || 404 }
      );
    }

    // Determine if company is in good standing
    const activeStatuses = ['active', 'open'];
    const isActive = activeStatuses.includes(company.companyStatus?.toLowerCase() || '');
    const isInGoodStanding = isActive && !company.hasCharges && !company.hasInsolvencyHistory;

    // Format response data
    const verificationData = {
      companyNumber: company.companyNumber,
      companyName: company.companyName,
      status: company.companyStatus,
      type: company.companyType,
      incorporationDate: company.dateOfCreation,
      registeredOffice: company.registeredOfficeAddress,
      sicCodes: company.sicCodes,
      isActive,
      isInGoodStanding,
      hasCharges: company.hasCharges || false,
      hasInsolvencyHistory: company.hasInsolvencyHistory || false,
      lastAccountsDate: company.lastAccountsDate,
      nextAccountsDue: company.nextAccountsDue,
      confirmationStatementDue: company.lastConfirmationStatementDate,
      verifiedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: verificationData
    });
  } catch (error) {
    console.error('Companies House verification error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Verification failed' } },
      { status: 500 }
    );
  }
}
