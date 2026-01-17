-- Migration: Feature Flags System (P3)
-- Created: 2026-01-17
-- Description: Sistema de feature flags para rollout gradual y control de features

-- Tabla principal de feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  key TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'feature', -- feature, experiment, killswitch, config
  
  -- Estado global
  habilitado BOOLEAN DEFAULT false,
  
  -- Estrategia de rollout
  estrategia TEXT NOT NULL DEFAULT 'boolean', -- boolean, percentage, tenants, user_ids, gradual
  
  -- Configuración de porcentaje
  porcentaje_rollout INTEGER DEFAULT 0, -- 0-100
  
  -- Listas de permitidos
  tenants_permitidos JSONB DEFAULT '[]',
  usuarios_permitidos JSONB DEFAULT '[]',
  
  -- Configuración adicional
  configuracion JSONB DEFAULT '{}',
  
  -- Fechas automáticas
  inicio_automatico TIMESTAMP,
  fin_automatico TIMESTAMP,
  
  -- Métricas
  veces_consultado INTEGER DEFAULT 0,
  veces_activado INTEGER DEFAULT 0,
  veces_desactivado INTEGER DEFAULT 0,
  ultima_consulta TIMESTAMP,
  
  -- Metadatos
  creado_por VARCHAR,
  modificado_por VARCHAR,
  tags JSONB DEFAULT '[]',
  
  -- Auditoría
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para feature_flags
CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_habilitado ON feature_flags(habilitado);
CREATE INDEX idx_feature_flags_categoria ON feature_flags(categoria);
CREATE INDEX idx_feature_flags_estrategia ON feature_flags(estrategia);

-- Tabla de historial de cambios
CREATE TABLE IF NOT EXISTS feature_flag_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES feature_flags(id),
  
  -- Cambio realizado
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  
  -- Contexto
  modificado_por VARCHAR NOT NULL,
  motivo TEXT,
  
  -- Auditoría
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para feature_flag_history
CREATE INDEX idx_feature_flag_history_flagId ON feature_flag_history(flag_id);
CREATE INDEX idx_feature_flag_history_createdAt ON feature_flag_history(created_at);

-- Tabla de evaluaciones (para analytics - con sampling 10%)
CREATE TABLE IF NOT EXISTS feature_flag_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES feature_flags(id),
  
  -- Contexto de la evaluación
  tenant_id UUID REFERENCES tenants(id),
  user_id VARCHAR,
  
  -- Resultado
  resultado BOOLEAN NOT NULL,
  estrategia_usada TEXT,
  
  -- Metadata
  user_agent TEXT,
  ip_address TEXT,
  
  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para feature_flag_evaluations
CREATE INDEX idx_feature_flag_evaluations_flagId ON feature_flag_evaluations(flag_id);
CREATE INDEX idx_feature_flag_evaluations_tenantId ON feature_flag_evaluations(tenant_id);
CREATE INDEX idx_feature_flag_evaluations_createdAt ON feature_flag_evaluations(created_at);
CREATE INDEX idx_feature_flag_evaluations_flag_tenant ON feature_flag_evaluations(flag_id, tenant_id);

-- Insertar flags por defecto para features existentes
INSERT INTO feature_flags (key, nombre, descripcion, categoria, habilitado, estrategia) VALUES
  ('stock_transito', 'Stock en Tránsito', 'Gestión de inventario en tránsito entre sucursales', 'feature', true, 'boolean'),
  ('sigma_support', 'Soporte Sigma ERP', 'Integración con Sigma ERP para clientes enterprise', 'feature', true, 'boolean'),
  ('offline_mode', 'Modo Offline', 'Facturación offline con sincronización posterior', 'feature', true, 'boolean'),
  ('performance_mode', 'Modo Performance', 'Optimizaciones adaptativas según carga del sistema', 'feature', true, 'boolean')
ON CONFLICT (key) DO NOTHING;

-- Comentarios en tablas
COMMENT ON TABLE feature_flags IS 'Sistema de feature flags para control dinámico de funcionalidades';
COMMENT ON TABLE feature_flag_history IS 'Historial de cambios en configuración de flags';
COMMENT ON TABLE feature_flag_evaluations IS 'Log de evaluaciones de flags (sampling 10%)';

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- Política RLS (Row Level Security) - opcional si se usa Supabase
-- ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE feature_flag_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE feature_flag_evaluations ENABLE ROW LEVEL SECURITY;

-- Grants para roles
-- GRANT SELECT ON feature_flags TO authenticated;
-- GRANT ALL ON feature_flags TO service_role;
