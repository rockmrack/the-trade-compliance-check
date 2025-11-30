import { z } from 'zod';

// ============ COMMON VALIDATORS ============

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(5)
  .max(255);

export const phoneSchema = z
  .string()
  .regex(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, {
    message: 'Invalid phone number format'
  });

export const ukPostcodeSchema = z
  .string()
  .regex(
    /^([A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}|GIR ?0A{2})$/i,
    'Invalid UK postcode'
  )
  .transform((val) => val.toUpperCase().replace(/\s/g, ' '));

export const companyNumberSchema = z
  .string()
  .regex(/^\d{8}$|^[A-Z]{2}\d{6}$/, 'Invalid company registration number')
  .transform((val) => val.toUpperCase());

export const vatNumberSchema = z
  .string()
  .regex(/^GB\d{9}$|^GB\d{12}$|^GBGD\d{3}$|^GBHA\d{3}$/, 'Invalid VAT number')
  .transform((val) => val.toUpperCase());

export const uuidSchema = z.string().uuid('Invalid ID format');

export const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format'
});

export const currencyAmountSchema = z
  .number()
  .int()
  .min(0, 'Amount must be positive')
  .max(999999999999, 'Amount too large');

// ============ ENUM SCHEMAS ============

export const tradeTypeSchema = z.enum([
  'electrician',
  'plumber',
  'gas_engineer',
  'roofer',
  'carpenter',
  'builder',
  'plasterer',
  'painter_decorator',
  'tiler',
  'landscaper',
  'hvac',
  'general_contractor',
  'other'
]);

export const documentTypeSchema = z.enum([
  'public_liability',
  'employers_liability',
  'professional_indemnity',
  'gas_safe',
  'niceic',
  'napit',
  'oftec',
  'cscs',
  'building_regulations',
  'other_certification'
]);

export const complianceStatusSchema = z.enum([
  'valid',
  'expiring_soon',
  'expired',
  'pending_review',
  'rejected',
  'fraud_suspected'
]);

export const verificationStatusSchema = z.enum([
  'verified',
  'partially_verified',
  'unverified',
  'suspended',
  'blocked'
]);

export const paymentStatusSchema = z.enum([
  'allowed',
  'blocked',
  'on_hold',
  'pending_review'
]);

export const userRoleSchema = z.enum([
  'super_admin',
  'admin',
  'finance',
  'operations',
  'viewer'
]);

// ============ ADDRESS SCHEMA ============

export const addressSchema = z.object({
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(100),
  county: z.string().max(100).optional(),
  postcode: ukPostcodeSchema,
  country: z.string().default('United Kingdom')
});

// ============ CONTRACTOR SCHEMAS ============

export const createContractorSchema = z.object({
  companyName: z.string().min(2).max(255),
  tradingName: z.string().max(255).optional(),
  companyNumber: companyNumberSchema.optional(),
  vatNumber: vatNumberSchema.optional(),
  contactName: z.string().min(2).max(255),
  email: emailSchema,
  phone: phoneSchema,
  whatsappNumber: phoneSchema.optional(),
  tradeTypes: z.array(tradeTypeSchema).min(1, 'Select at least one trade type'),
  addressLine1: z.string().min(1).max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  addressCity: z.string().max(100).optional(),
  addressCounty: z.string().max(100).optional(),
  addressPostcode: ukPostcodeSchema.optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional()
});

export const updateContractorSchema = createContractorSchema.partial().extend({
  id: uuidSchema
});

export const contractorFiltersSchema = z.object({
  search: z.string().max(255).optional(),
  tradeTypes: z.array(tradeTypeSchema).optional(),
  verificationStatus: z.array(verificationStatusSchema).optional(),
  paymentStatus: z.array(paymentStatusSchema).optional(),
  hasExpiredDocs: z.boolean().optional(),
  hasExpiringDocs: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  riskScoreMin: z.number().min(0).max(100).optional(),
  riskScoreMax: z.number().min(0).max(100).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum([
      'companyName',
      'createdAt',
      'lastVerifiedAt',
      'riskScore',
      'verificationStatus'
    ])
    .default('companyName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

// ============ DOCUMENT SCHEMAS ============

export const createDocumentSchema = z.object({
  contractorId: uuidSchema,
  documentType: documentTypeSchema,
  providerName: z.string().min(1).max(255),
  policyNumber: z.string().max(100).optional(),
  registrationNumber: z.string().max(100).optional(),
  coverageAmount: currencyAmountSchema.optional(),
  excessAmount: currencyAmountSchema.optional(),
  startDate: dateSchema.optional(),
  expiryDate: dateSchema,
  documentPath: z.string().min(1),
  documentUrl: z.string().url()
});

export const updateDocumentSchema = z.object({
  id: uuidSchema,
  status: complianceStatusSchema.optional(),
  providerName: z.string().min(1).max(255).optional(),
  policyNumber: z.string().max(100).optional(),
  coverageAmount: currencyAmountSchema.optional(),
  expiryDate: dateSchema.optional(),
  rejectionReason: z.string().max(1000).optional(),
  manuallyVerified: z.boolean().optional()
});

export const documentFiltersSchema = z.object({
  contractorId: uuidSchema.optional(),
  documentTypes: z.array(documentTypeSchema).optional(),
  status: z.array(complianceStatusSchema).optional(),
  expiringWithinDays: z.number().int().min(1).max(365).optional(),
  expired: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['expiryDate', 'createdAt', 'documentType', 'status'])
    .default('expiryDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

// ============ INVOICE SCHEMAS ============

export const createInvoiceSchema = z.object({
  contractorId: uuidSchema,
  invoiceNumber: z.string().min(1).max(50),
  amount: currencyAmountSchema,
  currency: z.string().length(3).default('GBP'),
  description: z.string().max(1000).optional(),
  projectReference: z.string().max(100).optional(),
  dueDate: dateSchema
});

export const invoiceFiltersSchema = z.object({
  contractorId: uuidSchema.optional(),
  status: z.array(z.enum(['pending', 'approved', 'blocked', 'paid', 'cancelled'])).optional(),
  dueDateFrom: dateSchema.optional(),
  dueDateTo: dateSchema.optional(),
  amountMin: currencyAmountSchema.optional(),
  amountMax: currencyAmountSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['dueDate', 'amount', 'createdAt', 'status'])
    .default('dueDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

// ============ PUBLIC VERIFICATION SCHEMA ============

export const publicVerifySchema = z.object({
  query: z
    .string()
    .min(2, 'Search query too short')
    .max(255)
    .transform((val) => val.trim()),
  type: z.enum(['company_name', 'company_number', 'slug']).default('company_name')
});

// ============ NOTIFICATION SCHEMAS ============

export const sendNotificationSchema = z.object({
  contractorId: uuidSchema,
  templateId: uuidSchema.optional(),
  channel: z.enum(['whatsapp', 'email', 'sms']),
  message: z.string().min(1).max(4096).optional(),
  scheduledFor: dateSchema.optional()
});

// Type exports
export type CreateContractorInput = z.infer<typeof createContractorSchema>;
export type UpdateContractorInput = z.infer<typeof updateContractorSchema>;
export type ContractorFiltersInput = z.infer<typeof contractorFiltersSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentFiltersInput = z.infer<typeof documentFiltersSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceFiltersInput = z.infer<typeof invoiceFiltersSchema>;
export type PublicVerifyInput = z.infer<typeof publicVerifySchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
