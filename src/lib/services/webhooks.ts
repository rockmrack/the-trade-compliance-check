/**
 * Webhook Service for External Integrations
 * UK Trade Compliance Engine
 */

import { createHash, createHmac } from 'crypto';

export type WebhookEvent =
  | 'contractor.created'
  | 'contractor.updated'
  | 'contractor.verified'
  | 'contractor.blocked'
  | 'document.uploaded'
  | 'document.verified'
  | 'document.rejected'
  | 'document.expired'
  | 'payment.blocked'
  | 'payment.approved'
  | 'compliance.changed';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  durationMs: number;
  error?: string;
}

/**
 * Generate a webhook signature for payload verification
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string
): string {
  const signaturePayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Verify a webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  try {
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parseInt(parts.t, 10);
    const providedSignature = parts.v1;

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }

    // Verify signature
    const expectedSignature = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    return providedSignature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Generate a secure webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${createHash('sha256')
    .update(Math.random().toString() + Date.now().toString())
    .digest('hex')
    .substring(0, 32)}`;
}

/**
 * Deliver a webhook to a URL
 */
export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();

  try {
    const payloadString = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = generateWebhookSignature(payloadString, secret, timestamp);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'User-Agent': 'TradeComplianceEngine-Webhook/1.0'
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    const durationMs = Date.now() - startTime;
    const responseBody = await response.text();

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody: responseBody.substring(0, 1000), // Limit stored response
      durationMs
    };
  } catch (error) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a webhook payload for contractor events
 */
export function createContractorPayload(
  event: WebhookEvent,
  contractor: {
    id: string;
    company_name: string;
    company_number?: string;
    verification_status: string;
    payment_status: string;
  }
): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data: {
      contractor: {
        id: contractor.id,
        companyName: contractor.company_name,
        companyNumber: contractor.company_number,
        verificationStatus: contractor.verification_status,
        paymentStatus: contractor.payment_status
      }
    }
  };
}

/**
 * Create a webhook payload for document events
 */
export function createDocumentPayload(
  event: WebhookEvent,
  document: {
    id: string;
    document_type: string;
    status: string;
    expiry_date: string;
    contractor_id: string;
  },
  contractor?: {
    company_name: string;
  }
): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data: {
      document: {
        id: document.id,
        documentType: document.document_type,
        status: document.status,
        expiryDate: document.expiry_date,
        contractorId: document.contractor_id
      },
      contractor: contractor ? {
        companyName: contractor.company_name
      } : undefined
    }
  };
}

/**
 * Create a webhook payload for payment events
 */
export function createPaymentPayload(
  event: WebhookEvent,
  invoice: {
    id: string;
    invoice_number: string;
    amount: number;
    status: string;
    contractor_id: string;
  },
  blockReason?: string
): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data: {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.amount,
        amountFormatted: `£${(invoice.amount / 100).toFixed(2)}`,
        status: invoice.status,
        contractorId: invoice.contractor_id,
        blockReason
      }
    }
  };
}

/**
 * Available webhook events with descriptions
 */
export const WEBHOOK_EVENTS: Record<WebhookEvent, string> = {
  'contractor.created': 'When a new contractor is added to the system',
  'contractor.updated': 'When contractor details are modified',
  'contractor.verified': 'When a contractor passes all compliance checks',
  'contractor.blocked': 'When a contractor is blocked due to compliance issues',
  'document.uploaded': 'When a new compliance document is uploaded',
  'document.verified': 'When a document passes verification',
  'document.rejected': 'When a document fails verification',
  'document.expired': 'When a document expires',
  'payment.blocked': 'When a payment is blocked due to compliance',
  'payment.approved': 'When a payment is approved after compliance check',
  'compliance.changed': 'When overall compliance status changes'
};
