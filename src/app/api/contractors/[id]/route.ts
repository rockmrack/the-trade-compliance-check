import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateContractorSchema = z.object({
  companyName: z.string().min(1).optional(),
  companyNumber: z.string().optional(),
  contactName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  tradeType: z.string().min(1).optional(),
  address: z.string().optional(),
  postcode: z.string().optional(),
  vatNumber: z.string().optional(),
  notes: z.string().optional(),
  verificationStatus: z.enum(['pending', 'verified', 'expired', 'blocked']).optional(),
  paymentStatus: z.enum(['allowed', 'blocked', 'on_hold']).optional(),
});

// GET - Get single contractor with documents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const serviceClient = await createServiceClient();

    // Get contractor
    const { data: contractor, error } = await serviceClient
      .from('contractors')
      .select(`
        *,
        compliance_documents (
          id,
          document_type,
          provider_name,
          expiry_date,
          status,
          verification_score,
          document_url,
          created_at
        ),
        verification_logs (
          id,
          check_type,
          status,
          result,
          created_at
        )
      `)
      .eq('id', id)
      .is('compliance_documents.replaced_by_id', null)
      .order('created_at', { foreignTable: 'compliance_documents', ascending: false })
      .order('created_at', { foreignTable: 'verification_logs', ascending: false })
      .single();

    if (error || !contractor) {
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
    console.error('Error fetching contractor:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch contractor' } },
      { status: 500 }
    );
  }
}

// PATCH - Update contractor
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = updateContractorSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: validation.error.errors
          }
        },
        { status: 400 }
      );
    }

    const data = validation.data;
    const serviceClient = await createServiceClient();

    // Get current contractor
    const { data: currentContractor, error: fetchError } = await serviceClient
      .from('contractors')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentContractor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Contractor not found' } },
        { status: 404 }
      );
    }

    // Check for duplicate email if email is being changed
    // @ts-ignore - Supabase type inference limitation
    if (data.email && data.email !== currentContractor.email) {
      const { data: existing } = await serviceClient
        .from('contractors')
        .select('id')
        .eq('email', data.email)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_EMAIL', message: 'A contractor with this email already exists' } },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    if (data.companyName !== undefined) updateData.company_name = data.companyName;
    if (data.companyNumber !== undefined) updateData.company_number = data.companyNumber;
    if (data.contactName !== undefined) updateData.contact_name = data.contactName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.tradeType !== undefined) updateData.trade_type = data.tradeType;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.postcode !== undefined) updateData.postcode = data.postcode;
    if (data.vatNumber !== undefined) updateData.vat_number = data.vatNumber;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.verificationStatus !== undefined) updateData.verification_status = data.verificationStatus;
    if (data.paymentStatus !== undefined) updateData.payment_status = data.paymentStatus;

    // Update contractor
    const { data: contractor, error } = await serviceClient
      .from('contractors')
      // @ts-ignore - Supabase type inference limitation
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to update contractor' } },
        { status: 500 }
      );
    }

    // Create audit log
    // @ts-ignore - Supabase type inference limitation
    await serviceClient.from('audit_logs').insert({
      entity_type: 'contractor',
      entity_id: id,
      action: 'update',
      performed_by: user.id,
      old_values: currentContractor,
      new_values: contractor
    });

    return NextResponse.json({
      success: true,
      data: contractor
    });
  } catch (error) {
    console.error('Error updating contractor:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update contractor' } },
      { status: 500 }
    );
  }
}

// DELETE - Delete contractor (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const serviceClient = await createServiceClient();

    // Get current contractor
    const { data: currentContractor, error: fetchError } = await serviceClient
      .from('contractors')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentContractor) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Contractor not found' } },
        { status: 404 }
      );
    }

    // Soft delete by setting deleted_at and is_active
    const { error } = await serviceClient
      .from('contractors')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false
      } as any)
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to delete contractor' } },
        { status: 500 }
      );
    }

    // Create audit log
    await serviceClient.from('audit_logs').insert({
      entity_type: 'contractor',
      entity_id: id,
      action: 'delete',
      performed_by: user.id,
      old_values: currentContractor
    });

    return NextResponse.json({
      success: true,
      message: 'Contractor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contractor:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete contractor' } },
      { status: 500 }
    );
  }
}
