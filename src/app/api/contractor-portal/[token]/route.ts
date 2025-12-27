import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET - Fetch contractor data by access token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const serviceClient = await createServiceClient();

    // Validate token
    const { data: accessToken, error: tokenError } = await serviceClient
      .from('contractor_access_tokens')
      .select('contractor_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (tokenError || !accessToken) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired access link' } },
        { status: 401 }
      );
    }

    // Check expiry
    // @ts-ignore - Supabase type inference limitation
    if (new Date(accessToken.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Access link has expired' } },
        { status: 401 }
      );
    }

    // Mark token as used if first time
    // @ts-ignore - Supabase type inference limitation
    if (!accessToken.used_at) {
      // @ts-ignore - Supabase type inference limitation
      await serviceClient
        .from('contractor_access_tokens')
        // @ts-ignore - Supabase type inference limitation
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);
    }

    // Fetch contractor with documents
    const { data: contractor, error: fetchError } = await serviceClient
      .from('contractors')
      .select(`
        id,
        company_name,
        company_number,
        contact_name,
        email,
        phone,
        trade_type,
        verification_status,
        payment_status,
        last_verified_at,
        compliance_documents (
          id,
          document_type,
          provider_name,
          expiry_date,
          status,
          verification_score,
          document_url,
          created_at
        )
      `)
      // @ts-ignore - Supabase type inference limitation
      .eq('id', accessToken.contractor_id)
      .is('compliance_documents.replaced_by_id', null)
      .order('created_at', { foreignTable: 'compliance_documents', ascending: false })
      .single();

    if (fetchError || !contractor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Contractor not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: contractor
    });
  } catch (error) {
    console.error('Contractor portal fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch data' } },
      { status: 500 }
    );
  }
}
