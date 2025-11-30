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
      const result = await lookupCompany(companyNumber);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'LOOKUP_FAILED',
              message: result.error || 'Failed to lookup company'
            }
          },
          { status: result.error?.includes('not found') ? 404 : 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.company
      });
    } else if (query) {
      // Search companies by name
      const result = await searchCompanies(query);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SEARCH_FAILED',
              message: result.error || 'Failed to search companies'
            }
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          items: result.companies,
          total: result.companies?.length || 0
        }
      });
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
    const result = await lookupCompany(companyNumber);

    if (!result.success || !result.company) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LOOKUP_FAILED',
            message: result.error || 'Failed to lookup company'
          }
        },
        { status: 404 }
      );
    }

    const company = result.company as CompanyProfile;

    // Determine if company is in good standing
    const activeStatuses = ['active', 'open'];
    const isActive = activeStatuses.includes(company.company_status?.toLowerCase() || '');
    const isInGoodStanding = isActive && !company.has_charges && !company.has_insolvency_history;

    // Format response data
    const verificationData = {
      companyNumber: company.company_number,
      companyName: company.company_name,
      status: company.company_status,
      type: company.type,
      incorporationDate: company.date_of_creation,
      registeredOffice: company.registered_office_address,
      sicCodes: company.sic_codes,
      isActive,
      isInGoodStanding,
      hasCharges: company.has_charges || false,
      hasInsolvencyHistory: company.has_insolvency_history || false,
      lastAccountsDate: company.accounts?.last_accounts?.made_up_to,
      nextAccountsDue: company.accounts?.next_due,
      confirmationStatementDue: company.confirmation_statement?.next_due,
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
