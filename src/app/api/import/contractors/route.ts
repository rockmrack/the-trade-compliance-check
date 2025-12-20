import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// UK-specific validation
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const UK_VAT_REGEX = /^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$/i;
const UK_PHONE_REGEX = /^(\+44|0)\d{10,11}$/;
const UK_COMPANY_NUMBER_REGEX = /^\d{8}$|^[A-Z]{2}\d{6}$/;

const UK_TRADE_TYPES = [
  'general_builder', 'electrician', 'plumber', 'gas_engineer', 'heating_engineer',
  'carpenter', 'roofer', 'plasterer', 'painter_decorator', 'bricklayer',
  'tiler', 'flooring', 'kitchen_fitter', 'bathroom_fitter', 'landscaper',
  'groundworker', 'scaffolder', 'window_fitter', 'locksmith', 'alarm_cctv',
  'damp_proofing', 'demolition', 'drainage', 'hvac', 'solar_installer',
  'ev_charger', 'other'
];

interface CSVRow {
  company_name: string;
  company_number?: string;
  contact_name: string;
  email: string;
  phone: string;
  trade_type: string;
  address_line1?: string;
  address_line2?: string;
  address_city?: string;
  address_county?: string;
  address_postcode?: string;
  vat_number?: string;
  notes?: string;
}

interface ImportResult {
  row: number;
  success: boolean;
  companyName: string;
  contractorId?: string;
  error?: string;
}

function parseCSV(csvContent: string): { headers: string[]; rows: string[][] } {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]!).map(h =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  const rows = lines.slice(1).map(line => parseCSVLine(line));

  return { headers, rows };
}

function validateRow(row: CSVRow, rowNumber: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!row.company_name?.trim()) {
    errors.push('Company name is required');
  }
  if (!row.contact_name?.trim()) {
    errors.push('Contact name is required');
  }
  if (!row.email?.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push('Invalid email format');
  }
  if (!row.phone?.trim()) {
    errors.push('Phone is required');
  } else {
    const cleanPhone = row.phone.replace(/[\s\-()]/g, '');
    if (!UK_PHONE_REGEX.test(cleanPhone)) {
      errors.push('Invalid UK phone number format');
    }
  }
  if (!row.trade_type?.trim()) {
    errors.push('Trade type is required');
  } else {
    const normalizedTrade = row.trade_type.toLowerCase().replace(/[\s-]/g, '_');
    if (!UK_TRADE_TYPES.includes(normalizedTrade)) {
      errors.push(`Invalid trade type. Valid types: ${UK_TRADE_TYPES.join(', ')}`);
    }
  }

  // Optional field validation
  if (row.company_number && !UK_COMPANY_NUMBER_REGEX.test(row.company_number)) {
    errors.push('Invalid Companies House number format (8 digits or 2 letters + 6 digits)');
  }
  if (row.address_postcode && !UK_POSTCODE_REGEX.test(row.address_postcode)) {
    errors.push('Invalid UK postcode format');
  }
  if (row.vat_number && !UK_VAT_REGEX.test(row.vat_number)) {
    errors.push('Invalid UK VAT number format (e.g., GB123456789)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// POST - Import contractors from CSV
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dryRun = formData.get('dryRun') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_FILE', message: 'CSV file is required' } },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FILE', message: 'File must be a CSV' } },
        { status: 400 }
      );
    }

    const csvContent = await file.text();
    const { headers, rows } = parseCSV(csvContent);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPTY_FILE', message: 'CSV file is empty' } },
        { status: 400 }
      );
    }

    // Check required headers
    const requiredHeaders = ['company_name', 'contact_name', 'email', 'phone', 'trade_type'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_HEADERS',
            message: `Missing required columns: ${missingHeaders.join(', ')}`
          }
        },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();
    const results: ImportResult[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i]!;
      const rowNumber = i + 2; // +2 for 1-indexed and header row

      // Map row to object
      const row: CSVRow = headers.reduce((acc, header, index) => {
        acc[header as keyof CSVRow] = rowData[index] || '';
        return acc;
      }, {} as CSVRow);

      const validation = validateRow(row, rowNumber);

      if (!validation.valid) {
        results.push({
          row: rowNumber,
          success: false,
          companyName: row.company_name || 'Unknown',
          error: validation.errors.join('; ')
        });
        failCount++;
        continue;
      }

      // Check for duplicate email
      const { data: existing } = await serviceClient
        .from('contractors')
        .select('id')
        .eq('email', row.email.toLowerCase())
        .single();

      if (existing) {
        results.push({
          row: rowNumber,
          success: false,
          companyName: row.company_name,
          error: 'Contractor with this email already exists'
        });
        failCount++;
        continue;
      }

      if (dryRun) {
        results.push({
          row: rowNumber,
          success: true,
          companyName: row.company_name
        });
        successCount++;
        continue;
      }

      // Insert contractor
      const normalizedTrade = row.trade_type.toLowerCase().replace(/[\s-]/g, '_');
      const cleanPhone = row.phone.replace(/[\s\-()]/g, '');

      const { data: contractor, error: insertError } = await serviceClient
        .from('contractors')
        // @ts-ignore - Supabase type inference limitation
        .insert({
          company_name: row.company_name.trim(),
          company_number: row.company_number?.trim() || null,
          contact_name: row.contact_name.trim(),
          email: row.email.toLowerCase().trim(),
          phone: cleanPhone,
          trade_types: [normalizedTrade],
          address_line1: row.address_line1?.trim() || null,
          address_line2: row.address_line2?.trim() || null,
          address_city: row.address_city?.trim() || null,
          address_county: row.address_county?.trim() || null,
          address_postcode: row.address_postcode?.toUpperCase().trim() || null,
          vat_number: row.vat_number?.toUpperCase().trim() || null,
          notes: row.notes?.trim() || null,
          verification_status: 'unverified',
          payment_status: 'pending_review',
          created_by: user.id
        })
        .select('id')
        .single();

      if (insertError || !contractor) {
        results.push({
          row: rowNumber,
          success: false,
          companyName: row.company_name,
          error: 'Database error: ' + (insertError?.message || 'Unknown error')
        });
        failCount++;
      } else {
        results.push({
          row: rowNumber,
          success: true,
          companyName: row.company_name,
          contractorId: (contractor as any).id
        });
        successCount++;
      }
    }

    // Create import job record
    if (!dryRun) {
      // @ts-ignore - Supabase type inference limitation
      await serviceClient.from('import_jobs').insert({
        type: 'contractors',
        file_name: file.name,
        file_path: '', // Not storing the file
        status: failCount === 0 ? 'completed' : (successCount > 0 ? 'completed' : 'failed'),
        total_rows: rows.length,
        processed_rows: rows.length,
        successful_rows: successCount,
        failed_rows: failCount,
        errors: results.filter(r => !r.success).map(r => ({
          row: r.row,
          companyName: r.companyName,
          error: r.error
        })),
        results: {
          successCount,
          failCount,
          totalRows: rows.length
        },
        created_by: user.id,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

      // Audit log
      // @ts-ignore - Supabase type inference limitation
      await serviceClient.from('audit_logs').insert({
        entity_type: 'import',
        entity_id: '00000000-0000-0000-0000-000000000000',
        action: 'create',
        performed_by: user.id,
        new_values: {
          type: 'contractors',
          fileName: file.name,
          totalRows: rows.length,
          successCount,
          failCount
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        dryRun,
        totalRows: rows.length,
        successCount,
        failCount,
        results: results.slice(0, 100), // Limit results in response
        hasMoreResults: results.length > 100
      }
    });
  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Import failed' } },
      { status: 500 }
    );
  }
}

// GET - Get CSV template
export async function GET(request: NextRequest) {
  const template = `company_name,company_number,contact_name,email,phone,trade_type,address_line1,address_line2,address_city,address_county,address_postcode,vat_number,notes
"ABC Plumbing Ltd","12345678","John Smith","john@abcplumbing.co.uk","07700900123","plumber","123 High Street","","London","Greater London","SW1A 1AA","GB123456789","Established 2010"
"Smith Electrical","","Jane Doe","jane@smithelectrical.co.uk","02071234567","electrician","456 Main Road","Unit 2","Manchester","Greater Manchester","M1 1AA","","NICEIC registered"`;

  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contractor_import_template.csv"'
    }
  });
}
