import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  lookupGasSafeEngineer,
  getGasSafeLookupUrl,
  formatGasSafeLicence,
  validateGasSafeIdCard
} from '@/lib/services/gas-safe';

// GET - Lookup Gas Safe engineer
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
    const licenceNumber = searchParams.get('licence');

    if (!licenceNumber) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Licence number is required' } },
        { status: 400 }
      );
    }

    // Validate format
    if (!validateGasSafeIdCard(licenceNumber)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Invalid Gas Safe licence number format. Must be 7 digits.'
          }
        },
        { status: 400 }
      );
    }

    const formattedLicence = formatGasSafeLicence(licenceNumber);

    // Check cache in database
    const serviceClient = await createServiceClient();
    const { data: cached } = await serviceClient
      .from('gas_safe_cache')
      .select('*')
      .eq('licence_number', formattedLicence)
      .gte('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (cached) {
      return NextResponse.json({
        success: true,
        data: {
          licenceNumber: cached.licence_number,
          engineerName: cached.engineer_name,
          tradingName: cached.trading_name,
          businessAddress: cached.business_address,
          status: cached.status,
          isValid: cached.is_valid,
          appliances: cached.appliances || [],
          expiryDate: cached.expires_at,
          manualVerificationUrl: getGasSafeLookupUrl(formattedLicence)
        },
        cached: true
      });
    }

    // Perform lookup
    const result = await lookupGasSafeEngineer(formattedLicence);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'LOOKUP_FAILED', message: result.error } },
        { status: 500 }
      );
    }

    // Store in cache
    if (result.engineer) {
      await serviceClient.from('gas_safe_cache').upsert({
        licence_number: formattedLicence,
        engineer_name: result.engineer.engineerName,
        trading_name: result.engineer.tradingName,
        business_address: result.engineer.businessAddress,
        status: result.engineer.status,
        is_valid: result.engineer.isValid,
        appliances: result.engineer.appliances,
        expires_at: result.engineer.expiryDate,
        raw_data: result.engineer.rawData,
        fetched_at: new Date().toISOString()
      }, {
        onConflict: 'licence_number'
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.engineer,
        manualVerificationUrl: getGasSafeLookupUrl(formattedLicence)
      },
      cached: false
    });
  } catch (error) {
    console.error('Gas Safe lookup error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Lookup failed' } },
      { status: 500 }
    );
  }
}

// POST - Verify Gas Safe and link to contractor
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

    const { licenceNumber, contractorId } = await request.json();

    if (!licenceNumber || !contractorId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Licence number and contractor ID required' }
        },
        { status: 400 }
      );
    }

    if (!validateGasSafeIdCard(licenceNumber)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Invalid Gas Safe licence number format'
          }
        },
        { status: 400 }
      );
    }

    const formattedLicence = formatGasSafeLicence(licenceNumber);
    const serviceClient = await createServiceClient();

    // Verify contractor exists
    const { data: contractor, error: contractorError } = await serviceClient
      .from('contractors')
      .select('id, company_name')
      .eq('id', contractorId)
      .single();

    if (contractorError || !contractor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Contractor not found' } },
        { status: 404 }
      );
    }

    // Perform lookup
    const result = await lookupGasSafeEngineer(formattedLicence);

    // Create verification log
    await serviceClient.from('verification_logs').insert({
      contractor_id: contractorId,
      check_type: 'gas_safe_registry',
      status: result.success ? 'success' : 'error',
      result: {
        licenceNumber: formattedLicence,
        lookupResult: result.engineer || null,
        verificationUrl: getGasSafeLookupUrl(formattedLicence),
        note: result.engineer?.rawData?.note || null
      },
      performed_by: user.id
    });

    // If lookup indicates valid registration, update contractor
    if (result.success && result.engineer?.isValid) {
      // Check if gas_safe document already exists
      const { data: existingDoc } = await serviceClient
        .from('compliance_documents')
        .select('id')
        .eq('contractor_id', contractorId)
        .eq('document_type', 'gas_safe')
        .is('replaced_by_id', null)
        .single();

      if (existingDoc) {
        // Update existing document with verified registration number
        await serviceClient
          .from('compliance_documents')
          .update({
            registration_number: formattedLicence,
            status: 'valid',
            verification_score: 90,
            ai_analysis: {
              gasSafeVerified: true,
              verifiedAt: new Date().toISOString(),
              appliances: result.engineer.appliances
            }
          })
          .eq('id', existingDoc.id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        verified: result.success,
        engineer: result.engineer,
        manualVerificationUrl: getGasSafeLookupUrl(formattedLicence),
        message: result.engineer?.status === 'unknown'
          ? 'Automated verification unavailable. Please verify manually using the provided link.'
          : result.engineer?.isValid
          ? 'Gas Safe registration verified successfully'
          : 'Gas Safe registration could not be verified'
      }
    });
  } catch (error) {
    console.error('Gas Safe verification error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Verification failed' } },
      { status: 500 }
    );
  }
}
