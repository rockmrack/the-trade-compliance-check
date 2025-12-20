import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';

export const dynamic = 'force-dynamic';

function escapeCsvField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCurrency(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'contractors';
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
    let csvContent = '';

    switch (type) {
      case 'contractors': {
        const { data: contractors } = await serviceClient
          .from('contractors')
          .select('*')
          .is('deleted_at', null)
          .order('company_name');

        // CSV Header
        csvContent = [
          'Company Name',
          'Companies House Number',
          'Contact Name',
          'Email',
          'Phone',
          'Trade Type',
          'Address',
          'Postcode',
          'VAT Number',
          'Verification Status',
          'Payment Status',
          'Risk Score',
          'Last Verified',
          'Created Date'
        ].join(',') + '\n';

        // CSV Rows
        contractors?.forEach(c => {
          csvContent += [
            escapeCsvField((c as any).company_name),
            escapeCsvField((c as any).company_number),
            escapeCsvField((c as any).contact_name),
            escapeCsvField((c as any).email),
            escapeCsvField((c as any).phone),
            escapeCsvField((c as any).trade_types?.join('; ')),
            escapeCsvField([(c as any).address_line1, (c as any).address_line2, (c as any).address_city, (c as any).address_county].filter(Boolean).join(', ')),
            escapeCsvField((c as any).address_postcode),
            escapeCsvField((c as any).vat_number),
            escapeCsvField((c as any).verification_status),
            escapeCsvField((c as any).payment_status),
            escapeCsvField((c as any).risk_score),
            escapeCsvField((c as any).last_verified_at ? format(new Date((c as any).last_verified_at), 'dd/MM/yyyy') : ''),
            escapeCsvField(format(new Date((c as any).created_at), 'dd/MM/yyyy'))
          ].join(',') + '\n';
        });
        break;
      }

      case 'documents': {
        const { data: documents } = await serviceClient
          .from('compliance_documents')
          .select(`
            *,
            contractor:contractors(company_name)
          `)
          .is('replaced_by_id', null)
          .order('expiry_date');

        // CSV Header
        csvContent = [
          'Contractor',
          'Document Type',
          'Provider/Issuer',
          'Policy/Registration Number',
          'Coverage Amount',
          'Start Date',
          'Expiry Date',
          'Status',
          'Verification Score',
          'Manually Verified',
          'Upload Date'
        ].join(',') + '\n';

        // CSV Rows
        documents?.forEach(d => {
          csvContent += [
            escapeCsvField(((d as any).contractor as { company_name: string })?.company_name),
            escapeCsvField(formatDocumentType((d as any).document_type)),
            escapeCsvField((d as any).provider_name),
            escapeCsvField((d as any).policy_number || (d as any).registration_number),
            escapeCsvField((d as any).coverage_amount ? formatCurrency((d as any).coverage_amount) : ''),
            escapeCsvField((d as any).start_date ? format(new Date((d as any).start_date), 'dd/MM/yyyy') : ''),
            escapeCsvField(format(new Date((d as any).expiry_date), 'dd/MM/yyyy')),
            escapeCsvField((d as any).status),
            escapeCsvField((d as any).verification_score),
            escapeCsvField((d as any).manually_verified ? 'Yes' : 'No'),
            escapeCsvField((d as any).created_at ? format(new Date((d as any).created_at), 'dd/MM/yyyy') : '')
          ].join(',') + '\n';
        });
        break;
      }

      case 'compliance': {
        const { data: summary } = await serviceClient
          .from('contractor_compliance_summary')
          .select('*')
          .order('company_name');

        // CSV Header
        csvContent = [
          'Company Name',
          'Companies House Number',
          'Verification Status',
          'Payment Status',
          'Risk Score',
          'Total Documents',
          'Valid Documents',
          'Expiring Documents',
          'Expired Documents',
          'Pending Documents',
          'Next Expiry Date',
          'Last Document Update',
          'Last Verified'
        ].join(',') + '\n';

        // CSV Rows
        summary?.forEach(s => {
          csvContent += [
            escapeCsvField((s as any).company_name),
            escapeCsvField((s as any).company_number),
            escapeCsvField((s as any).verification_status),
            escapeCsvField((s as any).payment_status),
            escapeCsvField((s as any).risk_score),
            escapeCsvField((s as any).total_documents),
            escapeCsvField((s as any).valid_documents),
            escapeCsvField((s as any).expiring_documents),
            escapeCsvField((s as any).expired_documents),
            escapeCsvField((s as any).pending_documents),
            escapeCsvField((s as any).next_expiry_date ? format(new Date((s as any).next_expiry_date), 'dd/MM/yyyy') : ''),
            escapeCsvField((s as any).last_document_update ? format(new Date((s as any).last_document_update), 'dd/MM/yyyy HH:mm') : ''),
            escapeCsvField((s as any).last_verified_at ? format(new Date((s as any).last_verified_at), 'dd/MM/yyyy') : '')
          ].join(',') + '\n';
        });
        break;
      }

      case 'payments': {
        const { data: invoices } = await serviceClient
          .from('invoices')
          .select(`
            *,
            contractor:contractors(company_name, verification_status, payment_status)
          `)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        // CSV Header
        csvContent = [
          'Invoice Number',
          'Contractor',
          'Amount',
          'Currency',
          'Description',
          'Project Reference',
          'Due Date',
          'Invoice Status',
          'Contractor Verification',
          'Payment Block Reason',
          'Approved By',
          'Approved Date',
          'Paid Date',
          'Created Date'
        ].join(',') + '\n';

        // CSV Rows
        invoices?.forEach(i => {
          csvContent += [
            escapeCsvField((i as any).invoice_number),
            escapeCsvField(((i as any).contractor as { company_name: string })?.company_name),
            escapeCsvField(formatCurrency((i as any).amount)),
            escapeCsvField((i as any).currency),
            escapeCsvField((i as any).description),
            escapeCsvField((i as any).project_reference),
            escapeCsvField(format(new Date((i as any).due_date), 'dd/MM/yyyy')),
            escapeCsvField((i as any).status),
            escapeCsvField(((i as any).contractor as { verification_status: string })?.verification_status),
            escapeCsvField((i as any).payment_block_reason),
            escapeCsvField((i as any).approved_by),
            escapeCsvField((i as any).approved_at ? format(new Date((i as any).approved_at), 'dd/MM/yyyy') : ''),
            escapeCsvField((i as any).paid_at ? format(new Date((i as any).paid_at), 'dd/MM/yyyy') : ''),
            escapeCsvField(format(new Date((i as any).created_at), 'dd/MM/yyyy'))
          ].join(',') + '\n';
        });
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TYPE', message: 'Invalid report type' } },
          { status: 400 }
        );
    }

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${type}_report_${format(now, 'yyyy-MM-dd')}.csv"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Report export error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Export failed' } },
      { status: 500 }
    );
  }
}

function formatDocumentType(type: string): string {
  const types: Record<string, string> = {
    public_liability: 'Public Liability Insurance',
    employers_liability: "Employer's Liability Insurance",
    professional_indemnity: 'Professional Indemnity',
    gas_safe: 'Gas Safe Registration',
    niceic: 'NICEIC Certificate',
    napit: 'NAPIT Certificate',
    oftec: 'OFTEC Registration',
    cscs: 'CSCS Card',
    building_regulations: 'Building Regulations',
    other_certification: 'Other Certification'
  };
  return types[type] || type;
}
