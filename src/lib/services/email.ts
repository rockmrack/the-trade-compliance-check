/**
 * Email Service using SendGrid
 * UK-focused Trade Compliance Engine
 */

interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  attachments?: Array<{
    content: string; // Base64 encoded
    filename: string;
    type: string;
    disposition?: 'attachment' | 'inline';
  }>;
}

interface SendGridResponse {
  success: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
}

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'compliance@tradecomplianceengine.co.uk';
const DEFAULT_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Trade Compliance Engine';

/**
 * Send an email via SendGrid API
 */
export async function sendEmail(options: EmailOptions): Promise<SendGridResponse> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.warn('SendGrid API key not configured - email not sent');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const payload = {
    personalizations: [
      {
        to: [
          {
            email: options.to,
            name: options.toName
          }
        ],
        dynamic_template_data: options.templateData
      }
    ],
    from: {
      email: options.from || DEFAULT_FROM_EMAIL,
      name: options.fromName || DEFAULT_FROM_NAME
    },
    reply_to: options.replyTo
      ? { email: options.replyTo }
      : undefined,
    subject: options.templateId ? undefined : options.subject,
    content: options.templateId
      ? undefined
      : [
          {
            type: 'text/plain',
            value: options.text || stripHtml(options.html)
          },
          {
            type: 'text/html',
            value: options.html
          }
        ],
    template_id: options.templateId,
    attachments: options.attachments
  };

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 202) {
      const messageId = response.headers.get('X-Message-Id') || undefined;
      return { success: true, messageId };
    }

    const errorBody = await response.text();
    console.error('SendGrid error:', response.status, errorBody);
    return {
      success: false,
      error: `SendGrid API error: ${response.status}`
    };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send document expiry reminder
 */
export async function sendExpiryReminder(
  contractor: {
    email: string;
    contactName: string;
    companyName: string;
  },
  document: {
    type: string;
    expiryDate: string;
  },
  daysUntilExpiry: number,
  portalUrl: string
): Promise<SendGridResponse> {
  const urgency = daysUntilExpiry <= 7 ? 'URGENT: ' : '';
  const subject = `${urgency}Your ${formatDocumentType(document.type)} expires in ${daysUntilExpiry} days`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #059669 0%, #0284c7 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Trade Compliance Engine</h1>
      </div>
      <div style="padding: 30px; background: #f8fafc;">
        <p style="font-size: 16px; color: #334155;">Dear ${contractor.contactName},</p>

        <p style="font-size: 16px; color: #334155;">
          This is a reminder that your <strong>${formatDocumentType(document.type)}</strong> for
          <strong>${contractor.companyName}</strong> will expire on
          <strong>${formatDate(document.expiryDate)}</strong>.
        </p>

        ${daysUntilExpiry <= 7 ? `
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
          <strong style="color: #92400e;">Urgent Action Required</strong>
          <p style="color: #92400e; margin: 5px 0 0;">
            Your document expires in ${daysUntilExpiry} days. Without valid documentation,
            we will be unable to process payments to your company.
          </p>
        </div>
        ` : ''}

        <p style="font-size: 16px; color: #334155;">
          To ensure continued partnership and uninterrupted payments, please upload your
          renewed certificate to our compliance portal.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalUrl}"
             style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Upload Your Document
          </a>
        </div>

        <p style="font-size: 14px; color: #64748b;">
          If you have already renewed your ${formatDocumentType(document.type)}, please upload
          the new certificate as soon as possible to update our records.
        </p>
      </div>
      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8; font-size: 12px;">
        <p>Trade Compliance Engine</p>
        <p>Ensuring contractor compliance across the UK</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: contractor.email,
    toName: contractor.contactName,
    subject,
    html
  });
}

/**
 * Send payment blocked notification
 */
export async function sendPaymentBlockedNotification(
  contractor: {
    email: string;
    contactName: string;
    companyName: string;
  },
  blockReason: string,
  portalUrl: string
): Promise<SendGridResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Payment Alert</h1>
      </div>
      <div style="padding: 30px; background: #f8fafc;">
        <p style="font-size: 16px; color: #334155;">Dear ${contractor.contactName},</p>

        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
          <strong style="color: #991b1b;">Payments Blocked</strong>
          <p style="color: #991b1b; margin: 5px 0 0;">
            Payments to ${contractor.companyName} have been temporarily blocked.
          </p>
        </div>

        <p style="font-size: 16px; color: #334155;">
          <strong>Reason:</strong> ${blockReason}
        </p>

        <p style="font-size: 16px; color: #334155;">
          To resolve this issue and restore payment processing, please log into our
          compliance portal and address the outstanding compliance requirements.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalUrl}"
             style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Resolve Compliance Issues
          </a>
        </div>

        <p style="font-size: 14px; color: #64748b;">
          If you believe this is an error or have questions, please contact your
          principal contractor directly.
        </p>
      </div>
      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8; font-size: 12px;">
        <p>Trade Compliance Engine</p>
        <p>Ensuring contractor compliance across the UK</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: contractor.email,
    toName: contractor.contactName,
    subject: `URGENT: Payments Blocked - ${contractor.companyName}`,
    html
  });
}

/**
 * Send document verification result
 */
export async function sendVerificationResult(
  contractor: {
    email: string;
    contactName: string;
    companyName: string;
  },
  document: {
    type: string;
    status: 'valid' | 'rejected' | 'fraud_suspected';
    rejectionReason?: string;
  },
  portalUrl: string
): Promise<SendGridResponse> {
  const isSuccess = document.status === 'valid';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${isSuccess ? '#059669' : '#dc2626'}; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Document ${isSuccess ? 'Verified' : 'Not Verified'}</h1>
      </div>
      <div style="padding: 30px; background: #f8fafc;">
        <p style="font-size: 16px; color: #334155;">Dear ${contractor.contactName},</p>

        ${isSuccess ? `
        <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
          <strong style="color: #065f46;">Document Verified Successfully</strong>
          <p style="color: #065f46; margin: 5px 0 0;">
            Your ${formatDocumentType(document.type)} has been verified and your compliance status updated.
          </p>
        </div>
        ` : `
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
          <strong style="color: #991b1b;">Document Not Verified</strong>
          <p style="color: #991b1b; margin: 5px 0 0;">
            Your ${formatDocumentType(document.type)} could not be verified.
            ${document.rejectionReason ? `<br><br>Reason: ${document.rejectionReason}` : ''}
          </p>
        </div>
        `}

        ${!isSuccess ? `
        <p style="font-size: 16px; color: #334155;">
          Please upload a clear, valid document to resolve this issue. Ensure that:
        </p>
        <ul style="color: #334155;">
          <li>The document is clearly legible</li>
          <li>All pages are included</li>
          <li>The policy/certificate is current and not expired</li>
          <li>Coverage amounts meet minimum requirements (£1m for Public Liability)</li>
        </ul>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalUrl}"
             style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            View Your Compliance Portal
          </a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8; font-size: 12px;">
        <p>Trade Compliance Engine</p>
        <p>Ensuring contractor compliance across the UK</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: contractor.email,
    toName: contractor.contactName,
    subject: `Document ${isSuccess ? 'Verified' : 'Requires Attention'}: ${formatDocumentType(document.type)}`,
    html
  });
}

/**
 * Send welcome email to new contractor
 */
export async function sendWelcomeEmail(
  contractor: {
    email: string;
    contactName: string;
    companyName: string;
  },
  portalUrl: string
): Promise<SendGridResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #059669 0%, #0284c7 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Welcome to Trade Compliance Engine</h1>
      </div>
      <div style="padding: 30px; background: #f8fafc;">
        <p style="font-size: 16px; color: #334155;">Dear ${contractor.contactName},</p>

        <p style="font-size: 16px; color: #334155;">
          Welcome! <strong>${contractor.companyName}</strong> has been registered on our
          Trade Compliance Engine platform.
        </p>

        <p style="font-size: 16px; color: #334155;">
          To complete your registration and enable payments, please upload the following
          UK compliance documents:
        </p>

        <ul style="color: #334155; line-height: 1.8;">
          <li><strong>Public Liability Insurance</strong> (minimum £1,000,000 cover) - Required</li>
          <li><strong>Employer's Liability Insurance</strong> (minimum £5,000,000 cover) - Required if you employ staff</li>
          <li><strong>Trade Certifications</strong> (Gas Safe, NICEIC, NAPIT, etc.) - As applicable</li>
          <li><strong>CSCS Card</strong> - For construction site work</li>
        </ul>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalUrl}"
             style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Access Your Portal
          </a>
        </div>

        <p style="font-size: 14px; color: #64748b;">
          Our AI-powered system will verify your documents automatically. Most verifications
          are completed within minutes. If you have any questions, please contact your
          principal contractor.
        </p>
      </div>
      <div style="padding: 20px; text-align: center; background: #1e293b; color: #94a3b8; font-size: 12px;">
        <p>Trade Compliance Engine</p>
        <p>Ensuring contractor compliance across the UK</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: contractor.email,
    toName: contractor.contactName,
    subject: `Welcome to Trade Compliance Engine - ${contractor.companyName}`,
    html
  });
}

// Helper functions
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDocumentType(type: string): string {
  const types: Record<string, string> = {
    public_liability: 'Public Liability Insurance',
    employers_liability: "Employer's Liability Insurance",
    professional_indemnity: 'Professional Indemnity Insurance',
    gas_safe: 'Gas Safe Registration',
    niceic: 'NICEIC Certificate',
    napit: 'NAPIT Certificate',
    oftec: 'OFTEC Registration',
    cscs: 'CSCS Card',
    contractors_all_risk: "Contractor's All Risk Insurance",
    waste_carrier: 'Waste Carrier Licence'
  };
  return types[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}
