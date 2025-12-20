// ===========================================
// TRADE COMPLIANCE ENGINE - TYPE DEFINITIONS
// ===========================================

// ============ ENUMS ============

export const TradeTypes = {
  ELECTRICIAN: 'electrician',
  PLUMBER: 'plumber',
  GAS_ENGINEER: 'gas_engineer',
  ROOFER: 'roofer',
  CARPENTER: 'carpenter',
  BUILDER: 'builder',
  PLASTERER: 'plasterer',
  PAINTER_DECORATOR: 'painter_decorator',
  TILER: 'tiler',
  LANDSCAPER: 'landscaper',
  HVAC: 'hvac',
  GENERAL_CONTRACTOR: 'general_contractor',
  OTHER: 'other'
} as const;

export type TradeType = (typeof TradeTypes)[keyof typeof TradeTypes];

export const DocumentTypes = {
  PUBLIC_LIABILITY: 'public_liability',
  EMPLOYERS_LIABILITY: 'employers_liability',
  PROFESSIONAL_INDEMNITY: 'professional_indemnity',
  GAS_SAFE: 'gas_safe',
  NICEIC: 'niceic',
  NAPIT: 'napit',
  OFTEC: 'oftec',
  CONSTRUCTION_SKILLS: 'cscs',
  BUILDING_REGULATIONS: 'building_regulations',
  OTHER_CERTIFICATION: 'other_certification'
} as const;

export type DocumentType = (typeof DocumentTypes)[keyof typeof DocumentTypes];

export const ComplianceStatuses = {
  VALID: 'valid',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  PENDING_REVIEW: 'pending_review',
  REJECTED: 'rejected',
  FRAUD_SUSPECTED: 'fraud_suspected'
} as const;

export type ComplianceStatus =
  (typeof ComplianceStatuses)[keyof typeof ComplianceStatuses];

export const VerificationStatuses = {
  VERIFIED: 'verified',
  PARTIALLY_VERIFIED: 'partially_verified',
  UNVERIFIED: 'unverified',
  SUSPENDED: 'suspended',
  BLOCKED: 'blocked'
} as const;

export type VerificationStatus =
  (typeof VerificationStatuses)[keyof typeof VerificationStatuses];

export const PaymentStatuses = {
  ALLOWED: 'allowed',
  BLOCKED: 'blocked',
  ON_HOLD: 'on_hold',
  PENDING_REVIEW: 'pending_review'
} as const;

export type PaymentStatus =
  (typeof PaymentStatuses)[keyof typeof PaymentStatuses];

export const UserRoles = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  FINANCE: 'finance',
  OPERATIONS: 'operations',
  VIEWER: 'viewer'
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export const NotificationChannels = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  SMS: 'sms',
  IN_APP: 'in_app'
} as const;

export type NotificationChannel =
  (typeof NotificationChannels)[keyof typeof NotificationChannels];

// ============ CORE ENTITIES ============

export interface Contractor {
  id: string;
  companyName: string;
  tradingName?: string;
  companyNumber?: string;
  vatNumber?: string;
  contactName: string;
  email: string;
  phone: string;
  whatsappNumber?: string;
  tradeTypes: TradeType[];
  address: Address;
  verificationStatus: VerificationStatus;
  paymentStatus: PaymentStatus;
  publicProfileSlug: string;
  riskScore: number;
  notes?: string;
  tags: string[];
  isActive: boolean;
  onboardedAt: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  line1: string;
  line2?: string | undefined;
  city: string;
  county?: string | undefined;
  postcode: string;
  country: string;
}

export interface ComplianceDocument {
  id: string;
  contractorId: string;
  documentType: DocumentType;
  providerName: string;
  policyNumber?: string;
  registrationNumber?: string;
  coverageAmount?: number;
  excessAmount?: number;
  startDate: string;
  expiryDate: string;
  documentUrl: string;
  thumbnailUrl?: string;
  status: ComplianceStatus;
  verificationScore: number;
  aiAnalysis?: AIDocumentAnalysis;
  manuallyVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AIDocumentAnalysis {
  confidence: number;
  extractedData: ExtractedDocumentData;
  fraudIndicators: FraudIndicator[];
  qualityScore: number;
  processingTimeMs: number;
  modelVersion: string;
  rawResponse?: string;
}

export interface ExtractedDocumentData {
  policyNumber?: string;
  providerName?: string;
  insuredName?: string;
  insuredAddress?: string;
  coverageAmount?: number;
  excessAmount?: number;
  startDate?: string;
  expiryDate?: string;
  coverageTypes?: string[];
  additionalInsured?: string[];
  endorsements?: string[];
}

export interface FraudIndicator {
  type: FraudIndicatorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
}

export type FraudIndicatorType =
  | 'font_mismatch'
  | 'date_manipulation'
  | 'logo_inconsistency'
  | 'metadata_anomaly'
  | 'text_overlay'
  | 'resolution_mismatch'
  | 'known_fake_template'
  | 'invalid_policy_format'
  | 'provider_mismatch';

export interface VerificationLog {
  id: string;
  contractorId: string;
  documentId?: string;
  checkType: VerificationCheckType;
  status: 'success' | 'failure' | 'error' | 'pending';
  result: VerificationResult;
  performedBy?: string;
  performedAt: string;
  durationMs: number;
  metadata: Record<string, unknown>;
}

export type VerificationCheckType =
  | 'companies_house_api'
  | 'ai_document_scan'
  | 'gas_safe_registry'
  | 'niceic_registry'
  | 'manual_verification'
  | 'automated_expiry_check'
  | 'fraud_detection';

export interface VerificationResult {
  passed: boolean;
  message: string;
  details: Record<string, unknown>;
  warnings?: string[];
  recommendations?: string[];
}

// ============ COMPANIES HOUSE ============

export interface CompaniesHouseData {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  companyType: string;
  dateOfCreation: string;
  dateOfCessation?: string | undefined;
  registeredOfficeAddress: Address;
  sicCodes: string[];
  hasCharges: boolean;
  hasInsolvencyHistory: boolean;
  canFile: boolean;
  lastAccountsDate?: string | undefined;
  nextAccountsDue?: string | undefined;
  lastConfirmationStatementDate?: string | undefined;
  officers: CompanyOfficer[];
  filingHistory: FilingHistoryItem[];
  fetchedAt: string;
}

export interface CompanyOfficer {
  name: string;
  role: string;
  appointedOn: string;
  resignedOn?: string | undefined;
  nationality?: string | undefined;
  occupation?: string | undefined;
  address: Partial<Address>;
}

export interface FilingHistoryItem {
  category: string;
  date: string;
  description: string;
  type: string;
}

// ============ NOTIFICATIONS ============

export interface Notification {
  id: string;
  contractorId: string;
  channel: NotificationChannel;
  templateId: string;
  recipientIdentifier: string;
  subject?: string;
  message: string;
  status: NotificationStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failureReason?: string;
  retryCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  triggerType: NotificationTriggerType;
  subject?: string;
  bodyTemplate: string;
  variables: string[];
  isActive: boolean;
}

export type NotificationTriggerType =
  | 'document_expiring_30_days'
  | 'document_expiring_14_days'
  | 'document_expiring_7_days'
  | 'document_expiring_3_days'
  | 'document_expiring_1_day'
  | 'document_expired'
  | 'payment_blocked'
  | 'verification_complete'
  | 'document_rejected'
  | 'welcome'
  | 'manual';

// ============ INVOICES & PAYMENTS ============

export interface Invoice {
  id: string;
  contractorId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  description: string;
  projectReference?: string;
  dueDate: string;
  status: InvoiceStatus;
  paymentBlockReason?: string;
  complianceCheckAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus =
  | 'pending'
  | 'approved'
  | 'blocked'
  | 'paid'
  | 'cancelled';

export interface PaymentRun {
  id: string;
  runDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalInvoices: number;
  approvedInvoices: number;
  blockedInvoices: number;
  totalAmount: number;
  approvedAmount: number;
  blockedAmount: number;
  processedBy: string;
  completedAt?: string;
  createdAt: string;
}

// ============ AUDIT & ACTIVITY ============

export interface AuditLog {
  id: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'verify'
  | 'approve'
  | 'reject'
  | 'block'
  | 'unblock'
  | 'export'
  | 'login'
  | 'logout';

// ============ API RESPONSES ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ============ PUBLIC VERIFICATION ============

export interface PublicVerificationResult {
  found: boolean;
  contractor?: PublicContractorProfile;
  companiesHouse?: PublicCompaniesHouseData;
  verificationStatus: VerificationStatus;
  overallScore: number;
  badges: VerificationBadge[];
  lastVerifiedAt?: string;
  disclaimer: string;
}

export interface PublicContractorProfile {
  companyName: string;
  tradingName?: string;
  tradeTypes: TradeType[];
  verificationStatus: VerificationStatus;
  documents: PublicDocumentSummary[];
  certifications: string[];
  memberSince: string;
}

export interface PublicDocumentSummary {
  type: DocumentType;
  status: ComplianceStatus;
  coverageAmount?: number;
  expiryDate: string;
  providerName: string;
}

export interface PublicCompaniesHouseData {
  companyName: string;
  companyNumber: string;
  status: string;
  incorporatedDate: string;
  registeredAddress: string;
  isActive: boolean;
}

export interface VerificationBadge {
  type: BadgeType;
  label: string;
  description: string;
  earnedAt: string;
}

export type BadgeType =
  | 'verified_partner'
  | 'fully_compliant'
  | 'insurance_verified'
  | 'companies_house_verified'
  | 'gas_safe_registered'
  | 'niceic_approved'
  | 'long_standing_member';

// ============ DASHBOARD STATS ============

export interface DashboardStats {
  totalContractors: number;
  verifiedContractors: number;
  expiringDocuments: number;
  expiredDocuments: number;
  pendingVerifications: number;
  blockedPayments: number;
  complianceRate: number;
  averageRiskScore: number;
  recentActivity: ActivityItem[];
  expiryCalendar: ExpiryCalendarItem[];
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  contractorName?: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
}

export interface ExpiryCalendarItem {
  date: string;
  count: number;
  documents: Array<{
    id: string;
    contractorName: string;
    documentType: DocumentType;
    daysUntilExpiry: number;
  }>;
}

// ============ FILTERS & SEARCH ============

export interface ContractorFilters {
  search?: string;
  tradeTypes?: TradeType[];
  verificationStatus?: VerificationStatus[];
  paymentStatus?: PaymentStatus[];
  hasExpiredDocs?: boolean;
  hasExpiringDocs?: boolean;
  tags?: string[];
  riskScoreMin?: number;
  riskScoreMax?: number;
  sortBy?: ContractorSortField;
  sortOrder?: 'asc' | 'desc';
}

export type ContractorSortField =
  | 'companyName'
  | 'createdAt'
  | 'lastVerifiedAt'
  | 'riskScore'
  | 'verificationStatus';

export interface DocumentFilters {
  contractorId?: string;
  documentTypes?: DocumentType[];
  status?: ComplianceStatus[];
  expiringWithinDays?: number;
  expired?: boolean;
  sortBy?: DocumentSortField;
  sortOrder?: 'asc' | 'desc';
}

export type DocumentSortField =
  | 'expiryDate'
  | 'createdAt'
  | 'documentType'
  | 'status';
