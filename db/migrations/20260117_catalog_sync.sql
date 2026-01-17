-- Migration: Create catalog sync tables
-- Timestamp: 20260117_catalog_sync.sql
-- Purpose: Implement catalog version tracking and sync history for DGII catalogs

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabla: catalog_versions
-- Almacena versiones actuales de catálogos con sus datos y metadatos
CREATE TABLE IF NOT EXISTS public.catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  catalog_name VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  
  -- Metadata
  description TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  
  -- Sincronización
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sync_status VARCHAR(20) NOT NULL DEFAULT 'success', -- success, failed, pending, skipped
  sync_duration_ms INTEGER,
  
  -- Datos
  data JSONB NOT NULL DEFAULT '[]'::JSONB,
  data_hash VARCHAR(64), -- SHA256 hash para detectar cambios
  
  -- Error logging
  error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(catalog_name, version)
);

-- Índices para catalog_versions
CREATE INDEX idx_catalog_versions_name ON public.catalog_versions(catalog_name);
CREATE INDEX idx_catalog_versions_status ON public.catalog_versions(sync_status, last_sync_at DESC);
CREATE INDEX idx_catalog_versions_hash ON public.catalog_versions(data_hash);

-- 2. Tabla: catalog_sync_history
-- Log detallado de cada sincronización
CREATE TABLE IF NOT EXISTS public.catalog_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Qué se sincronizó
  catalog_name VARCHAR(50) NOT NULL,
  
  -- Resultado
  status VARCHAR(20) NOT NULL, -- success, failed, skipped
  message TEXT,
  
  -- Números
  old_record_count INTEGER,
  new_record_count INTEGER,
  changed_records INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Debugging
  error TEXT,
  stack_trace TEXT,
  
  -- Metadata
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'auto', -- auto, manual, retry
  triggered_by UUID, -- User ID si fue manual
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para catalog_sync_history
CREATE INDEX idx_catalog_sync_history_catalog ON public.catalog_sync_history(catalog_name, created_at DESC);
CREATE INDEX idx_catalog_sync_history_status ON public.catalog_sync_history(status);
CREATE INDEX idx_catalog_sync_history_trigger ON public.catalog_sync_history(trigger_type, created_at DESC);

-- 3. Tabla: catalog_sync_alerts
-- Alertas sobre cambios o fallos en catálogos
CREATE TABLE IF NOT EXISTS public.catalog_sync_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Qué falló
  catalog_name VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- info, warning, error, critical
  
  -- Alerta
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Recomendación
  recommendation TEXT,
  
  -- Estado
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  
  -- Notificación
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Índices para catalog_sync_alerts
CREATE INDEX idx_catalog_sync_alerts_catalog ON public.catalog_sync_alerts(catalog_name);
CREATE INDEX idx_catalog_sync_alerts_severity ON public.catalog_sync_alerts(severity, created_at DESC);
CREATE INDEX idx_catalog_sync_alerts_unresolved ON public.catalog_sync_alerts(resolved_at) WHERE resolved_at IS NULL;

-- Grants para usuarios autenticados
GRANT SELECT, INSERT, UPDATE ON public.catalog_versions TO authenticated;
GRANT SELECT, INSERT ON public.catalog_sync_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.catalog_sync_alerts TO authenticated;

-- Trigger para actualizar updated_at en catalog_versions
CREATE OR REPLACE FUNCTION public.update_catalog_versions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_catalog_versions_updated_at ON public.catalog_versions;
CREATE TRIGGER trigger_catalog_versions_updated_at
  BEFORE UPDATE ON public.catalog_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_catalog_versions_timestamp();
