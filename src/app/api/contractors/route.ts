import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const contractorSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyNumber: z.string().optional(),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Valid phone number required'),
  tradeType: z.string().min(1, 'Trade type is required'),
  address: z.string().optional(),
  postcode: z.string().optional(),
  vatNumber: z.string().optional(),
  notes: z.string().optional(),
});

// GET - List contractors with filtering and pagination
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
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const trade = searchParams.get('trade') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const serviceClient = await createServiceClient();

    let query = serviceClient
      .from('contractors')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('verification_status', status);
    }

    // Apply trade filter
    if (trade && trade !== 'all') {
      query = query.eq('trade_type', trade);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: contractors, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch contractors' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        contractors,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching contractors:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch contractors' } },
      { status: 500 }
    );
  }
}

// POST - Create new contractor
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

    const body = await request.json();
    const validation = contractorSchema.safeParse(body);

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

    // Check for duplicate email
    const { data: existing } = await serviceClient
      .from('contractors')
      .select('id')
      .eq('email', data.email)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_EMAIL', message: 'A contractor with this email already exists' } },
        { status: 409 }
      );
    }

    // Create contractor
    const { data: contractor, error } = await serviceClient
      .from('contractors')
      // @ts-ignore - Supabase type inference limitation
      .insert({
        company_name: data.companyName,
        company_number: data.companyNumber || null,
        contact_name: data.contactName,
        email: data.email,
        phone: data.phone,
        trade_type: data.tradeType,
        address: data.address || null,
        postcode: data.postcode || null,
        vat_number: data.vatNumber || null,
        notes: data.notes || null,
        verification_status: 'pending',
        payment_status: 'blocked',
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to create contractor' } },
        { status: 500 }
      );
    }

    // Create audit log
    // @ts-ignore - Supabase type inference limitation
    await serviceClient.from('audit_logs').insert({
      entity_type: 'contractor',
      entity_id: (contractor as any).id,
      action: 'create',
      performed_by: user.id,
      new_values: contractor
    });

    return NextResponse.json({
      success: true,
      data: contractor
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating contractor:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create contractor' } },
      { status: 500 }
    );
  }
}
