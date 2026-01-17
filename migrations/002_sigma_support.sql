-- =============================================
-- SIGMA SUPPORT - Migraciones
-- Vista de soporte con logs PII-safe
-- =============================================

-- Tabla de accesos temporales para soporte
CREATE TABLE IF NOT EXISTS sigma_support_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificación
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    support_user_id VARCHAR(255) NOT NULL,
    support_user_name VARCHAR(255) NOT NULL,
    support_email VARCHAR(255) NOT NULL,
    
    -- Tipo de acceso: readonly, readwrite, fullaccess
    tipo_acceso VARCHAR(20) NOT NULL,
    
    -- Permisos granulares
    can_view_logs BOOLEAN DEFAULT TRUE,
    can_view_metrics BOOLEAN DEFAULT TRUE,
    can_view_audit BOOLEAN DEFAULT TRUE,
    can_export_data BOOLEAN DEFAULT FALSE,
    
    -- Control temporal
    activo BOOLEAN DEFAULT TRUE,
    fecha_inicio TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMP NOT NULL, -- Auto-calculado (7 días por defecto)
    
    -- Razón y auditoría
    razon TEXT NOT NULL,
    otorgado_por VARCHAR(255) NOT NULL,
    revocado_por VARCHAR(255),
    fecha_revocacion TIMESTAMP,
    motivo_revocacion TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_tipo_acceso_valido CHECK (tipo_acceso IN ('readonly', 'readwrite', 'fullaccess')),
    CONSTRAINT chk_fecha_fin_posterior CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX idx_sigma_access_tenant ON sigma_support_access(tenant_id);
CREATE INDEX idx_sigma_access_support_user ON sigma_support_access(support_user_id);
CREATE INDEX idx_sigma_access_activo ON sigma_support_access(activo);
CREATE INDEX idx_sigma_access_fecha_fin ON sigma_support_access(fecha_fin);
CREATE INDEX idx_sigma_access_tenant_activo ON sigma_support_access(tenant_id, activo);

-- Tabla de logs (PII-SAFE: solo resourceId UUID)
CREATE TABLE IF NOT EXISTS sigma_support_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificación
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    support_user_id VARCHAR(255) NOT NULL,
    support_user_name VARCHAR(255) NOT NULL,
    
    -- Acción registrada (sin PII)
    accion VARCHAR(100) NOT NULL,
    recurso VARCHAR(100) NOT NULL, -- patient, invoice, report, etc.
    resource_id UUID NOT NULL, -- ⚠️ SOLO UUID, NUNCA nombres o emails
    
    -- Resultado
    exitoso BOOLEAN NOT NULL DEFAULT TRUE,
    error_msg TEXT,
    
    -- Contexto
    detalles JSONB, -- Datos técnicos sin PII
    
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_resource_id_is_uuid CHECK (
        resource_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
);

CREATE INDEX idx_sigma_logs_tenant ON sigma_support_logs(tenant_id);
CREATE INDEX idx_sigma_logs_support_user ON sigma_support_logs(support_user_id);
CREATE INDEX idx_sigma_logs_accion ON sigma_support_logs(accion);
CREATE INDEX idx_sigma_logs_timestamp ON sigma_support_logs(timestamp DESC);
CREATE INDEX idx_sigma_logs_exitoso ON sigma_support_logs(exitoso);
CREATE INDEX idx_sigma_logs_tenant_timestamp ON sigma_support_logs(tenant_id, timestamp DESC);

-- Tabla de métricas por tenant
CREATE TABLE IF NOT EXISTS sigma_support_metricas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Periodo de la métrica
    fecha DATE NOT NULL,
    periodo VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    
    -- Métricas agregadas
    total_facturas INTEGER DEFAULT 0,
    total_usuarios INTEGER DEFAULT 0,
    total_errores INTEGER DEFAULT 0,
    total_warnings INTEGER DEFAULT 0,
    
    -- Accesos de soporte
    accesos_soporte INTEGER DEFAULT 0,
    logs_generados INTEGER DEFAULT 0,
    
    -- Performance
    tiempo_respuesta_promedio_ms INTEGER,
    uptime_percentage DECIMAL(5,2),
    
    -- Tendencias
    tendencia VARCHAR(20), -- up, down, stable
    alertas JSONB, -- Alertas específicas del periodo
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_periodo_valido CHECK (periodo IN ('daily', 'weekly', 'monthly')),
    CONSTRAINT chk_tendencia_valida CHECK (tendencia IS NULL OR tendencia IN ('up', 'down', 'stable')),
    CONSTRAINT chk_uptime_valido CHECK (uptime_percentage IS NULL OR (uptime_percentage >= 0 AND uptime_percentage <= 100))
);

CREATE INDEX idx_sigma_metricas_tenant ON sigma_support_metricas(tenant_id);
CREATE INDEX idx_sigma_metricas_fecha ON sigma_support_metricas(fecha DESC);
CREATE INDEX idx_sigma_metricas_periodo ON sigma_support_metricas(periodo);
CREATE INDEX idx_sigma_metricas_tenant_fecha ON sigma_support_metricas(tenant_id, fecha DESC);
CREATE UNIQUE INDEX idx_sigma_metricas_unique ON sigma_support_metricas(tenant_id, fecha, periodo);

-- Tabla de tickets de soporte
CREATE TABLE IF NOT EXISTS sigma_support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identificación
    numero_ticket VARCHAR(50) NOT NULL UNIQUE,
    
    -- Contenido
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    
    -- Severidad: baja, normal, alta, critica
    severidad VARCHAR(20) NOT NULL,
    
    -- Estado: abierto, en_progreso, resuelto, cerrado
    estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
    
    -- Asignación
    creado_por VARCHAR(255) NOT NULL,
    asignado_a VARCHAR(255),
    
    -- Resolución
    solucion TEXT,
    fecha_resolucion TIMESTAMP,
    resuelto_por VARCHAR(255),
    
    -- Auditoría
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_severidad_valida CHECK (severidad IN ('baja', 'normal', 'alta', 'critica')),
    CONSTRAINT chk_estado_valido CHECK (estado IN ('abierto', 'en_progreso', 'resuelto', 'cerrado'))
);

CREATE INDEX idx_sigma_tickets_tenant ON sigma_support_tickets(tenant_id);
CREATE INDEX idx_sigma_tickets_numero ON sigma_support_tickets(numero_ticket);
CREATE INDEX idx_sigma_tickets_estado ON sigma_support_tickets(estado);
CREATE INDEX idx_sigma_tickets_severidad ON sigma_support_tickets(severidad);
CREATE INDEX idx_sigma_tickets_created ON sigma_support_tickets(created_at DESC);
CREATE INDEX idx_sigma_tickets_tenant_estado ON sigma_support_tickets(tenant_id, estado);
CREATE INDEX idx_sigma_tickets_asignado ON sigma_support_tickets(asignado_a);

-- Trigger para actualizar updated_at en tickets
CREATE OR REPLACE FUNCTION update_sigma_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sigma_tickets_updated_at
    BEFORE UPDATE ON sigma_support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_sigma_tickets_updated_at();

-- Función para auto-revocar accesos expirados
CREATE OR REPLACE FUNCTION auto_revoke_expired_support_access()
RETURNS void AS $$
BEGIN
    UPDATE sigma_support_access
    SET activo = FALSE,
        fecha_revocacion = NOW(),
        revocado_por = 'system',
        motivo_revocacion = 'Expiración automática'
    WHERE activo = TRUE
      AND fecha_fin < NOW();
END;
$$ LANGUAGE plpgsql;

-- Job para ejecutar la revocación automática (ejecutar manualmente o configurar cron)
-- SELECT cron.schedule('auto-revoke-support', '0 */6 * * *', 'SELECT auto_revoke_expired_support_access()');

-- Comentarios para documentación
COMMENT ON TABLE sigma_support_access IS 'Accesos temporales del equipo de soporte con auto-revoke';
COMMENT ON TABLE sigma_support_logs IS '⚠️ PII-SAFE: Logs con resourceId UUID solamente, NO datos personales';
COMMENT ON COLUMN sigma_support_logs.resource_id IS '⚠️ CRÍTICO: Solo UUID válido, NUNCA nombres/emails/datos personales';
COMMENT ON TABLE sigma_support_metricas IS 'Métricas agregadas por tenant para monitoreo de salud';
COMMENT ON TABLE sigma_support_tickets IS 'Sistema de tickets de soporte con severidades';

-- Grants (opcional, ajustar según necesidad)
-- GRANT SELECT ON sigma_support_access TO support_role;
-- GRANT SELECT, INSERT ON sigma_support_logs TO support_role;
-- GRANT SELECT ON sigma_support_metricas TO support_role;
-- GRANT SELECT, INSERT, UPDATE ON sigma_support_tickets TO support_role;
