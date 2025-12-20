-- ===========================================
-- CONTRACTOR PORTAL - ADDITIONAL TABLES
-- Version: 1.0.1
-- ===========================================

-- Add deleted_at and created_by columns to contractors
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.contractors ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);
CREATE INDEX IF NOT EXISTS idx_contractors_deleted_at ON public.contractors(deleted_at) WHERE deleted_at IS NOT NULL;

-- Contractor Access Tokens (for passwordless portal access)
CREATE TABLE public.contractor_access_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for access tokens
CREATE INDEX idx_contractor_access_tokens_contractor ON public.contractor_access_tokens(contractor_id);
CREATE INDEX idx_contractor_access_tokens_token ON public.contractor_access_tokens(token);
CREATE INDEX idx_contractor_access_tokens_expires ON public.contractor_access_tokens(expires_at);

-- Cleanup function for expired tokens (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_access_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.contractor_access_tokens
  WHERE expires_at < NOW() - INTERVAL '7 days'
  RETURNING 1 INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Webhooks table for external integrations
CREATE TABLE public.webhooks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_response_code INTEGER,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook delivery logs
CREATE TABLE public.webhook_deliveries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_code INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for webhooks
CREATE INDEX idx_webhooks_is_active ON public.webhooks(is_active);
CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created ON public.webhook_deliveries(created_at DESC);

-- Email queue table for SendGrid integration
CREATE TABLE public.email_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  to_email TEXT NOT NULL,
  to_name TEXT,
  from_email TEXT NOT NULL DEFAULT 'compliance@example.com',
  from_name TEXT NOT NULL DEFAULT 'Trade Compliance Engine',
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  template_id TEXT,
  template_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  sendgrid_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for email queue
CREATE INDEX idx_email_queue_status ON public.email_queue(status);
CREATE INDEX idx_email_queue_scheduled ON public.email_queue(scheduled_for) WHERE status = 'pending';

-- Bulk import jobs table
CREATE TABLE public.import_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('contractors', 'documents', 'invoices')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_rows INTEGER,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  successful_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  results JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for import jobs
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX idx_import_jobs_created_by ON public.import_jobs(created_by);

-- Gas Safe Registry cache
CREATE TABLE public.gas_safe_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  licence_number TEXT NOT NULL UNIQUE,
  engineer_name TEXT,
  trading_name TEXT,
  status TEXT,
  appliances TEXT[],
  business_address TEXT,
  is_valid BOOLEAN NOT NULL DEFAULT false,
  expires_at DATE,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for Gas Safe cache
CREATE INDEX idx_gas_safe_cache_licence ON public.gas_safe_cache(licence_number);
CREATE INDEX idx_gas_safe_cache_fetched ON public.gas_safe_cache(fetched_at);

-- Update triggers for new tables
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies for new tables
ALTER TABLE public.contractor_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_safe_cache ENABLE ROW LEVEL SECURITY;

-- Admins can manage webhooks
CREATE POLICY "Admins can manage webhooks"
  ON public.webhooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Admins can view webhook deliveries
CREATE POLICY "Admins can view webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Admins can manage import jobs
CREATE POLICY "Admins can manage import jobs"
  ON public.import_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'operations')
    )
  );

-- Email queue - service role only (no direct user access)
-- Access via API routes only

-- Gas Safe cache - authenticated users can view
CREATE POLICY "Authenticated users can view gas safe cache"
  ON public.gas_safe_cache FOR SELECT
  USING (auth.role() = 'authenticated');
