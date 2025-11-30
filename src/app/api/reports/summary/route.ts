import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { subDays, startOfMonth, startOfYear } from 'date-fns';

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
    const range = searchParams.get('range') || '30d';

    // Calculate date range
    let startDate: Date;
    const now = new Date();

    switch (range) {
      case '7d':
        startDate = subDays(now, 7);
        break;
      case '30d':
        startDate = subDays(now, 30);
        break;
      case '90d':
        startDate = subDays(now, 90);
        break;
      case 'mtd':
        startDate = startOfMonth(now);
        break;
      case 'ytd':
        startDate = startOfYear(now);
        break;
      default:
        startDate = subDays(now, 30);
    }

    const serviceClient = await createServiceClient();

    // Fetch contractor stats
    const { data: contractors } = await serviceClient
      .from('contractors')
      .select('id, verification_status, payment_status')
      .is('deleted_at', null);

    const totalContractors = contractors?.length || 0;
    const verifiedContractors = contractors?.filter(c => c.verification_status === 'verified').length || 0;
    const pendingContractors = contractors?.filter(c =>
      c.verification_status === 'unverified' || c.verification_status === 'partially_verified'
    ).length || 0;
    const blockedContractors = contractors?.filter(c =>
      c.verification_status === 'blocked' || c.verification_status === 'suspended'
    ).length || 0;

    // Fetch document stats
    const { data: documents } = await serviceClient
      .from('compliance_documents')
      .select('id, status, expiry_date, created_at')
      .is('replaced_by_id', null);

    const totalDocuments = documents?.length || 0;
    const validDocuments = documents?.filter(d => d.status === 'valid').length || 0;
    const expiringDocuments = documents?.filter(d => d.status === 'expiring_soon').length || 0;
    const expiredDocuments = documents?.filter(d => d.status === 'expired').length || 0;
    const documentsUploadedThisMonth = documents?.filter(d =>
      new Date(d.created_at) >= startOfMonth(now)
    ).length || 0;

    // Fetch invoice stats
    const { data: invoices } = await serviceClient
      .from('invoices')
      .select('id, amount, status');

    const totalInvoicesValue = invoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;
    const blockedInvoicesValue = invoices
      ?.filter(i => i.status === 'blocked')
      .reduce((sum, i) => sum + (i.amount || 0), 0) || 0;

    // Calculate compliance rate
    const complianceRate = totalContractors > 0
      ? (verifiedContractors / totalContractors) * 100
      : 0;

    // Fetch expiring documents with contractor info
    const { data: expiringDocs } = await serviceClient
      .from('compliance_documents')
      .select(`
        id,
        document_type,
        expiry_date,
        contractor:contractors(company_name)
      `)
      .is('replaced_by_id', null)
      .in('status', ['valid', 'expiring_soon'])
      .lte('expiry_date', subDays(now, -30).toISOString().split('T')[0])
      .order('expiry_date', { ascending: true })
      .limit(10);

    const expiringDocuments_ = expiringDocs?.map(d => ({
      id: d.id,
      contractor_name: (d.contractor as { company_name: string })?.company_name || 'Unknown',
      document_type: d.document_type,
      expiry_date: d.expiry_date,
      days_until_expiry: Math.ceil(
        (new Date(d.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
    })) || [];

    // Fetch recent activity from audit logs
    const { data: auditLogs } = await serviceClient
      .from('audit_logs')
      .select('id, entity_type, action, new_state, created_at')
      .gte('created_at', startDate.toISOString())
      .in('entity_type', ['contractors', 'compliance_documents', 'invoices'])
      .order('created_at', { ascending: false })
      .limit(10);

    const recentActivity = auditLogs?.map(log => {
      let type: 'document_uploaded' | 'contractor_verified' | 'payment_blocked' | 'document_expired' = 'document_uploaded';
      let description = '';

      if (log.entity_type === 'compliance_documents' && log.action === 'create') {
        type = 'document_uploaded';
        description = `New document uploaded`;
      } else if (log.entity_type === 'contractors' && log.action === 'update') {
        const newState = log.new_state as { verification_status?: string; payment_status?: string; company_name?: string };
        if (newState?.verification_status === 'verified') {
          type = 'contractor_verified';
          description = `${newState?.company_name || 'Contractor'} verified`;
        } else if (newState?.payment_status === 'blocked') {
          type = 'payment_blocked';
          description = `Payments blocked for ${newState?.company_name || 'contractor'}`;
        }
      } else if (log.entity_type === 'compliance_documents' && log.action === 'update') {
        const newState = log.new_state as { status?: string };
        if (newState?.status === 'expired') {
          type = 'document_expired';
          description = 'Document expired';
        }
      }

      return {
        id: log.id,
        type,
        description: description || `${log.action} on ${log.entity_type}`,
        timestamp: log.created_at
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalContractors,
          verifiedContractors,
          pendingContractors,
          blockedContractors,
          totalDocuments,
          validDocuments,
          expiringDocuments,
          expiredDocuments,
          totalInvoicesValue,
          blockedInvoicesValue,
          complianceRate,
          documentsUploadedThisMonth
        },
        expiringDocuments: expiringDocuments_,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Reports summary error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate report' } },
      { status: 500 }
    );
  }
}
