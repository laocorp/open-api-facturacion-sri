-- Migration 001: API Keys + Usage Tracking
-- Run: psql -h <host> -U <user> -d <db> -f database/migrations/001_api_keys_usage.sql

-- ============================================
-- API Keys
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_hash text NOT NULL,
    key_prefix character varying(16) NOT NULL,
    name character varying(255) NOT NULL,
    tier character varying(20) DEFAULT 'basic' NOT NULL,
    activo boolean DEFAULT true,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);
CREATE INDEX idx_api_keys_tenant ON public.api_keys(tenant_id);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_activo ON public.api_keys(activo) WHERE activo = true;

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.api_keys IS 'API Keys para autenticación de clientes';
COMMENT ON COLUMN public.api_keys.key_hash IS 'bcrypt hash del API key';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'Primeros 16 chars (sk_live_...) para identificación';
COMMENT ON COLUMN public.api_keys.tier IS 'Tier de rate limiting: basic, professional, enterprise, unlimited';
COMMENT ON COLUMN public.api_keys.activo IS 'Si la key está activa (desactivar no elimina)';

-- ============================================
-- Usage Logs
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
    endpoint character varying(255) NOT NULL,
    method character varying(10) NOT NULL,
    status_code integer,
    ip_address inet,
    user_agent text,
    response_time_ms integer,
    comprobante_id uuid REFERENCES public.comprobantes(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.usage_logs ADD CONSTRAINT usage_logs_pkey PRIMARY KEY (id);
CREATE INDEX idx_usage_logs_tenant ON public.usage_logs(tenant_id);
CREATE INDEX idx_usage_logs_api_key ON public.usage_logs(api_key_id);
CREATE INDEX idx_usage_logs_endpoint ON public.usage_logs(endpoint);
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at);
CREATE INDEX idx_usage_logs_tenant_created ON public.usage_logs(tenant_id, created_at DESC);

COMMENT ON TABLE public.usage_logs IS 'Registro de uso de API por tenant';
COMMENT ON COLUMN public.usage_logs.comprobante_id IS 'Comprobante asociado (si aplica)';
