# 👥 Sistema de Roles y Accesos - FacturaXpress

## 🎯 Concepto Clave: Dos Canales de Venta

### Cliente Directo
- Paga directamente a FacturaXpress
- Se registra en facturaxpress.com
- Factura desde la plataforma web
- Usa los módulos que su negocio necesita

### Cliente Sigma (Indirecto)
- Paga a Sigma (incluye facturación)
- **SÍ tiene tenant individual** en FacturaXpress
- **SÍ puede hacer login** al panel web
- Factura desde Sigma (integración API)
- **Acceso igual que cualquier cliente**, solo usa módulos relevantes
- Típicamente: consultorio médico (sin inventario, 1 sucursal)

---

## 👤 Roles Definidos

### 1️⃣ super_admin (Administrador SaaS)
**Perfil:** Empleado de FacturaXpress

**Funciones:**
- Gestionar todas las empresas (clientes directos + Sigma)
- Ver métricas globales del sistema
- Configurar planes y suscripciones
- Activar/suspender empresas
- Gestionar integración con Sigma

**Restricciones:**
- ❌ NO puede ver contenido de facturas (privacidad)
- ❌ NO opera dentro de los tenants

---

### 2️⃣ tenant_admin (Administrador de Empresa)
**Perfil:** Dueño o gerente general de cualquier negocio

**Funciones (TODOS los clientes):**
- ✅ Configurar datos de la empresa
- ✅ **Gestionar usuarios y asignar roles**
- ✅ Crear/editar productos (si su negocio los necesita)
- ✅ Gestionar inventario (si maneja stock)
- ✅ Crear sucursales (si tiene múltiples locales)
- ✅ Configurar credenciales de Hacienda
- ✅ Crear facturas (desde web o API según prefiera)
- ✅ Ver todos los reportes y dashboard
- ✅ Descargar libros contables
- ✅ Exportar datos

**Diferencias por tipo de negocio:**

| Módulo | Ferretería | Farmacia | Médico Sigma | Restaurante |
|--------|-----------|----------|--------------|-------------|
| Inventario | ✅ Usa | ✅ Usa | ⚪ No usa | ✅ Usa |
| Sucursales | ✅ 3 locales | ✅ 2 locales | ⚪ 1 (consultorio) | ✅ Usa |
| Facturación Web | ✅ Manual | ✅ Manual | ⚪ API desde Sigma | ✅ Manual |
| Reportes | ✅ Usa | ✅ Usa | ✅ Usa | ✅ Usa |
| Usuarios | ✅ Varios | ✅ Varios | ⚪ Solo contador | ✅ Varios |

**Nota:** NO es restricción de permisos, es configuración según necesidades del negocio

---

### 3️⃣ manager (Gerente de Sucursal)
**Perfil:** Encargado de punto de venta

#### Para Cliente Directo:
**Funciones:**
- ✅ Facturar en su sucursal
- ✅ Ver/gestionar inventario de su sucursal
- ✅ Solicitar traslados entre sucursales
- ✅ Ver reportes de su sucursal
- ❌ NO ve otras sucursales
- ❌ NO puede configurar empresa

#### Para Cliente Sigma:
- ⚠️ Generalmente NO se usa (médicos trabajan solos)

---

### 4️⃣ cashier (Cajero/Facturador)
**Perfil:** Personal de caja

#### Para Cliente Directo:
**Funciones:**
- ✅ Crear facturas
- ✅ Consultar productos y precios
- ✅ Ver stock (solo lectura)
- ✅ Anular facturas (con aprobación)
- ❌ NO edita productos
- ❌ NO ve reportes financieros

#### Para Cliente Sigma:
- ⚠️ NO se usa (facturación solo desde Sigma)

---

### 5️⃣ accountant (Contador) ⭐ NUEVO
**Perfil:** Contador externo o interno

**Funciones:**
- ✅ Ver todas las facturas emitidas
- ✅ Ver reportes financieros completos
- ✅ **Descargar Libro de IVA** (mensual/anual)
- ✅ **Descargar Libro de Compras**
- ✅ **Descargar Libro Diario**
- ✅ Exportar datos a Excel/CSV
- ✅ Dashboard financiero (ingresos, IVA, retenciones)
- ❌ NO crea/edita facturas
- ❌ NO anula facturas
- ❌ NO gestiona productos/inventario

**Casos de Uso:**
- ✅ **Clientes Sigma:** Principal rol usado (médico asigna a su contador)
- ✅ **Clientes Directos:** Empresas que externalizan contabilidad

---

### 6️⃣ sigma_readonly (Usuario Sigma Básico) ⭐ NUEVO
**Perfil:** Médico o recepcionista que solo consulta

**Funciones:**
- ✅ Ver historial de facturas
- ✅ Buscar por fecha/paciente/número
- ✅ Descargar PDF individual
- ✅ Ver estado DTE (procesado, rechazado, anulado)
- ❌ NO descarga libros contables
- ❌ NO ve reportes financieros
- ❌ NO crea facturas

**Caso de Uso:**
- Médico quiere revisar rápido si una factura se envió
- Recepcionista busca factura de un paciente
- Consulta sin acceso a datos financieros sensibles

---
 | manager | cashier | accountant | sigma_readonly |
|---------------|-------------|--------------|---------|---------|------------|----------------|
| **Dashboard Completo** | 📊 Global | ✅ | ✅ Sucursal | Básico | 💰 Financiero | Básico |
| **Crear Factura Manual** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Ver Historial Facturas** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Descargar Libros Contables** | ✅ Admin | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Gestionar Inventario** | ❌ | ✅ | ✅ Sucursal | 👁️ Ver | ❌ | ❌ |
| **Reportes Financieros** | 📊 Global | ✅ | ✅ Sucursal | ❌ | ✅ | ❌ |
| **Gestionar Usuarios** | ✅ Todos | ✅ Su tenant | ❌ | ❌ | ❌ | ❌ |
| **Configuración Empresa** | ✅ Global | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Gestionar Sucursales** | ✅ Admin | ✅ | 👁️ Ver | ❌ | ❌ | ❌ |
| **Anular Facturas** | ❌ | ✅ | ✅ | ⚠️ Aprobación | ❌ | ❌ |
| **Exportar Datos** | ✅ | ✅ | ✅ Sucursal | ❌ | ✅ | ❌ |
| **Configurar Credenciales MH** | ✅ Admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Ver Métricas SaaS** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Nota:** `tenant_admin` tiene los mismos permisos sin importar si paga directo o vía Sigma. La diferencia está en qué módulos usa cada negocio.ción | ❌ | ❌ |
| **Exportar Datos** | ✅ | ✅ | ✅ | ⚠️ Su sucursal | ❌ | ✅ | ❌ |
| **Configurar Credenciales MH** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Ver Métricas SaaS** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🔐 Implementación Técnica

### Schema Actualizado: `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Autenticación
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  
  -- Información personal
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  
  -- Rol del usuario
  role TEXT NOT NULL DEFAULT 'cashier',
  -- Roles disponibles:
  --   'super_admin'      - Administrador SaaS (FacturaXpress)
  --   'tenant_admin'     - Dueño/admin de la empresa
  --   'manager'          - Gerente de sucursal
  --   'cashier'          - Cajero/facturador
  --   'accountant'       - Contador (solo lectura + reportes)
  --   'sigma_readonly'   - Usuario Sigma básico (solo consulta)
  
  -- Restricciones por sucursal (para manager/cashier)
  sucursales_asignadas UUID[], -- Array de IDs de sucursales
  
  -- Metadatos
  ultimo_acceso TIMESTAMP,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CHECK (role IN ('super_admin', 'tenant_admin', 'manager', 
                  'cashier', 'accountant', 'sigma_readonly'))
);

-- Índices
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);
```

### Middleware de Permisos

```typescript
// server/auth.ts

export const checkPermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // Del JWT
    
    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    
    const permissions = getPermissionsByRole(user.role, user.tenant);
    
    if (!permissions.includes(requiredPermission)) {
      return res.status(403).json({ error: "Sin permisos suficientes" });
    }
    
    next();
  };
};) {
  // NO depende de origen (Sigma vs Directo)
  // Todos los tenant_admin tienen los mismos permisos
  
  switch (role) {
    case 'super_admin':
      return [
        'manage_all_tenants', 'view_global_metrics', 'manage_plans',
        'configure_integrations', 'view_all_logs'
      ];
    
    case 'tenant_admin':
      // TODOS tienen acceso completo (médico, ferretero, farmacia)
      return [
        'create_invoice', 'view_invoices', 'cancel_invoice',
        'manage_inventory', 'manage_products', 'manage_branches',
        'manage_users', 'assign_roles',
        'view_reports', 'download_books', 'export_data',
        'configure_company', 'configure_mh_credentials',
        'view_dashboard'
      ];
    
    case 'manager':
      return [
        'create_invoice', 'view_invoices', 'cancel_invoice',
        'view_inventory_branch', 'request_transfers',
        'view_reports_branch', 'view_dashboard_branch'
      ];
    
    case 'cashier':
      return [
        'create_invoice', 'view_invoices',
        'view_stock', 'search_products'
      ];
    
    case 'accountant':
      return [
        'view_invoiCualquier rol con permiso puede hacerlo
app.post("/api/facturas", 
  requireAuth,
  checkPermission('create_invoice'),
  async (req, res) => {
    // tenant_admin, manager, cashier pueden crear facturas
    // NO importa si es cliente directo o Sigma
    
    // Si viene de Sigma, probablemente use API
    // Pero si el médico quiere facturar manualmente desde web, puede hacerlo
    
    // Lógica de creación
  }
);

// Descargar libros - Accountant y tenant_admin
app.get("/api/reportes/libro-iva",
  requireAuth,
  checkPermission('download_books'),
  async (req, res) => {
    // tenant_admin y accountant pueden descargar
    // Sin importar origen del tenant
  checkPermission('create_invoice'),
  async (req, res) => {
    // Si es tenant de Sigma, este endpoint está bloqueado
    if (req.user.tenant.origen === 'sigma') {
      return res.status(403).json({ 
        error: "Las facturas se crean desde Sigma" 
      });
    }
    
    // Lógica de creación
  }
);

// Descargar libros - Accountant y tenant_admin
app.get("/api/reportes/libro-iva",
  requireAuth,
  checkPermission('download_books'),
  async (req, res) => {
    // Todos los roles con este permiso pueden acceder
    // (tenant_admin y accountant)
  }
);
```

---

## 🎬 Flujos de Usuario

### Flujo 1: Dr. Juan (Cliente Sigma)

**Setup Inicial (Hecho por Sigma):**
1. Sigma crea tenant en FacturaXpress vía API
2. Configura credenciales de Hacienda del Dr. Juan
3. Crea usuario: `dr-juan@example.com` con rol `tenant_admin` (limitado)

**Día a Día:**
```
08:00 - Dr. Juan en Sigma
  ↓ Registra paciente María López
  ↓ Selecciona servicio: Consulta - $25
  ↓ Click "Facturar"
  
  → Sigma envía a FacturaXpress API
  → FacturaXpress genera DTE
  → Envía a Hacienda
  → Devuelve resultado a Sigma
  
  ✅ Dr. Juan ve confirmación en Sigma
```

**Fin de Mes:**
```
31/01 - Contador del Dr. Juan necesita declarar IVA
  
  1. Entra a facturaxpress.com
  2. Login: contador@drjuan.com (rol: accountant)
  3. Ve dashboard: "28 facturas, $700 total, $91 IVA"
  4. Click "Descargar Libro IVA - Enero 2026"
  5. Descarga Excel
  6. Usa para declaración mensual
```

---

### Flujo 2: Farmacia "La Salud" (Cliente Directo)

**Setup Inicial:**
1. Dueño se registra en facturaxpress.com
2. Escoge Plan Profesional
3. Configura: productos, usuarios, credenciales MH

**Día a Día:**
```
09:00 - Cajera María (rol: cashier)
  ↓ Login en FacturaXpress
  ↓ Cliente compra: Paracetamol x2
  ↓ Click "Nueva Factura"
  ↓ Busca producto, añade
  ↓ Sistema descuenta inventario
  ↓ Genera factura
  
  ✅ ClArquitectura Final:

1. **Todos los clientes tienen tenant** (médico, ferretería, farmacia)
2. **Todos pueden hacer login** con las mismas capacidades
3. **tenant_admin gestiona su equipo** (asigna roles según necesite)
4. **6 roles disponibles** para cualquier tipo de negocio
5. **Panel Super Admin** distingue origen para estadísticas

### 🎯 Flujo por Tipo de Negocio:

```
Ferretería (Cliente Directo):
  └─ tenant_admin (dueño)
      ├─ Usa: Inventario ✅, Sucursales ✅, Facturación Web ✅
      └─ Asigna roles:
          ├─ manager (encargado sucursal 1)
          ├─ manager (encargado sucursal 2)
          └─ cashier (cajeros)

Médico (Cliente Sigma):
  └─ tenant_admin (Dr. Juan)
      ├─ Usa: Reportes ✅, Libros ✅, Dashboard ✅
      ├─ NO usa: Inventario (no aplica), Sucursales (solo 1)
      ├─ Factura desde Sigma (API)
      └─ Asigna roles:
          ├─ accountant (su contador)
          └─ sigma_readonly (recepcionista para consultas)
```

### 🔑 Diferencia Clave:

**NO es restricción de permisos.**
**ES configuración según necesidades del negocio.**

- Ferretería: Configura productos, inventario, múltiples sucursales
- Médico: Solo necesita ver reportes, su contador descarga libros
- Ambos tienen `tenant_admin` con los mismos permisos técnicos
- La diferencia está en qué módulos usa cada uno

```
Cliente Directo:
  Empresa → Paga a FacturaXpress → Usa 100% de funciones

Cliente Sigma:
  Médico → Paga a Sigma → Factura en Sigma
                       → Login opcional en FacturaXpress
                       → Solo reportes y descargas
                       → Su contador accede y descarga libros
```

### 🔑 Diferencia Clave:

**NO es sobre "tener cuenta" o "no tener cuenta".**
**ES sobre: nivel de acceso según cómo llegó el cliente.**

- Cliente directo = Acceso completo
- Cliente Sigma = Acceso limitado (reportes/descargas)
