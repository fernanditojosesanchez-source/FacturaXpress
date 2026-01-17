-- Migración: Sistema JIT (Just-In-Time) para Sigma Support
-- Fecha: 2026-01-17
-- Propósito: Implementar workflow de aprobación obligatoria con tokens de corta duración
-- @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #3 (P1)

-- =============================================================================
-- 1. Tabla de solicitudes de acceso JIT
-- =============================================================================

CREATE TABLE IF NOT EXISTS sigma_support_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Solicitante (Sigma Support)
  requested_by UUID NOT NULL,
  requested_by_name VARCHAR(255) NOT NULL,
  requested_by_email VARCHAR(255) NOT NULL,
  
  -- Tenant objetivo
  tenant_id UUID NOT NULL,
  tenant_nombre VARCHAR(255) NOT NULL,
  
  -- Justificación
  reason TEXT NOT NULL,
  estimated_duration INTEGER NOT NULL DEFAULT 7200000, -- 2 horas en ms
  urgency VARCHAR(20) NOT NULL DEFAULT 'normal', -- low, normal, high, critical
  
  -- Scope solicitado
  scope_requested JSONB NOT NULL DEFAULT '{
    "canViewLogs": true,
    "canViewMetrics": true,
    "canViewAudit": false,
    "canExportData": false
  }'::jsonb,
  
  -- Estado del workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, expired, revoked
  
  -- Aprobación
  reviewed_by UUID,
  reviewed_by_name VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Token generado (si fue aprobado)
  access_granted_id UUID, -- FK a sigma_support_access
  access_expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Solicitud expira en 24h si no se responde
  
  -- Notificaciones
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ
);

-- Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_support_requests_tenant ON sigma_support_access_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_support_requests_requester ON sigma_support_access_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON sigma_support_access_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_support_requests_expires ON sigma_support_access_requests(expires_at);

-- Trigger para updated_at (si se necesita en el futuro)
-- CREATE TRIGGER update_support_requests_updated_at BEFORE UPDATE ON sigma_support_access_requests
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. Tabla de extensiones de acceso
-- =============================================================================

CREATE TABLE IF NOT EXISTS sigma_support_access_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Acceso original que se extiende
  original_access_id UUID NOT NULL,
  
  -- Nueva solicitud de extensión
  request_id UUID NOT NULL, -- FK a access_requests
  
  -- Extensión otorgada
  previous_expires_at TIMESTAMPTZ NOT NULL,
  new_expires_at TIMESTAMPTZ NOT NULL,
  extension_duration INTEGER NOT NULL, -- ms
  
  -- Justificación
  reason TEXT NOT NULL,
  
  -- Aprobación
  approved_by UUID NOT NULL,
  approved_by_name VARCHAR(255) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_support_extensions_access ON sigma_support_access_extensions(original_access_id);
CREATE INDEX IF NOT EXISTS idx_support_extensions_request ON sigma_support_access_extensions(request_id);

-- =============================================================================
-- 3. Tabla de políticas JIT por tenant
-- =============================================================================

CREATE TABLE IF NOT EXISTS sigma_support_jit_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  tenant_id UUID NOT NULL UNIQUE,
  
  -- Políticas de aprobación
  require_approval BOOLEAN NOT NULL DEFAULT true,
  auto_approve_for_urgency VARCHAR(20), -- 'critical' = auto-aprobar críticos, NULL = nunca
  
  -- Límites de tiempo
  max_access_duration INTEGER NOT NULL DEFAULT 7200000, -- 2h en ms
  max_extensions INTEGER NOT NULL DEFAULT 2, -- Max 2 extensiones
  request_expiration_time INTEGER NOT NULL DEFAULT 86400000, -- 24h en ms
  
  -- Notificaciones
  notify_admins_on_request BOOLEAN DEFAULT true,
  notify_admin_emails TEXT, -- Emails separados por coma
  
  -- Restricciones de scope
  allowed_scopes JSONB DEFAULT '{
    "canViewLogs": true,
    "canViewMetrics": true,
    "canViewAudit": false,
    "canExportData": false
  }'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_support_jit_policies_tenant ON sigma_support_jit_policies(tenant_id);

-- =============================================================================
-- 4. Datos de ejemplo (opcional - comentado por defecto)
-- =============================================================================

-- Insertar política por defecto para tenant de prueba
-- INSERT INTO sigma_support_jit_policies (tenant_id, require_approval, max_access_duration, max_extensions)
-- VALUES ('00000000-0000-0000-0000-000000000001', true, 7200000, 2)
-- ON CONFLICT (tenant_id) DO NOTHING;

-- =============================================================================
-- 5. Grants y permisos
-- =============================================================================

-- Otorgar permisos a usuario autenticado (ajustar según tu setup de roles)
GRANT SELECT, INSERT, UPDATE ON sigma_support_access_requests TO authenticated;
GRANT SELECT, INSERT ON sigma_support_access_extensions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sigma_support_jit_policies TO authenticated;

-- =============================================================================
-- Fin de migración
-- =============================================================================
