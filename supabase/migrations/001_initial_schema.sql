-- ===========================================
-- TRADE COMPLIANCE ENGINE - DATABASE SCHEMA
-- Version: 1.0.0
-- ===========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============ ENUM TYPES ============

CREATE TYPE trade_type AS ENUM (
  'electrician', 'plumber', 'gas_engineer', 'roofer', 'carpenter',
  'builder', 'plasterer', 'painter_decorator', 'tiler', 'landscaper',
  'hvac', 'general_contractor', 'other'
);

CREATE TYPE document_type AS ENUM (
  'public_liability', 'employers_liability', 'professional_indemnity',
  'gas_safe', 'niceic', 'napit', 'oftec', 'cscs',
  'building_regulations', 'other_certification'
);

CREATE TYPE compliance_status AS ENUM (
  'valid', 'expiring_soon', 'expired', 'pending_review',
  'rejected', 'fraud_suspected'
);

CREATE TYPE verification_status AS ENUM (
  'verified', 'partially_verified', 'unverified', 'suspended', 'blocked'
);

CREATE TYPE payment_status AS ENUM (
  'allowed', 'blocked', 'on_hold', 'pending_review'
);

CREATE TYPE user_role AS ENUM (
  'super_admin', 'admin', 'finance', 'operations', 'viewer'
);

CREATE TYPE notification_channel AS ENUM (
  'whatsapp', 'email', 'sms', 'in_app'
);

CREATE TYPE notification_status AS ENUM (
  'pending', 'sent', 'delivered', 'read', 'failed', 'cancelled'
);

CREATE TYPE invoice_status AS ENUM (
  'pending', 'approved', 'blocked', 'paid', 'cancelled'
);

CREATE TYPE audit_action AS ENUM (
  'create', 'update', 'delete', 'view', 'verify',
  'approve', 'reject', 'block', 'unblock', 'export', 'login', 'logout'
);

-- ============ CORE TABLES ============

-- Users (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contractors (The Companies/Individuals)
CREATE TABLE public.contractors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name TEXT NOT NULL,
  trading_name TEXT,
  company_number TEXT, -- Companies House ID
  vat_number TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_number TEXT,
  trade_types trade_type[] NOT NULL DEFAULT '{}',

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  address_city TEXT,
  address_county TEXT,
  address_postcode TEXT,
  address_country TEXT DEFAULT 'United Kingdom',

  -- Status & Verification
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  payment_status payment_status NOT NULL DEFAULT 'pending_review',
  public_profile_slug TEXT UNIQUE,
  risk_score INTEGER NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),

  -- Metadata
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarded_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,

  -- Companies House Cache
  companies_house_data JSONB,
  companies_house_fetched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_company_number CHECK (company_number IS NULL OR company_number ~ '^\d{8}$|^[A-Z]{2}\d{6}$')
);

-- Indexes for contractors
CREATE INDEX idx_contractors_company_name ON public.contractors USING gin(company_name gin_trgm_ops);
CREATE INDEX idx_contractors_company_number ON public.contractors(company_number) WHERE company_number IS NOT NULL;
CREATE INDEX idx_contractors_verification_status ON public.contractors(verification_status);
CREATE INDEX idx_contractors_payment_status ON public.contractors(payment_status);
CREATE INDEX idx_contractors_public_slug ON public.contractors(public_profile_slug) WHERE public_profile_slug IS NOT NULL;
CREATE INDEX idx_contractors_trade_types ON public.contractors USING gin(trade_types);
CREATE INDEX idx_contractors_tags ON public.contractors USING gin(tags);
CREATE INDEX idx_contractors_is_active ON public.contractors(is_active);

-- Compliance Documents
CREATE TABLE public.compliance_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  provider_name TEXT NOT NULL,
  policy_number TEXT,
  registration_number TEXT,
  coverage_amount BIGINT, -- Stored in pence/cents
  excess_amount BIGINT,
  start_date DATE,
  expiry_date DATE NOT NULL,

  -- Document Storage
  document_url TEXT NOT NULL,
  document_path TEXT NOT NULL, -- Storage bucket path
  thumbnail_url TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,
  file_hash TEXT, -- SHA-256 for duplicate detection

  -- Verification
  status compliance_status NOT NULL DEFAULT 'pending_review',
  verification_score INTEGER DEFAULT 0 CHECK (verification_score >= 0 AND verification_score <= 100),
  ai_analysis JSONB,
  manually_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES public.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  replaced_by_id UUID REFERENCES public.compliance_documents(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_dates CHECK (start_date IS NULL OR start_date <= expiry_date),
  CONSTRAINT valid_coverage CHECK (coverage_amount IS NULL OR coverage_amount >= 0)
);

-- Indexes for compliance documents
CREATE INDEX idx_compliance_docs_contractor ON public.compliance_documents(contractor_id);
CREATE INDEX idx_compliance_docs_type ON public.compliance_documents(document_type);
CREATE INDEX idx_compliance_docs_status ON public.compliance_documents(status);
CREATE INDEX idx_compliance_docs_expiry ON public.compliance_documents(expiry_date);
CREATE INDEX idx_compliance_docs_expiring ON public.compliance_documents(expiry_date)
  WHERE status IN ('valid', 'expiring_soon');
CREATE INDEX idx_compliance_docs_file_hash ON public.compliance_documents(file_hash)
  WHERE file_hash IS NOT NULL;

-- Verification Logs (Comprehensive Audit Trail)
CREATE TABLE public.verification_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  contractor_id UUID REFERENCES public.contractors(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.compliance_documents(id) ON DELETE SET NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'error', 'pending')),
  result JSONB NOT NULL DEFAULT '{}',
  performed_by UUID REFERENCES public.users(id),
  duration_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for verification logs
CREATE INDEX idx_verification_logs_contractor ON public.verification_logs(contractor_id);
CREATE INDEX idx_verification_logs_document ON public.verification_logs(document_id);
CREATE INDEX idx_verification_logs_check_type ON public.verification_logs(check_type);
CREATE INDEX idx_verification_logs_created ON public.verification_logs(created_at DESC);

-- Notification Templates
CREATE TABLE public.notification_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  channel notification_channel NOT NULL,
  trigger_type TEXT NOT NULL,
  subject TEXT,
  body_template TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.notification_templates(id),
  channel notification_channel NOT NULL,
  recipient_identifier TEXT NOT NULL, -- Phone/Email/User ID
  subject TEXT,
  message TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  external_id TEXT, -- Twilio message SID, etc.
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_contractor ON public.notifications(contractor_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_scheduled ON public.notifications(scheduled_for)
  WHERE status = 'pending' AND scheduled_for IS NOT NULL;
CREATE INDEX idx_notifications_channel ON public.notifications(channel);

-- Invoices
CREATE TABLE public.invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0), -- Stored in pence
  currency TEXT NOT NULL DEFAULT 'GBP',
  description TEXT,
  project_reference TEXT,
  due_date DATE NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  payment_block_reason TEXT,
  compliance_check_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_invoice_number UNIQUE (contractor_id, invoice_number)
);

-- Indexes for invoices
CREATE INDEX idx_invoices_contractor ON public.invoices(contractor_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_invoices_pending ON public.invoices(due_date) WHERE status = 'pending';

-- Payment Runs
CREATE TABLE public.payment_runs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  total_invoices INTEGER NOT NULL DEFAULT 0,
  approved_invoices INTEGER NOT NULL DEFAULT 0,
  blocked_invoices INTEGER NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  approved_amount BIGINT NOT NULL DEFAULT 0,
  blocked_amount BIGINT NOT NULL DEFAULT 0,
  processed_by UUID REFERENCES public.users(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment Run Items (junction table)
CREATE TABLE public.payment_run_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  payment_run_id UUID NOT NULL REFERENCES public.payment_runs(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('approved', 'blocked', 'pending')),
  block_reason TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_run_invoice UNIQUE (payment_run_id, invoice_id)
);

-- Audit Logs (Immutable)
CREATE TABLE public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action audit_action NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  changes JSONB, -- Computed diff
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- API Keys (for external integrations)
CREATE TABLE public.api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 of the API key
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  permissions TEXT[] NOT NULL DEFAULT '{}',
  rate_limit INTEGER NOT NULL DEFAULT 1000, -- requests per hour
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate Limiting Cache
CREATE TABLE public.rate_limit_cache (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create index for expiry cleanup
CREATE INDEX idx_rate_limit_expires ON public.rate_limit_cache(expires_at);

-- ============ VIEWS ============

-- Contractor Compliance Summary View
CREATE OR REPLACE VIEW public.contractor_compliance_summary AS
SELECT
  c.id,
  c.company_name,
  c.company_number,
  c.verification_status,
  c.payment_status,
  c.risk_score,
  COUNT(cd.id) AS total_documents,
  COUNT(cd.id) FILTER (WHERE cd.status = 'valid') AS valid_documents,
  COUNT(cd.id) FILTER (WHERE cd.status = 'expiring_soon') AS expiring_documents,
  COUNT(cd.id) FILTER (WHERE cd.status = 'expired') AS expired_documents,
  COUNT(cd.id) FILTER (WHERE cd.status = 'pending_review') AS pending_documents,
  MIN(cd.expiry_date) FILTER (WHERE cd.status IN ('valid', 'expiring_soon')) AS next_expiry_date,
  MAX(cd.updated_at) AS last_document_update,
  c.last_verified_at,
  c.updated_at
FROM public.contractors c
LEFT JOIN public.compliance_documents cd ON c.id = cd.contractor_id
  AND cd.replaced_by_id IS NULL
GROUP BY c.id;

-- Expiring Documents View (for cron jobs)
CREATE OR REPLACE VIEW public.expiring_documents_view AS
SELECT
  cd.*,
  c.company_name,
  c.contact_name,
  c.email,
  c.phone,
  c.whatsapp_number,
  (cd.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM public.compliance_documents cd
JOIN public.contractors c ON cd.contractor_id = c.id
WHERE cd.replaced_by_id IS NULL
  AND cd.status IN ('valid', 'expiring_soon')
  AND cd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY cd.expiry_date ASC;

-- Payment Blocking View
CREATE OR REPLACE VIEW public.payment_block_check AS
SELECT
  i.*,
  c.company_name,
  c.verification_status,
  c.payment_status,
  CASE
    WHEN c.payment_status = 'blocked' THEN 'Contractor payment blocked'
    WHEN c.verification_status = 'blocked' THEN 'Contractor verification blocked'
    WHEN c.verification_status = 'suspended' THEN 'Contractor suspended'
    WHEN EXISTS (
      SELECT 1 FROM public.compliance_documents cd
      WHERE cd.contractor_id = c.id
        AND cd.document_type IN ('public_liability', 'employers_liability')
        AND cd.status = 'expired'
        AND cd.replaced_by_id IS NULL
    ) THEN 'Required insurance expired'
    WHEN NOT EXISTS (
      SELECT 1 FROM public.compliance_documents cd
      WHERE cd.contractor_id = c.id
        AND cd.document_type = 'public_liability'
        AND cd.status = 'valid'
        AND cd.replaced_by_id IS NULL
    ) THEN 'No valid public liability insurance'
    ELSE NULL
  END AS block_reason,
  CASE
    WHEN c.payment_status = 'allowed'
      AND c.verification_status = 'verified'
      AND NOT EXISTS (
        SELECT 1 FROM public.compliance_documents cd
        WHERE cd.contractor_id = c.id
          AND cd.document_type IN ('public_liability', 'employers_liability')
          AND cd.status = 'expired'
          AND cd.replaced_by_id IS NULL
      )
    THEN true
    ELSE false
  END AS can_pay
FROM public.invoices i
JOIN public.contractors c ON i.contractor_id = c.id
WHERE i.status = 'pending';

-- ============ FUNCTIONS ============

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate risk score function
CREATE OR REPLACE FUNCTION public.calculate_risk_score(contractor_id UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 50;
  doc RECORD;
  ch_data JSONB;
BEGIN
  -- Get Companies House data
  SELECT companies_house_data INTO ch_data
  FROM public.contractors WHERE id = contractor_id;

  -- Adjust for Companies House status
  IF ch_data IS NOT NULL THEN
    IF ch_data->>'companyStatus' = 'active' THEN
      score := score - 10;
    ELSIF ch_data->>'companyStatus' IN ('dissolved', 'liquidation') THEN
      score := score + 30;
    END IF;

    IF (ch_data->>'hasInsolvencyHistory')::boolean THEN
      score := score + 20;
    END IF;
  END IF;

  -- Adjust for document status
  FOR doc IN
    SELECT status, document_type, expiry_date
    FROM public.compliance_documents
    WHERE contractor_id = calculate_risk_score.contractor_id
      AND replaced_by_id IS NULL
  LOOP
    IF doc.status = 'valid' THEN
      score := score - 5;
    ELSIF doc.status = 'expired' THEN
      score := score + 15;
    ELSIF doc.status = 'fraud_suspected' THEN
      score := score + 40;
    END IF;
  END LOOP;

  -- Clamp to 0-100
  RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql;

-- Update document status based on expiry
CREATE OR REPLACE FUNCTION public.update_document_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  ELSIF NEW.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'expiring_soon';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generate public profile slug
CREATE OR REPLACE FUNCTION public.generate_profile_slug(company_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(company_name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  base_slug := TRIM(BOTH '-' FROM base_slug);

  final_slug := base_slug;

  -- Check for uniqueness and add number if needed
  WHILE EXISTS (SELECT 1 FROM public.contractors WHERE public_profile_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Audit log trigger function
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  changes_json JSONB;
  old_json JSONB;
  new_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    INSERT INTO public.audit_logs (entity_type, entity_id, action, previous_state)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', old_json);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);

    -- Compute changes (keys that differ)
    SELECT jsonb_object_agg(key, new_json->key) INTO changes_json
    FROM jsonb_each(new_json)
    WHERE new_json->key IS DISTINCT FROM old_json->key
      AND key NOT IN ('updated_at', 'created_at');

    IF changes_json IS NOT NULL AND changes_json != '{}' THEN
      INSERT INTO public.audit_logs (entity_type, entity_id, action, previous_state, new_state, changes)
      VALUES (TG_TABLE_NAME, NEW.id, 'update', old_json, new_json, changes_json);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_state)
    VALUES (TG_TABLE_NAME, NEW.id, 'create', new_json);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============ TRIGGERS ============

-- Updated_at triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_contractors_updated_at
  BEFORE UPDATE ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_compliance_documents_updated_at
  BEFORE UPDATE ON public.compliance_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Document status auto-update trigger
CREATE TRIGGER auto_update_document_status
  BEFORE INSERT OR UPDATE OF expiry_date ON public.compliance_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_document_status();

-- Audit log triggers (on important tables)
CREATE TRIGGER audit_contractors
  AFTER INSERT OR UPDATE OR DELETE ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_compliance_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.compliance_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- ============ ROW LEVEL SECURITY ============

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins can manage users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Contractors policies
CREATE POLICY "Authenticated users can view contractors"
  ON public.contractors FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and operations can manage contractors"
  ON public.contractors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'operations')
    )
  );

-- Compliance documents policies
CREATE POLICY "Authenticated users can view documents"
  ON public.compliance_documents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and operations can manage documents"
  ON public.compliance_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'operations')
    )
  );

-- Invoices policies
CREATE POLICY "Authenticated users can view invoices"
  ON public.invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Finance and admins can manage invoices"
  ON public.invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'finance')
    )
  );

-- Audit logs are read-only for admins
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- ============ SEED DATA ============

-- Insert default notification templates
INSERT INTO public.notification_templates (name, channel, trigger_type, subject, body_template, variables) VALUES
('whatsapp_expiry_30_days', 'whatsapp', 'document_expiring_30_days', NULL,
  'Hi {{contact_name}}, your {{document_type}} for {{company_name}} expires on {{expiry_date}}. Please upload your renewal to our portal to ensure uninterrupted payments. Portal: {{portal_url}}',
  ARRAY['contact_name', 'document_type', 'company_name', 'expiry_date', 'portal_url']),

('whatsapp_expiry_7_days', 'whatsapp', 'document_expiring_7_days', NULL,
  'URGENT: {{contact_name}}, your {{document_type}} expires in 7 days ({{expiry_date}}). Without a valid certificate, we cannot allow work on our sites. Please upload renewal immediately: {{portal_url}}',
  ARRAY['contact_name', 'document_type', 'expiry_date', 'portal_url']),

('whatsapp_expired', 'whatsapp', 'document_expired', NULL,
  'ACCOUNT LOCKED: {{contact_name}}, your {{document_type}} has expired. No further payments will be released until a valid certificate is uploaded. Upload now: {{portal_url}}',
  ARRAY['contact_name', 'document_type', 'portal_url']),

('email_expiry_30_days', 'email', 'document_expiring_30_days',
  'Action Required: {{document_type}} Expiring Soon',
  'Dear {{contact_name}},\n\nThis is a reminder that your {{document_type}} for {{company_name}} will expire on {{expiry_date}}.\n\nTo ensure continued partnership and uninterrupted payments, please upload your renewed certificate to our compliance portal.\n\nUpload here: {{portal_url}}\n\nBest regards,\nThe Compliance Team',
  ARRAY['contact_name', 'document_type', 'company_name', 'expiry_date', 'portal_url']),

('email_payment_blocked', 'email', 'payment_blocked',
  'Payment Blocked - Compliance Issue',
  'Dear {{contact_name}},\n\nWe regret to inform you that payments to {{company_name}} have been temporarily blocked due to: {{block_reason}}\n\nTo resolve this issue, please log into our compliance portal and address the outstanding items.\n\nPortal: {{portal_url}}\n\nBest regards,\nThe Finance Team',
  ARRAY['contact_name', 'company_name', 'block_reason', 'portal_url']);
