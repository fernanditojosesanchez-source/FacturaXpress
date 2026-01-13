-- Migración: Agregar sistema de roles y controles de módulos

-- 1. Extender tabla users con nuevos campos
ALTER TABLE users
ADD COLUMN IF NOT EXISTS nombre TEXT,
ADD COLUMN IF NOT EXISTS sucursales_asignadas JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS modulos_habilitados JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 2. Actualizar columna role con nuevos valores válidos
ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'cashier';

-- 3. Agregar constraint de roles válidos
ALTER TABLE users
ADD CONSTRAINT valid_roles CHECK (
  role IN ('super_admin', 'tenant_admin', 'manager', 'cashier', 'accountant', 'sigma_readonly')
);

-- 4. Crear índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_activo ON users(activo);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 5. Agregar comentarios de documentación
COMMENT ON COLUMN users.role IS 'Roles disponibles: super_admin, tenant_admin, manager, cashier, accountant, sigma_readonly';
COMMENT ON COLUMN users.sucursales_asignadas IS 'Array JSON de UUIDs de sucursales. NULL = acceso a todas las sucursales';
COMMENT ON COLUMN users.modulos_habilitados IS 'JSON con módulos habilitados: inventario, facturacion, reportes, contabilidad, multi_sucursal. NULL = heredar de tenant.modules';

-- 6. Extender tabla tenants si no tiene el campo modules
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{}';

COMMENT ON COLUMN tenants.modules IS 'Feature flags por tenant: {"inventario": true, "facturacion": true, "reportes": true, "contabilidad": true, "multi_sucursal": true}';

-- 7. Crear tabla para auditoría de cambios de permisos
CREATE TABLE IF NOT EXISTS permission_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  changed_by VARCHAR REFERENCES users(id),
  role_anterior TEXT,
  role_nuevo TEXT,
  cambios JSONB, -- {"sucursales_asignadas": [...], "modulos_habilitados": {...}}
  razon TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_changes_user ON permission_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_changes_date ON permission_changes(created_at);
