-- =============================================
-- STOCK EN TRÁNSITO - Migraciones
-- Seguimiento de stock moviéndose entre sucursales
-- =============================================

-- Tabla principal: Movimientos de stock
CREATE TABLE IF NOT EXISTS stock_transito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identificación del movimiento
    numero_movimiento VARCHAR(50) NOT NULL,
    referencia VARCHAR(100),
    
    -- Origen y destino
    sucursal_origen VARCHAR(50) NOT NULL,
    sucursal_destino VARCHAR(50) NOT NULL,
    
    -- Producto
    producto_id UUID NOT NULL,
    codigo_producto VARCHAR(100) NOT NULL,
    nombre_producto VARCHAR(255) NOT NULL,
    
    -- Cantidades
    cantidad_enviada INTEGER NOT NULL,
    cantidad_recibida INTEGER DEFAULT 0,
    cantidad_devuelta INTEGER DEFAULT 0,
    
    -- Estados: pendiente, enviado, en_transporte, recibido, parcial, devuelto, cancelado
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    
    -- Fechas
    fecha_envio TIMESTAMP,
    fecha_esperada_entrega TIMESTAMP,
    fecha_recepcion TIMESTAMP,
    
    -- Detalles de transporte
    transportista VARCHAR(100),
    numero_guia VARCHAR(100),
    costo_transporte DECIMAL(12,2),
    
    -- Observaciones
    observaciones TEXT,
    motivo_devolucion TEXT,
    
    -- Auditoría
    creado_por VARCHAR(255),
    modificado_por VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_cantidad_enviada_positiva CHECK (cantidad_enviada > 0),
    CONSTRAINT chk_sucursales_diferentes CHECK (sucursal_origen != sucursal_destino),
    CONSTRAINT chk_estado_valido CHECK (estado IN ('pendiente', 'enviado', 'en_transporte', 'recibido', 'parcial', 'devuelto', 'cancelado'))
);

-- Índices para consultas comunes
CREATE INDEX idx_stock_transito_tenant ON stock_transito(tenant_id);
CREATE INDEX idx_stock_transito_estado ON stock_transito(estado);
CREATE INDEX idx_stock_transito_numero ON stock_transito(numero_movimiento);
CREATE INDEX idx_stock_transito_origen ON stock_transito(sucursal_origen);
CREATE INDEX idx_stock_transito_destino ON stock_transito(sucursal_destino);
CREATE INDEX idx_stock_transito_producto ON stock_transito(producto_id);
CREATE INDEX idx_stock_transito_fecha_envio ON stock_transito(fecha_envio);
CREATE INDEX idx_stock_transito_created ON stock_transito(created_at DESC);
CREATE INDEX idx_stock_transito_tenant_estado ON stock_transito(tenant_id, estado);
CREATE INDEX idx_stock_transito_tenant_created ON stock_transito(tenant_id, created_at DESC);

-- Tabla de detalles: Lotes y series
CREATE TABLE IF NOT EXISTS stock_transito_detalles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_id UUID NOT NULL REFERENCES stock_transito(id) ON DELETE CASCADE,
    
    -- Identificación del lote/serie
    numero_lote VARCHAR(100),
    numero_serie VARCHAR(100),
    fecha_vencimiento DATE,
    fecha_fabricacion DATE,
    
    -- Cantidades por lote
    cantidad_enviada INTEGER NOT NULL,
    cantidad_recibida INTEGER DEFAULT 0,
    
    -- Inspección en recepción
    inspeccion VARCHAR(20), -- aprobado, rechazado, parcial
    observaciones_inspeccion TEXT,
    inspeccionado_por VARCHAR(255),
    fecha_inspeccion TIMESTAMP,
    
    -- Ubicación física
    ubicacion_origen VARCHAR(100),
    ubicacion_destino VARCHAR(100),
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_cantidad_detalle_positiva CHECK (cantidad_enviada > 0),
    CONSTRAINT chk_inspeccion_valida CHECK (inspeccion IS NULL OR inspeccion IN ('aprobado', 'rechazado', 'parcial'))
);

CREATE INDEX idx_stock_transito_detalles_movimiento ON stock_transito_detalles(movimiento_id);
CREATE INDEX idx_stock_transito_detalles_lote ON stock_transito_detalles(numero_lote);
CREATE INDEX idx_stock_transito_detalles_serie ON stock_transito_detalles(numero_serie);
CREATE INDEX idx_stock_transito_detalles_vencimiento ON stock_transito_detalles(fecha_vencimiento);

-- Tabla de historial: Auditoría de eventos
CREATE TABLE IF NOT EXISTS stock_transito_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_id UUID NOT NULL REFERENCES stock_transito(id) ON DELETE CASCADE,
    
    -- Evento registrado
    evento VARCHAR(50) NOT NULL, -- creado, enviado, recibido, devuelto, cancelado, nota_agregada
    descripcion TEXT,
    
    -- Ubicación y contexto
    ubicacion VARCHAR(100),
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    
    -- Evidencia (fotos, documentos)
    evidencia JSONB,
    
    -- Auditoría
    registrado_por VARCHAR(255) NOT NULL,
    fecha_evento TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_evento_valido CHECK (evento IN ('creado', 'enviado', 'en_transporte', 'recibido', 'devuelto', 'cancelado', 'nota_agregada', 'inspeccion_realizada'))
);

CREATE INDEX idx_stock_transito_historial_movimiento ON stock_transito_historial(movimiento_id);
CREATE INDEX idx_stock_transito_historial_evento ON stock_transito_historial(evento);
CREATE INDEX idx_stock_transito_historial_fecha ON stock_transito_historial(fecha_evento DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_stock_transito_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_transito_updated_at
    BEFORE UPDATE ON stock_transito
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_transito_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE stock_transito IS 'Movimientos de stock entre sucursales con seguimiento completo';
COMMENT ON COLUMN stock_transito.numero_movimiento IS 'Número único del movimiento (MOV-timestamp-random)';
COMMENT ON COLUMN stock_transito.estado IS 'Estado actual: pendiente, enviado, en_transporte, recibido, parcial, devuelto, cancelado';
COMMENT ON TABLE stock_transito_detalles IS 'Detalles por lote/serie de cada movimiento';
COMMENT ON TABLE stock_transito_historial IS 'Auditoría completa de eventos del movimiento';

-- Grants (opcional, ajustar según necesidad)
-- GRANT SELECT, INSERT, UPDATE ON stock_transito TO authenticated;
-- GRANT SELECT, INSERT ON stock_transito_detalles TO authenticated;
-- GRANT SELECT, INSERT ON stock_transito_historial TO authenticated;
