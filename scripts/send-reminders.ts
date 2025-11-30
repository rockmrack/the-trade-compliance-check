/**
 * Cron Job: Send Expiry Reminders
 *
 * This script runs daily to send WhatsApp/Email reminders for:
 * - Documents expiring in 30 days
 * - Documents expiring in 14 days
 * - Documents expiring in 7 days
 * - Documents expiring in 3 days
 * - Documents expiring in 1 day
 * - Documents that just expired
 *
 * Run: npm run cron:send-reminders
 * Schedule: Daily at 9:00 AM UTC
 */

import { createClient } from '@supabase/supabase-js';
import Twilio from 'twilio';
import type { Database } from '../src/lib/database.types';

// Initialize clients
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';

// Reminder schedule
const REMINDER_DAYS = [30, 14, 7, 3, 1, 0];

interface ExpiringDocument {
  id: string;
  contractor_id: string;
  document_type: string;
  expiry_date: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  whatsapp_number: string | null;
  days_until_expiry: number;
}

async function main() {
  console.log('Starting reminder job...');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    const results = {
      sent: 0,
      failed: 0,
      skipped: 0
    };

    // Get templates
    const { data: templates } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('is_active', true)
      .eq('channel', 'whatsapp');

    const templateMap = new Map(templates?.map((t) => [t.trigger_type, t]) || []);

    // Process each reminder day
    for (const days of REMINDER_DAYS) {
      console.log(`\nProcessing ${days} day reminders...`);

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Get expiring documents for this date
      const { data: documents } = await supabase
        .from('expiring_documents_view')
        .select('*')
        .eq('expiry_date', dateStr);

      if (!documents || documents.length === 0) {
        console.log(`  No documents expiring in ${days} days`);
        continue;
      }

      console.log(`  Found ${documents.length} documents`);

      for (const doc of documents as ExpiringDocument[]) {
        // Check if we already sent this notification
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('contractor_id', doc.contractor_id)
          .contains('metadata', { document_id: doc.id, days_warning: days })
          .single();

        if (existingNotification) {
          console.log(`  - Skipping ${doc.company_name} (already notified)`);
          results.skipped++;
          continue;
        }

        // Get appropriate template
        let template;
        if (days >= 30) {
          template = templateMap.get('document_expiring_30_days');
        } else if (days >= 7) {
          template = templateMap.get('document_expiring_7_days');
        } else {
          template = templateMap.get('document_expired');
        }

        if (!template) {
          console.log(`  - No template found for ${days} days reminder`);
          continue;
        }

        // Format message
        const message = formatMessage(template.body_template, {
          contact_name: doc.contact_name,
          company_name: doc.company_name,
          document_type: formatDocumentType(doc.document_type),
          expiry_date: formatDate(doc.expiry_date),
          days_remaining: days,
          portal_url: `${PORTAL_URL}/portal`
        });

        // Send notification
        const phoneNumber = doc.whatsapp_number || doc.phone;
        if (!phoneNumber) {
          console.log(`  - No phone number for ${doc.company_name}`);
          results.failed++;
          continue;
        }

        try {
          const twilioMessage = await twilioClient.messages.create({
            from: WHATSAPP_FROM,
            to: formatWhatsAppNumber(phoneNumber),
            body: message
          });

          // Record the notification
          await supabase.from('notifications').insert({
            contractor_id: doc.contractor_id,
            template_id: template.id,
            channel: 'whatsapp',
            recipient_identifier: formatWhatsAppNumber(phoneNumber),
            message,
            status: 'sent',
            external_id: twilioMessage.sid,
            sent_at: new Date().toISOString(),
            metadata: {
              document_id: doc.id,
              days_warning: days
            }
          });

          console.log(`  - Sent to ${doc.company_name}`);
          results.sent++;
        } catch (error) {
          console.log(
            `  - Failed to send to ${doc.company_name}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );

          // Record the failed notification
          await supabase.from('notifications').insert({
            contractor_id: doc.contractor_id,
            template_id: template.id,
            channel: 'whatsapp',
            recipient_identifier: formatWhatsAppNumber(phoneNumber),
            message,
            status: 'failed',
            failure_reason:
              error instanceof Error ? error.message : 'Unknown error',
            metadata: {
              document_id: doc.id,
              days_warning: days
            }
          });

          results.failed++;
        }

        // Rate limiting - wait between messages
        await sleep(1000);
      }
    }

    // Summary
    console.log('\n========== Summary ==========');
    console.log(`Sent: ${results.sent}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Skipped: ${results.skipped}`);

    console.log('\nReminder job completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error in reminder job:', error);
    process.exit(1);
  }
}

// Helper functions
function formatMessage(
  template: string,
  variables: Record<string, unknown>
): string {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
  }
  return message;
}

function formatDocumentType(type: string): string {
  const mapping: Record<string, string> = {
    public_liability: 'Public Liability Insurance',
    employers_liability: "Employer's Liability Insurance",
    professional_indemnity: 'Professional Indemnity Insurance',
    gas_safe: 'Gas Safe Registration',
    niceic: 'NICEIC Certification',
    napit: 'NAPIT Certification',
    oftec: 'OFTEC Registration',
    cscs: 'CSCS Card'
  };
  return mapping[type] || type;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatWhatsAppNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return `whatsapp:+44${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('44')) {
    return `whatsapp:+${cleaned}`;
  }
  if (phone.startsWith('whatsapp:')) {
    return phone;
  }
  return `whatsapp:+${cleaned}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
