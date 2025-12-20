import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check user role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'admin', 'finance'].includes((profile as any).role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const serviceClient = await createServiceClient();

    // Get all pending invoices
    const { data: pendingInvoices, error: invoicesError } = await serviceClient
      .from('payment_block_check')
      .select('*')
      .eq('status', 'pending');

    if (invoicesError) {
      throw invoicesError;
    }

    if (!pendingInvoices || pendingInvoices.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No pending invoices to process',
          totalInvoices: 0,
          approvedInvoices: 0,
          blockedInvoices: 0
        }
      });
    }

    // Create payment run record
    const { data: paymentRun, error: runError } = await serviceClient
      .from('payment_runs')
      // @ts-ignore - Supabase type inference limitation
      .insert({
        run_date: new Date().toISOString().split('T')[0],
        status: 'in_progress',
        total_invoices: pendingInvoices.length,
        processed_by: user.id
      })
      .select()
      .single();

    if (runError || !paymentRun) {
      throw runError || new Error('Failed to create payment run');
    }

    // Process each invoice
    const results = {
      approved: [] as { id: string; amount: number }[],
      blocked: [] as { id: string; amount: number; reason: string }[]
    };

    for (const invoice of pendingInvoices) {
      if ((invoice as any).can_pay) {
        // Approve the invoice
        await serviceClient
          .from('invoices')
          // @ts-ignore - Supabase type inference limitation
          .update({
            status: 'approved',
            compliance_check_at: new Date().toISOString()
          })
          .eq('id', (invoice as any).id);

        results.approved.push({ id: (invoice as any).id, amount: (invoice as any).amount });

        // Create payment run item
        await serviceClient
          .from('payment_run_items')
          // @ts-ignore - Supabase type inference limitation
          .insert({
            payment_run_id: (paymentRun as any).id,
            invoice_id: (invoice as any).id,
            status: 'approved'
          });
      } else {
        // Block the invoice
        await serviceClient
          .from('invoices')
          // @ts-ignore - Supabase type inference limitation
          .update({
            status: 'blocked',
            payment_block_reason: (invoice as any).block_reason,
            compliance_check_at: new Date().toISOString()
          })
          .eq('id', (invoice as any).id);

        results.blocked.push({
          id: (invoice as any).id,
          amount: (invoice as any).amount,
          reason: (invoice as any).block_reason || 'Compliance check failed'
        });

        // Create payment run item
        await serviceClient
          .from('payment_run_items')
          // @ts-ignore - Supabase type inference limitation
          .insert({
            payment_run_id: (paymentRun as any).id,
            invoice_id: (invoice as any).id,
            status: 'blocked',
            block_reason: (invoice as any).block_reason
          });
      }
    }

    // Update payment run with results
    const approvedAmount = results.approved.reduce((sum, inv) => sum + inv.amount, 0);
    const blockedAmount = results.blocked.reduce((sum, inv) => sum + inv.amount, 0);

    await serviceClient
      .from('payment_runs')
      // @ts-ignore - Supabase type inference limitation
      .update({
        status: 'completed',
        approved_invoices: results.approved.length,
        blocked_invoices: results.blocked.length,
        total_amount: approvedAmount + blockedAmount,
        approved_amount: approvedAmount,
        blocked_amount: blockedAmount,
        completed_at: new Date().toISOString()
      })
      .eq('id', (paymentRun as any).id);

    return NextResponse.json({
      success: true,
      data: {
        paymentRunId: (paymentRun as any).id,
        totalInvoices: pendingInvoices.length,
        approvedInvoices: results.approved.length,
        blockedInvoices: results.blocked.length,
        approvedAmount,
        blockedAmount,
        blockedDetails: results.blocked
      }
    });
  } catch (error) {
    console.error('Payment run error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Payment run failed'
        }
      },
      { status: 500 }
    );
  }
}

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

    // Get payment run preview (what would happen if we ran it now)
    const { data: pendingInvoices } = await supabase
      .from('payment_block_check')
      .select('*')
      .eq('status', 'pending');

    if (!pendingInvoices) {
      return NextResponse.json({
        success: true,
        data: {
          totalInvoices: 0,
          canPayCount: 0,
          blockedCount: 0,
          totalAmount: 0,
          approveableAmount: 0,
          blockedAmount: 0,
          invoices: []
        }
      });
    }

    const canPay = pendingInvoices.filter((inv) => (inv as any).can_pay);
    const blocked = pendingInvoices.filter((inv) => !(inv as any).can_pay);

    return NextResponse.json({
      success: true,
      data: {
        totalInvoices: pendingInvoices.length,
        canPayCount: canPay.length,
        blockedCount: blocked.length,
        totalAmount: pendingInvoices.reduce((sum, inv) => sum + (inv as any).amount, 0),
        approveableAmount: canPay.reduce((sum, inv) => sum + (inv as any).amount, 0),
        blockedAmount: blocked.reduce((sum, inv) => sum + (inv as any).amount, 0),
        invoices: pendingInvoices.map((inv) => ({
          id: (inv as any).id,
          invoiceNumber: (inv as any).invoice_number,
          contractorId: (inv as any).contractor_id,
          companyName: (inv as any).company_name,
          amount: (inv as any).amount,
          dueDate: (inv as any).due_date,
          canPay: (inv as any).can_pay,
          blockReason: (inv as any).block_reason
        }))
      }
    });
  } catch (error) {
    console.error('Payment run preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get payment run preview'
        }
      },
      { status: 500 }
    );
  }
}
