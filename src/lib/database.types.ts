// ===========================================
// SUPABASE DATABASE TYPE DEFINITIONS
// Auto-generated types extended with custom types
// ===========================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          phone: string | null;
          is_active: boolean;
          last_login_at: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      contractors: {
        Row: {
          id: string;
          company_name: string;
          trading_name: string | null;
          company_number: string | null;
          vat_number: string | null;
          contact_name: string;
          email: string;
          phone: string;
          whatsapp_number: string | null;
          trade_types: TradeType[];
          address_line1: string | null;
          address_line2: string | null;
          address_city: string | null;
          address_county: string | null;
          address_postcode: string | null;
          address_country: string;
          verification_status: VerificationStatus;
          payment_status: PaymentStatus;
          public_profile_slug: string | null;
          risk_score: number;
          notes: string | null;
          tags: string[];
          is_active: boolean;
          onboarded_at: string | null;
          last_verified_at: string | null;
          companies_house_data: Json | null;
          companies_house_fetched_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_name: string;
          trading_name?: string | null;
          company_number?: string | null;
          vat_number?: string | null;
          contact_name: string;
          email: string;
          phone: string;
          whatsapp_number?: string | null;
          trade_types?: TradeType[];
          address_line1?: string | null;
          address_line2?: string | null;
          address_city?: string | null;
          address_county?: string | null;
          address_postcode?: string | null;
          address_country?: string;
          verification_status?: VerificationStatus;
          payment_status?: PaymentStatus;
          public_profile_slug?: string | null;
          risk_score?: number;
          notes?: string | null;
          tags?: string[];
          is_active?: boolean;
          onboarded_at?: string | null;
          last_verified_at?: string | null;
          companies_house_data?: Json | null;
          companies_house_fetched_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          company_name?: string;
          trading_name?: string | null;
          company_number?: string | null;
          vat_number?: string | null;
          contact_name?: string;
          email?: string;
          phone?: string;
          whatsapp_number?: string | null;
          trade_types?: TradeType[];
          address_line1?: string | null;
          address_line2?: string | null;
          address_city?: string | null;
          address_county?: string | null;
          address_postcode?: string | null;
          address_country?: string;
          verification_status?: VerificationStatus;
          payment_status?: PaymentStatus;
          public_profile_slug?: string | null;
          risk_score?: number;
          notes?: string | null;
          tags?: string[];
          is_active?: boolean;
          onboarded_at?: string | null;
          last_verified_at?: string | null;
          companies_house_data?: Json | null;
          companies_house_fetched_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      compliance_documents: {
        Row: {
          id: string;
          contractor_id: string;
          document_type: DocumentType;
          provider_name: string;
          policy_number: string | null;
          registration_number: string | null;
          coverage_amount: number | null;
          excess_amount: number | null;
          start_date: string | null;
          expiry_date: string;
          document_url: string;
          document_path: string;
          thumbnail_url: string | null;
          file_size_bytes: number | null;
          mime_type: string | null;
          file_hash: string | null;
          status: ComplianceStatus;
          verification_score: number;
          ai_analysis: Json | null;
          manually_verified: boolean;
          verified_by: string | null;
          verified_at: string | null;
          rejection_reason: string | null;
          metadata: Json;
          version: number;
          replaced_by_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          document_type: DocumentType;
          provider_name: string;
          policy_number?: string | null;
          registration_number?: string | null;
          coverage_amount?: number | null;
          excess_amount?: number | null;
          start_date?: string | null;
          expiry_date: string;
          document_url: string;
          document_path: string;
          thumbnail_url?: string | null;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          file_hash?: string | null;
          status?: ComplianceStatus;
          verification_score?: number;
          ai_analysis?: Json | null;
          manually_verified?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          metadata?: Json;
          version?: number;
          replaced_by_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          document_type?: DocumentType;
          provider_name?: string;
          policy_number?: string | null;
          registration_number?: string | null;
          coverage_amount?: number | null;
          excess_amount?: number | null;
          start_date?: string | null;
          expiry_date?: string;
          document_url?: string;
          document_path?: string;
          thumbnail_url?: string | null;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          file_hash?: string | null;
          status?: ComplianceStatus;
          verification_score?: number;
          ai_analysis?: Json | null;
          manually_verified?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          metadata?: Json;
          version?: number;
          replaced_by_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      verification_logs: {
        Row: {
          id: string;
          contractor_id: string | null;
          document_id: string | null;
          check_type: string;
          status: 'success' | 'failure' | 'error' | 'pending';
          result: Json;
          performed_by: string | null;
          duration_ms: number | null;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          contractor_id?: string | null;
          document_id?: string | null;
          check_type: string;
          status: 'success' | 'failure' | 'error' | 'pending';
          result?: Json;
          performed_by?: string | null;
          duration_ms?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string | null;
          document_id?: string | null;
          check_type?: string;
          status?: 'success' | 'failure' | 'error' | 'pending';
          result?: Json;
          performed_by?: string | null;
          duration_ms?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      notification_templates: {
        Row: {
          id: string;
          name: string;
          channel: NotificationChannel;
          trigger_type: string;
          subject: string | null;
          body_template: string;
          variables: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          channel: NotificationChannel;
          trigger_type: string;
          subject?: string | null;
          body_template: string;
          variables?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          channel?: NotificationChannel;
          trigger_type?: string;
          subject?: string | null;
          body_template?: string;
          variables?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          contractor_id: string;
          template_id: string | null;
          channel: NotificationChannel;
          recipient_identifier: string;
          subject: string | null;
          message: string;
          status: NotificationStatus;
          external_id: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          read_at: string | null;
          failure_reason: string | null;
          retry_count: number;
          max_retries: number;
          scheduled_for: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          template_id?: string | null;
          channel: NotificationChannel;
          recipient_identifier: string;
          subject?: string | null;
          message: string;
          status?: NotificationStatus;
          external_id?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          failure_reason?: string | null;
          retry_count?: number;
          max_retries?: number;
          scheduled_for?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          template_id?: string | null;
          channel?: NotificationChannel;
          recipient_identifier?: string;
          subject?: string | null;
          message?: string;
          status?: NotificationStatus;
          external_id?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          failure_reason?: string | null;
          retry_count?: number;
          max_retries?: number;
          scheduled_for?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          contractor_id: string;
          invoice_number: string;
          amount: number;
          currency: string;
          description: string | null;
          project_reference: string | null;
          due_date: string;
          status: InvoiceStatus;
          payment_block_reason: string | null;
          compliance_check_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          invoice_number: string;
          amount: number;
          currency?: string;
          description?: string | null;
          project_reference?: string | null;
          due_date: string;
          status?: InvoiceStatus;
          payment_block_reason?: string | null;
          compliance_check_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contractor_id?: string;
          invoice_number?: string;
          amount?: number;
          currency?: string;
          description?: string | null;
          project_reference?: string | null;
          due_date?: string;
          status?: InvoiceStatus;
          payment_block_reason?: string | null;
          compliance_check_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_runs: {
        Row: {
          id: string;
          run_date: string;
          status: 'pending' | 'in_progress' | 'completed' | 'failed';
          total_invoices: number;
          approved_invoices: number;
          blocked_invoices: number;
          total_amount: number;
          approved_amount: number;
          blocked_amount: number;
          processed_by: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_date: string;
          status?: 'pending' | 'in_progress' | 'completed' | 'failed';
          total_invoices?: number;
          approved_invoices?: number;
          blocked_invoices?: number;
          total_amount?: number;
          approved_amount?: number;
          blocked_amount?: number;
          processed_by?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_date?: string;
          status?: 'pending' | 'in_progress' | 'completed' | 'failed';
          total_invoices?: number;
          approved_invoices?: number;
          blocked_invoices?: number;
          total_amount?: number;
          approved_amount?: number;
          blocked_amount?: number;
          processed_by?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          entity_type: string;
          entity_id: string;
          action: AuditAction;
          previous_state: Json | null;
          new_state: Json | null;
          changes: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          session_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          entity_type: string;
          entity_id: string;
          action: AuditAction;
          previous_state?: Json | null;
          new_state?: Json | null;
          changes?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          session_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          entity_type?: string;
          entity_id?: string;
          action?: AuditAction;
          previous_state?: Json | null;
          new_state?: Json | null;
          changes?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          session_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          permissions: string[];
          rate_limit: number;
          last_used_at: string | null;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          permissions?: string[];
          rate_limit?: number;
          last_used_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          key_hash?: string;
          key_prefix?: string;
          permissions?: string[];
          rate_limit?: number;
          last_used_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      contractor_compliance_summary: {
        Row: {
          id: string;
          company_name: string;
          company_number: string | null;
          verification_status: VerificationStatus;
          payment_status: PaymentStatus;
          risk_score: number;
          total_documents: number;
          valid_documents: number;
          expiring_documents: number;
          expired_documents: number;
          pending_documents: number;
          next_expiry_date: string | null;
          last_document_update: string | null;
          last_verified_at: string | null;
          updated_at: string;
        };
      };
      expiring_documents_view: {
        Row: {
          id: string;
          contractor_id: string;
          document_type: DocumentType;
          provider_name: string;
          expiry_date: string;
          status: ComplianceStatus;
          company_name: string;
          contact_name: string;
          email: string;
          phone: string;
          whatsapp_number: string | null;
          days_until_expiry: number;
        };
      };
      payment_block_check: {
        Row: {
          id: string;
          contractor_id: string;
          invoice_number: string;
          amount: number;
          status: InvoiceStatus;
          company_name: string;
          verification_status: VerificationStatus;
          payment_status: PaymentStatus;
          block_reason: string | null;
          can_pay: boolean;
        };
      };
    };
    Functions: {
      calculate_risk_score: {
        Args: { contractor_id: string };
        Returns: number;
      };
      generate_profile_slug: {
        Args: { company_name: string };
        Returns: string;
      };
    };
    Enums: {
      trade_type: TradeType;
      document_type: DocumentType;
      compliance_status: ComplianceStatus;
      verification_status: VerificationStatus;
      payment_status: PaymentStatus;
      user_role: UserRole;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      invoice_status: InvoiceStatus;
      audit_action: AuditAction;
    };
  };
};

// Enum types
export type TradeType =
  | 'electrician'
  | 'plumber'
  | 'gas_engineer'
  | 'roofer'
  | 'carpenter'
  | 'builder'
  | 'plasterer'
  | 'painter_decorator'
  | 'tiler'
  | 'landscaper'
  | 'hvac'
  | 'general_contractor'
  | 'other';

export type DocumentType =
  | 'public_liability'
  | 'employers_liability'
  | 'professional_indemnity'
  | 'gas_safe'
  | 'niceic'
  | 'napit'
  | 'oftec'
  | 'cscs'
  | 'building_regulations'
  | 'other_certification';

export type ComplianceStatus =
  | 'valid'
  | 'expiring_soon'
  | 'expired'
  | 'pending_review'
  | 'rejected'
  | 'fraud_suspected';

export type VerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'suspended'
  | 'blocked';

export type PaymentStatus = 'allowed' | 'blocked' | 'on_hold' | 'pending_review';

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'finance'
  | 'operations'
  | 'viewer';

export type NotificationChannel = 'whatsapp' | 'email' | 'sms' | 'in_app';

export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export type InvoiceStatus =
  | 'pending'
  | 'approved'
  | 'blocked'
  | 'paid'
  | 'cancelled';

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

// Table row types (shortcuts)
export type User = Database['public']['Tables']['users']['Row'];
export type Contractor = Database['public']['Tables']['contractors']['Row'];
export type ComplianceDocument =
  Database['public']['Tables']['compliance_documents']['Row'];
export type VerificationLog =
  Database['public']['Tables']['verification_logs']['Row'];
export type NotificationTemplate =
  Database['public']['Tables']['notification_templates']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type PaymentRun = Database['public']['Tables']['payment_runs']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type ApiKey = Database['public']['Tables']['api_keys']['Row'];

// View types
export type ContractorComplianceSummary =
  Database['public']['Views']['contractor_compliance_summary']['Row'];
export type ExpiringDocument =
  Database['public']['Views']['expiring_documents_view']['Row'];
export type PaymentBlockCheck =
  Database['public']['Views']['payment_block_check']['Row'];
