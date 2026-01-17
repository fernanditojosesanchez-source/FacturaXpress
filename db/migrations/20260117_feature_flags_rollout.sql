-- Migration: Feature Flags Phase 2 - Rollout Gradual
-- Descripción: Sistema completo de feature flags con rollout gradual, A/B testing y canary deployments
-- Autor: FacturaXpress Team
-- Fecha: 2026-01-17

-- ============================================================================
-- 1. TABLA PRINCIPAL - FEATURE FLAGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  key TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'feature', -- feature, experiment, killswitch, config
  
  -- Estado global
  habilitado BOOLEAN DEFAULT FALSE,
  
  -- Estrategia de rollout
  estrategia TEXT NOT NULL DEFAULT 'boolean',
  -- boolean: simple on/off
  -- percentage: porcentaje de usuarios
  -- tenants: lista de tenants específicos
  -- user_ids: lista de usuarios específicos
  -- gradual: liberación gradual automática
  
  -- Configuración de rollout
  porcentaje_rollout INTEGER DEFAULT 0, -- 0-100
  tenants_permitidos JSONB DEFAULT '[]'::jsonb,
  usuarios_permitidos JSONB DEFAULT '[]'::jsonb,
  
  -- Configuración adicional (variant, max_items, etc.)
  configuracion JSONB DEFAULT '{}'::jsonb,
  
  -- Fechas de activación automática
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
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- Auditoría
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para optimización
CREATE INDEX idx_feature_flags_key ON public.feature_flags(key);
CREATE INDEX idx_feature_flags_habilitado ON public.feature_flags(habilitado);
CREATE INDEX idx_feature_flags_categoria ON public.feature_flags(categoria);
CREATE INDEX idx_feature_flags_estrategia ON public.feature_flags(estrategia);
CREATE INDEX idx_feature_flags_created_at ON public.feature_flags(created_at);

-- ============================================================================
-- 2. TABLA DE HISTORIAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  
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

CREATE INDEX idx_feature_flag_history_flag_id ON public.feature_flag_history(flag_id);
CREATE INDEX idx_feature_flag_history_created_at ON public.feature_flag_history(created_at);

COMMENT ON TABLE public.feature_flag_history IS 'Registro de todos los cambios en feature flags para auditoría y debugging';

-- ============================================================================
-- 3. TABLA DE EVALUACIONES (Analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  
  -- Contexto de la evaluación
  tenant_id UUID REFERENCES public.tenants(id),
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

CREATE INDEX idx_feature_flag_evaluations_flag_id ON public.feature_flag_evaluations(flag_id);
CREATE INDEX idx_feature_flag_evaluations_tenant_id ON public.feature_flag_evaluations(tenant_id);
CREATE INDEX idx_feature_flag_evaluations_created_at ON public.feature_flag_evaluations(created_at);
CREATE INDEX idx_feature_flag_evaluations_flag_tenant ON public.feature_flag_evaluations(flag_id, tenant_id);

COMMENT ON TABLE public.feature_flag_evaluations IS 'Analytics de evaluación de feature flags para tracking de rollout y A/B testing';

-- ============================================================================
-- 4. TABLA DE ROLLOUT GRADUAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_rollout_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  
  -- Rollout automático
  porcentaje_anterior INTEGER,
  porcentaje_nuevo INTEGER NOT NULL,
  
  -- Contexto
  motivo TEXT, -- 'automatic', 'manual', 'error_recovery', etc.
  cambio_automático BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  modificado_por VARCHAR,
  
  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flag_rollout_history_flag_id ON public.feature_flag_rollout_history(flag_id);
CREATE INDEX idx_feature_flag_rollout_history_created_at ON public.feature_flag_rollout_history(created_at);

COMMENT ON TABLE public.feature_flag_rollout_history IS 'Historial de cambios de rollout automático para tracking de canary deployments';

-- ============================================================================
-- 5. TABLA DE VARIANTES (A/B Testing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  
  -- Identificación de variante
  clave TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  
  -- Configuración
  porcentaje DECIMAL(5, 2) NOT NULL, -- % de usuarios que ven esta variante
  configuracion JSONB DEFAULT '{}'::jsonb,
  
  -- Estado
  activa BOOLEAN DEFAULT TRUE,
  
  -- Auditoría
  creado_por VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flag_variants_flag_id ON public.feature_flag_variants(flag_id);
CREATE UNIQUE INDEX idx_feature_flag_variants_flag_clave ON public.feature_flag_variants(flag_id, clave);

COMMENT ON TABLE public.feature_flag_variants IS 'Variantes para A/B testing dentro de un feature flag';

-- ============================================================================
-- 6. TABLA DE ASIGNACIONES DE VARIANTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_variant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.feature_flag_variants(id) ON DELETE CASCADE,
  
  -- Contexto de asignación
  tenant_id UUID REFERENCES public.tenants(id),
  user_id VARCHAR,
  
  -- Control
  hash_usuario TEXT, -- Hash consistente del usuario para reproducibilidad
  
  -- Auditoría
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flag_variant_assignments_flag_id ON public.feature_flag_variant_assignments(flag_id);
CREATE INDEX idx_feature_flag_variant_assignments_variant_id ON public.feature_flag_variant_assignments(variant_id);
CREATE INDEX idx_feature_flag_variant_assignments_tenant_id ON public.feature_flag_variant_assignments(tenant_id);
CREATE UNIQUE INDEX idx_feature_flag_variant_assignments_user_flag ON public.feature_flag_variant_assignments(flag_id, user_id);

COMMENT ON TABLE public.feature_flag_variant_assignments IS 'Asignación estable de variantes a usuarios para reproducibilidad de A/B tests';

-- ============================================================================
-- 7. TRIGGERS PARA AUDITORÍA
-- ============================================================================

-- Trigger: Actualizar updated_at en feature_flags
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- Trigger: Registrar cambios en historial
CREATE OR REPLACE FUNCTION log_feature_flag_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log de habilitado
  IF OLD.habilitado IS DISTINCT FROM NEW.habilitado THEN
    INSERT INTO public.feature_flag_history (flag_id, campo, valor_anterior, valor_nuevo, modificado_por)
    VALUES (NEW.id, 'habilitado', OLD.habilitado::text, NEW.habilitado::text, COALESCE(NEW.modificado_por, 'system'));
  END IF;
  
  -- Log de porcentaje_rollout
  IF OLD.porcentaje_rollout IS DISTINCT FROM NEW.porcentaje_rollout THEN
    INSERT INTO public.feature_flag_history (flag_id, campo, valor_anterior, valor_nuevo, modificado_por)
    VALUES (NEW.id, 'porcentaje_rollout', OLD.porcentaje_rollout::text, NEW.porcentaje_rollout::text, COALESCE(NEW.modificado_por, 'system'));
  END IF;
  
  -- Log de estrategia
  IF OLD.estrategia IS DISTINCT FROM NEW.estrategia THEN
    INSERT INTO public.feature_flag_history (flag_id, campo, valor_anterior, valor_nuevo, modificado_por)
    VALUES (NEW.id, 'estrategia', OLD.estrategia, NEW.estrategia, COALESCE(NEW.modificado_por, 'system'));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_feature_flag_changes
  AFTER UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION log_feature_flag_changes();

-- Trigger: Actualizar updated_at en variants
CREATE OR REPLACE FUNCTION update_feature_flag_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feature_flag_variants_updated_at
  BEFORE UPDATE ON public.feature_flag_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flag_variants_updated_at();

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_rollout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_variant_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas para feature_flags: solo admin puede modificar
CREATE POLICY "feature_flags_select"
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "feature_flags_insert_admin"
  ON public.feature_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants
      WHERE id = (auth.jwt() ->> 'tenant_id')::uuid
        AND rol = 'admin'
    )
  );

CREATE POLICY "feature_flags_update_admin"
  ON public.feature_flags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants
      WHERE id = (auth.jwt() ->> 'tenant_id')::uuid
        AND rol = 'admin'
    )
  );

CREATE POLICY "feature_flags_delete_admin"
  ON public.feature_flags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants
      WHERE id = (auth.jwt() ->> 'tenant_id')::uuid
        AND rol = 'admin'
    )
  );

-- Políticas para historial: solo lectura
CREATE POLICY "feature_flag_history_select"
  ON public.feature_flag_history
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Políticas para evaluaciones: insertar log, solo lectura
CREATE POLICY "feature_flag_evaluations_select"
  ON public.feature_flag_evaluations
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "feature_flag_evaluations_insert"
  ON public.feature_flag_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- ============================================================================
-- 9. ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================================================

-- Índice para búsquedas por estrategia y estado
CREATE INDEX idx_feature_flags_estrategia_habilitado 
  ON public.feature_flags(estrategia, habilitado);

-- Índice para búsquedas por fecha automática
CREATE INDEX idx_feature_flags_inicio_automatico 
  ON public.feature_flags(inicio_automatico) 
  WHERE inicio_automatico IS NOT NULL;

-- Índice para analytics de evaluaciones recientes
CREATE INDEX idx_feature_flag_evaluations_recientes 
  ON public.feature_flag_evaluations(created_at DESC) 
  WHERE created_at > NOW() - INTERVAL '7 days';

-- ============================================================================
-- 10. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE public.feature_flags IS 
'Sistema de Feature Flags con soporte para:
- Rollout gradual automático
- A/B testing con variantes
- Canary deployments
- Control por tenant/usuario
- Historial completo de cambios';

COMMENT ON COLUMN public.feature_flags.estrategia IS
'Estrategia de activación:
- boolean: simple on/off
- percentage: por porcentaje de usuarios (consistent hashing)
- tenants: lista de tenants permitidos
- user_ids: lista de usuarios específicos
- gradual: aumento automático de porcentaje (canary)';

COMMENT ON COLUMN public.feature_flags.porcentaje_rollout IS
'Porcentaje de usuarios que ven la feature (0-100).
Se usa consistent hashing del user_id para reproducibilidad.';

COMMENT ON COLUMN public.feature_flags.configuracion IS
'JSON flexible para parámetros específicos:
{
  "max_items": 100,
  "timeout_ms": 5000,
  "variant": "A",
  "custom_param": "value"
}';

-- ============================================================================
-- Fin de migración
-- ============================================================================
