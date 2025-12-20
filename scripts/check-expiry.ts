/**
 * Cron Job: Check Document Expiry
 *
 * This script runs daily to:
 * 1. Update document statuses based on expiry dates
 * 2. Update contractor verification statuses
 * 3. Trigger payment blocks for non-compliant contractors
 *
 * Run: npm run cron:check-expiry
 * Schedule: Daily at 6:00 AM UTC
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/database.types';

// Initialize Supabase client with service role
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Starting expiry check job...');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    const results = {
      documentsUpdated: 0,
      contractorsUpdated: 0,
      paymentsBlocked: 0,
      errors: [] as string[]
    };

    // Step 1: Update document statuses
    console.log('\n1. Updating document statuses...');

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    // Mark expired documents
    const { data: expiredDocs, error: expiredError } = await supabase
      .from('compliance_documents')
      // @ts-ignore - Supabase type inference limitation with complex filter chains
      .update({ status: 'expired' })
      .lt('expiry_date', today)
      .in('status', ['valid', 'expiring_soon'])
      .is('replaced_by_id', null)
      .select('id');

    if (expiredError) {
      results.errors.push(`Error updating expired docs: ${expiredError.message}`);
    } else {
      console.log(`  - Marked ${expiredDocs?.length || 0} documents as expired`);
      results.documentsUpdated += expiredDocs?.length || 0;
    }

    // Mark expiring soon documents
    const { data: expiringDocs, error: expiringError } = await supabase
      .from('compliance_documents')
      // @ts-ignore - Supabase type inference limitation with complex filter chains
      .update({ status: 'expiring_soon' })
      .gte('expiry_date', today)
      .lte('expiry_date', thirtyDaysStr)
      .eq('status', 'valid')
      .is('replaced_by_id', null)
      .select('id');

    if (expiringError) {
      results.errors.push(`Error updating expiring docs: ${expiringError.message}`);
    } else {
      console.log(`  - Marked ${expiringDocs?.length || 0} documents as expiring soon`);
      results.documentsUpdated += expiringDocs?.length || 0;
    }

    // Step 2: Update contractor statuses
    console.log('\n2. Updating contractor statuses...');

    // Get contractors with expired critical documents
    const { data: nonCompliantContractors } = await supabase
      .from('contractors')
      .select(`
        id,
        company_name,
        verification_status,
        compliance_documents!inner (
          id,
          document_type,
          status
        )
      `)
      .eq('is_active', true)
      .eq('compliance_documents.status', 'expired')
      .in('compliance_documents.document_type', ['public_liability', 'employers_liability'])
      .is('compliance_documents.replaced_by_id', null);

    if (nonCompliantContractors) {
      for (const contractor of nonCompliantContractors) {
        // Update verification status if not already blocked
        // @ts-ignore - Supabase type inference limitation with joined queries
        if (contractor.verification_status !== 'blocked') {
          const { error: updateError } = await supabase
            .from('contractors')
            // @ts-ignore - Supabase type inference limitation with complex filter chains
            .update({
              verification_status: 'suspended',
              payment_status: 'blocked'
            })
            // @ts-ignore - Supabase type inference limitation with joined queries
            .eq('id', contractor.id);

          if (updateError) {
            results.errors.push(
              // @ts-ignore - Supabase type inference limitation with joined queries
              `Error updating contractor ${contractor.id}: ${updateError.message}`
            );
          } else {
            // @ts-ignore - Supabase type inference limitation with joined queries
            console.log(`  - Suspended contractor: ${contractor.company_name}`);
            results.contractorsUpdated++;
          }
        }
      }
    }

    // Step 3: Block pending payments for non-compliant contractors
    console.log('\n3. Blocking payments for non-compliant contractors...');

    const { data: invoicesToBlock } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        contractor_id,
        contractors!inner (
          company_name,
          payment_status
        )
      `)
      .eq('status', 'pending')
      .eq('contractors.payment_status', 'blocked');

    if (invoicesToBlock) {
      for (const invoice of invoicesToBlock) {
        const { error: blockError } = await supabase
          .from('invoices')
          // @ts-ignore - Supabase type inference limitation with complex filter chains
          .update({
            status: 'blocked',
            payment_block_reason: 'Contractor compliance issue - insurance expired',
            compliance_check_at: new Date().toISOString()
          })
          // @ts-ignore - Supabase type inference limitation with joined queries
          .eq('id', invoice.id);

        if (blockError) {
          results.errors.push(
            // @ts-ignore - Supabase type inference limitation with joined queries
            `Error blocking invoice ${invoice.invoice_number}: ${blockError.message}`
          );
        } else {
          // @ts-ignore - Supabase type inference limitation with joined queries
          console.log(`  - Blocked invoice #${invoice.invoice_number}`);
          results.paymentsBlocked++;
        }
      }
    }

    // Step 4: Recalculate risk scores
    console.log('\n4. Recalculating risk scores...');

    const { data: activeContractors } = await supabase
      .from('contractors')
      .select('id')
      .eq('is_active', true);

    if (activeContractors) {
      for (const contractor of activeContractors) {
        // @ts-ignore - Supabase RPC type inference issue
        await supabase.rpc('calculate_risk_score', {
          // @ts-ignore - Supabase type inference limitation
          contractor_id: contractor.id
        });
      }
      console.log(`  - Updated risk scores for ${activeContractors.length} contractors`);
    }

    // Summary
    console.log('\n========== Summary ==========');
    console.log(`Documents updated: ${results.documentsUpdated}`);
    console.log(`Contractors updated: ${results.contractorsUpdated}`);
    console.log(`Payments blocked: ${results.paymentsBlocked}`);
    console.log(`Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach((err) => console.log(`  - ${err}`));
    }

    console.log('\nExpiry check job completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error in expiry check job:', error);
    process.exit(1);
  }
}

main();
