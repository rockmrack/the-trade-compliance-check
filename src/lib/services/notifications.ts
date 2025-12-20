import Twilio from 'twilio';
import { createServiceClient } from '@/lib/supabase/server';
import type { NotificationChannel, NotificationStatus } from '@/lib/database.types';

// ============ CONFIGURATION ============

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// ============ TYPES ============

interface SendMessageOptions {
  contractorId: string;
  channel: NotificationChannel;
  recipientIdentifier: string;
  message: string;
  subject?: string;
  templateId?: string;
  scheduledFor?: Date;
  metadata?: Record<string, unknown>;
}

interface SendResult {
  success: boolean;
  notificationId: string;
  externalId?: string;
  error?: string;
}

interface TemplateVariables {
  contact_name?: string;
  company_name?: string;
  document_type?: string;
  expiry_date?: string;
  days_remaining?: number;
  portal_url?: string;
  block_reason?: string;
  [key: string]: unknown;
}

// ============ NOTIFICATION SERVICE ============

export class NotificationService {
  private portalUrl: string;

  constructor() {
    this.portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';
  }

  async sendWhatsApp(
    to: string,
    message: string,
    contractorId: string,
    templateId?: string
  ): Promise<SendResult> {
    const supabase = await createServiceClient();

    // Format the WhatsApp number
    const formattedTo = this.formatWhatsAppNumber(to);

    // Create notification record
    // @ts-ignore - Supabase type inference limitation
    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert({
        contractor_id: contractorId,
        template_id: templateId,
        channel: 'whatsapp',
        recipient_identifier: formattedTo,
        message,
        status: 'pending'
      } as any)
      .select()
      .single();

    if (dbError || !notification) {
      return {
        success: false,
        notificationId: '',
        error: 'Failed to create notification record'
      };
    }

    try {
      // Send via Twilio
      const twilioMessage = await twilioClient.messages.create({
        from: WHATSAPP_FROM,
        to: formattedTo,
        body: message
      });

      // Update notification with success
      // @ts-ignore - Supabase type inference limitation
      await (supabase
        .from('notifications') as any)
        .update({
          status: 'sent',
          external_id: twilioMessage.sid,
          sent_at: new Date().toISOString()
        })
        .eq('id', (notification as any).id);

      return {
        success: true,
        notificationId: (notification as any).id,
        externalId: twilioMessage.sid
      };
    } catch (error) {
      // Update notification with failure
      // @ts-ignore - Supabase type inference limitation
      await (supabase
        .from('notifications') as any)
        .update({
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown error',
          retry_count: (notification as any).retry_count + 1
        })
        .eq('id', (notification as any).id);

      return {
        success: false,
        notificationId: (notification as any).id,
        error: error instanceof Error ? error.message : 'Failed to send WhatsApp message'
      };
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    message: string,
    contractorId: string,
    templateId?: string
  ): Promise<SendResult> {
    const supabase = await createServiceClient();

    // Create notification record
    // @ts-ignore - Supabase type inference limitation
    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert({
        contractor_id: contractorId,
        template_id: templateId,
        channel: 'email',
        recipient_identifier: to,
        subject,
        message,
        status: 'pending'
      } as any)
      .select()
      .single();

    if (dbError || !notification) {
      return {
        success: false,
        notificationId: '',
        error: 'Failed to create notification record'
      };
    }

    try {
      // For now, using Twilio SendGrid or similar
      // This would be replaced with your email provider
      await this.sendEmailViaSendGrid(to, subject, message);

      // @ts-ignore - Supabase type inference limitation
      await (supabase
        .from('notifications') as any)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', (notification as any).id);

      return {
        success: true,
        notificationId: (notification as any).id
      };
    } catch (error) {
      // @ts-ignore - Supabase type inference limitation
      await (supabase
        .from('notifications') as any)
        .update({
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown error',
          retry_count: (notification as any).retry_count + 1
        })
        .eq('id', (notification as any).id);

      return {
        success: false,
        notificationId: (notification as any).id,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  async sendFromTemplate(
    templateName: string,
    contractorId: string,
    variables: TemplateVariables
  ): Promise<SendResult> {
    const supabase = await createServiceClient();

    // Fetch template
    const { data: template, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('name', templateName)
      .eq('is_active', true)
      .single();

    if (error || !template) {
      return {
        success: false,
        notificationId: '',
        error: 'Template not found'
      };
    }

    // Fetch contractor details if not provided
    if (!variables.contact_name || !variables.company_name) {
      const { data: contractor } = await supabase
        .from('contractors')
        .select('contact_name, company_name, email, phone, whatsapp_number')
        .eq('id', contractorId)
        .single();

      if (contractor) {
        variables.contact_name = variables.contact_name || (contractor as any).contact_name;
        variables.company_name = variables.company_name || (contractor as any).company_name;
      }
    }

    // Add portal URL
    variables.portal_url = `${this.portalUrl}/portal`;

    // Render template
    const message = this.renderTemplate((template as any).body_template, variables);
    const subject = (template as any).subject
      ? this.renderTemplate((template as any).subject, variables)
      : undefined;

    // Get recipient identifier
    const { data: contractor } = await supabase
      .from('contractors')
      .select('email, phone, whatsapp_number')
      .eq('id', contractorId)
      .single();

    if (!contractor) {
      return {
        success: false,
        notificationId: '',
        error: 'Contractor not found'
      };
    }

    // Send based on channel
    switch ((template as any).channel) {
      case 'whatsapp':
        const whatsappNumber = (contractor as any).whatsapp_number || (contractor as any).phone;
        if (!whatsappNumber) {
          return {
            success: false,
            notificationId: '',
            error: 'No WhatsApp number available'
          };
        }
        return this.sendWhatsApp(whatsappNumber, message, contractorId, (template as any).id);

      case 'email':
        if (!(contractor as any).email) {
          return {
            success: false,
            notificationId: '',
            error: 'No email address available'
          };
        }
        return this.sendEmail(
          (contractor as any).email,
          subject || 'Notification',
          message,
          contractorId,
          (template as any).id
        );

      case 'sms':
        return this.sendSMS((contractor as any).phone, message, contractorId, (template as any).id);

      default:
        return {
          success: false,
          notificationId: '',
          error: 'Unsupported notification channel'
        };
    }
  }

  async sendSMS(
    to: string,
    message: string,
    contractorId: string,
    templateId?: string
  ): Promise<SendResult> {
    const supabase = await createServiceClient();

    const formattedTo = this.formatPhoneNumber(to);

    // @ts-ignore - Supabase type inference limitation
    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert({
        contractor_id: contractorId,
        template_id: templateId,
        channel: 'sms',
        recipient_identifier: formattedTo,
        message,
        status: 'pending'
      } as any)
      .select()
      .single();

    if (dbError || !notification) {
      return {
        success: false,
        notificationId: '',
        error: 'Failed to create notification record'
      };
    }

    try {
      const twilioMessage = await twilioClient.messages.create({
        from: process.env.TWILIO_SMS_NUMBER!,
        to: formattedTo,
        body: message
      });

      // @ts-ignore - Supabase type inference limitation
      await (supabase
        .from('notifications') as any)
        .update({
          status: 'sent',
          external_id: twilioMessage.sid,
          sent_at: new Date().toISOString()
        })
        .eq('id', (notification as any).id);

      return {
        success: true,
        notificationId: (notification as any).id,
        externalId: twilioMessage.sid
      };
    } catch (error) {
      // @ts-ignore - Supabase type inference limitation
      await (supabase
        .from('notifications') as any)
        .update({
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown error',
          retry_count: (notification as any).retry_count + 1
        })
        .eq('id', (notification as any).id);

      return {
        success: false,
        notificationId: (notification as any).id,
        error: error instanceof Error ? error.message : 'Failed to send SMS'
      };
    }
  }

  async retryFailedNotifications(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const supabase = await createServiceClient();

    // Get failed notifications that haven't exceeded max retries
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!notifications || notifications.length === 0) {
      return { processed: 0, successful: 0, failed: 0 };
    }

    let successful = 0;
    let failed = 0;

    for (const notification of notifications) {
      let result: SendResult;

      switch ((notification as any).channel) {
        case 'whatsapp':
          result = await this.sendWhatsApp(
            (notification as any).recipient_identifier,
            (notification as any).message,
            (notification as any).contractor_id,
            (notification as any).template_id || undefined
          );
          break;
        case 'email':
          result = await this.sendEmail(
            (notification as any).recipient_identifier,
            (notification as any).subject || 'Notification',
            (notification as any).message,
            (notification as any).contractor_id,
            (notification as any).template_id || undefined
          );
          break;
        case 'sms':
          result = await this.sendSMS(
            (notification as any).recipient_identifier,
            (notification as any).message,
            (notification as any).contractor_id,
            (notification as any).template_id || undefined
          );
          break;
        default:
          continue;
      }

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      processed: notifications.length,
      successful,
      failed
    };
  }

  // Helper methods
  private formatWhatsAppNumber(phone: string): string {
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

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      return `+44${cleaned.slice(1)}`;
    }
    if (cleaned.startsWith('44')) {
      return `+${cleaned}`;
    }
    return `+${cleaned}`;
  }

  private renderTemplate(
    template: string,
    variables: TemplateVariables
  ): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(placeholder, String(value ?? ''));
    }
    return rendered;
  }

  private async sendEmailViaSendGrid(
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    // Implementation would use SendGrid or another email provider
    // This is a placeholder that logs the email
    console.log('Sending email:', { to, subject, body });

    // In production, use:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({ to, from: 'noreply@yourdomain.com', subject, text: body });
  }
}

// ============ EXPIRY REMINDER SERVICE ============

export async function sendExpiryReminders(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const supabase = await createServiceClient();
  const notificationService = new NotificationService();

  const results = { sent: 0, failed: 0, skipped: 0 };

  // Get documents expiring within warning periods
  const warningDays = [30, 14, 7, 3, 1, 0, -1];

  for (const days of warningDays) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const dateStr = targetDate.toISOString().split('T')[0];

    const { data: expiringDocs } = await supabase
      .from('expiring_documents_view')
      .select('*')
      .eq('expiry_date', dateStr || '');

    if (!expiringDocs) continue;

    for (const doc of expiringDocs) {
      // Check if we've already sent a notification for this document/period
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('contractor_id', (doc as any).contractor_id)
        .eq('metadata->document_id', (doc as any).id)
        .eq('metadata->days_warning', days)
        .single();

      if (existingNotification) {
        results.skipped++;
        continue;
      }

      // Determine template based on days
      let templateName: string;
      if (days >= 30) {
        templateName = 'whatsapp_expiry_30_days';
      } else if (days >= 7) {
        templateName = 'whatsapp_expiry_7_days';
      } else {
        templateName = 'whatsapp_expired';
      }

      const result = await notificationService.sendFromTemplate(
        templateName,
        (doc as any).contractor_id,
        {
          contact_name: (doc as any).contact_name,
          company_name: (doc as any).company_name,
          document_type: formatDocumentTypeForMessage((doc as any).document_type),
          expiry_date: formatDateForMessage((doc as any).expiry_date),
          days_remaining: days
        }
      );

      if (result.success) {
        // Update notification metadata
        // @ts-ignore - Supabase type inference limitation
        await (supabase
          .from('notifications') as any)
          .update({
            metadata: {
              document_id: (doc as any).id,
              days_warning: days
            }
          })
          .eq('id', result.notificationId);

        results.sent++;
      } else {
        results.failed++;
      }
    }
  }

  return results;
}

// ============ HELPER FUNCTIONS ============

function formatDocumentTypeForMessage(type: string): string {
  const mapping: Record<string, string> = {
    public_liability: 'Public Liability Insurance',
    employers_liability: "Employer's Liability Insurance",
    professional_indemnity: 'Professional Indemnity Insurance',
    gas_safe: 'Gas Safe Registration',
    niceic: 'NICEIC Certification',
    napit: 'NAPIT Certification',
    oftec: 'OFTEC Registration',
    cscs: 'CSCS Card',
    building_regulations: 'Building Regulations Approval',
    other_certification: 'Certification'
  };
  return mapping[type] || type;
}

function formatDateForMessage(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Export singleton instance
export const notificationService = new NotificationService();
