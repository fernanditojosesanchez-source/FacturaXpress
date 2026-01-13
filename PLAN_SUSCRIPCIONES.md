# 💳 Plan de Sistema de Suscripciones y Facturación

## 🎯 Modelo de Negocio

FacturaXpress opera con **2 canales de distribución:**

### 1. **Venta Directa (B2C)** - Clientes Suscriben Directamente
- Empresas/clínicas que crean su cuenta en FacturaXpress
- Pagan mensualmente según su plan
- Acceso completo a la plataforma web
- 3 planes disponibles: Básico, Profesional, Empresarial

### 2. **Canal Sigma (B2B)** - Integración con Acceso Limitado
- Médicos usan ERP Sigma como interfaz principal
- Sigma paga a FacturaXpress por volumen de facturas
- **PERO cada médico SÍ tiene su propio tenant en FacturaXpress**
- Pueden acceder con login a un **panel simplificado** para:
  - Ver reportes contables
  - Descargar libros de IVA
  - Consultar historial de facturas
  - Generar reportes para contador
- **NO pueden** crear facturas manualmente (solo desde Sigma)
- **NO tienen** acceso a inventario ni configuración avanzada

---

## 🔌 Canal Especial: Integración con Sigma ERP

### ⚠️ IMPORTANTE: Flujo Correcto del Negocio

**Los médicos son clientes indirectos con acceso limitado.**

#### Flujo de Integración Completo:
```
┌─────────────────────────────────────────────────┐
│  MÉDICO/CLÍNICA                                 │
│  1. Paga suscripción a Sigma ERP                │
│  2. Usa Sigma para gestionar pacientes          │
│  3. Genera facturas desde interfaz Sigma        │
│  4. PUEDE acceder a FacturaXpress con login     │
│  5. Ve panel simplificado (reportes/descargas)  │
└──────────────────┬────────────────┬─────────────┘
                   │                │
                   │ Facturación    │ Reportes
                   ▼                ▼
┌─────────────────────────────────────────────────┐
│  FACTURAXPRESS                                  │
│  • Tiene tenant individual por médico           │
│  • Recibe facturas vía API desde Sigma          │
│  • Permite login web para reportes              │
│  • Acceso limitado (no facturación manual)      │
└──────────────────┬──────────────────────────────┘
                   │ API REST
                   ▼
┌─────────────────────────────────────────────────┐
│  SIGMA ERP (Cliente B2B de FacturaXpress)       │
│  • Tiene contrato comercial con FacturaXpress   │
│  • Paga por volumen de facturas generadas       │
│  • Envía datos vía API a FacturaXpress          │
│  • Incluye costo de facturación en sus planes   │
│  • Configura credenciales MH por cada médico    │
└─────────────────────────────────────────────────┘
```

### 💡 Casos de Uso Reales

#### Caso 1: Dr. Juan Pérez (Usuario de Sigma)

**Día a día:**
1. **En Sigma** (Interfaz Principal):
   - Registra paciente: María López
   - Selecciona servicio: Consulta General - $25
   - Hace clic en "Facturar" → Sigma envía a FacturaXpress vía API
   - Paciente recibe factura electrónica

2. **En FacturaXpress** (Panel Simplificado):
   - Su contador entra con login
   - Ve dashboard: "15 facturas este mes, $1,250 total"
   - Descarga: Libro de IVA de diciembre
   - Exporta: Reporte para declaración mensual
   - **NO puede** crear facturas nuevas (botón deshabilitado)
   - **NO ve** sección de inventario

#### Caso 2: Farmacia "La Salud" (Cliente Directo)

**Día a día:**
1. **Solo en FacturaXpress** (Panel Completo):
   - Registra venta en caja
   - Sistema descuenta inventario automáticamente
   - Genera factura desde la plataforma
   - Configura usuarios, sucursales, productos
   - Acceso completo a todas las funcionalidades

### 💰 Modelo de Facturación con Sigma

**Sigma paga a FacturaXpress:**
- Tarifa por volumen: $X por cada 1,000 facturas
- O plan mensual según volumen proyectado
- Sigma incluye este costo en sus planes

**Los médicos:**
- Pagan SOLO a Sigma (incluye todo: ERP + facturación)
- NO tienen acceso a FacturaXpress
- NO aparecen en panel de super admin
- Facturan desde la interfaz de Sigma

### 🔐 Autenticación y Gestión de Tenants

Cuando Sigma envía una factura:
```typescript
POST /api/sigma/facturas
Headers:
  X-Sigma-API-Key: "clave_maestra_comercial"
  X-Sigma-Medico-ID: "medico-12345"

Body: {
  "medico": {
    "nit": "0614-123456-123-4",
    "nombre": "Dr. Juan Pérez"
  },
  "paciente": {...},
  "servicios": [...]
}

// FacturaXpress:
1. Valida API Key de Sigma (no del médico)
2. Crea/usa tenant interno con tag "sigma:medico-12345"
3. Genera factura
4. Envía a Hacienda
5. Retorna a Sigma
```

**Los médicos NUNCA:**
- ❌ Crean cuenta en FacturaXpress
- ❌ Acceden al panel web
- ❌ Configuran credenciales de Hacienda (Sigma lo hace)
- ❌ Ven el branding de FacturaXpress

### 📊 Comparación de Canales

| Aspecto | Cliente Directo | Canal Sigma |
|---------|----------------|-------------|
| **¿Quién paga?** | La empresa directamente | Sigma (incluido en su plan) |
| **Acceso** | Panel web completo | Solo desde Sigma (API) |
| **Soporte** | FacturaXpress | Sigma atiende al médico |
| **Configuración** | Usuario configura | Sigma gestiona todo |
| **Branding** | "FacturaXpress" visible | Invisible (white-label) |
| **Gestión** | Super Admin ve tenant | NO aparece en super admin |

---

## 📊 Estructura de Planes (Solo para Clientes Directos)

### 1️⃣ **Plan Básico** - $29/mes ($290/año con descuento)
**Ideal para:** Pequeños negocios que solo necesitan facturación electrónica

**Características:**
- ✅ Facturación electrónica ilimitada
- ✅ 1 usuario principal
- ✅ Conexión con Ministerio de Hacienda
- ✅ Reportes básicos (últimos 30 días)
- ✅ Gestión de clientes (receptores)
- ❌ Sin inventario
- ❌ Sin usuarios adicionales
- ❌ Sin API externa

**Límites:**
- Max usuarios: 1
- Max facturas/mes: Ilimitadas
- Retención de datos: 1 año

---

### 2️⃣ **Plan Profesional** - $79/mes ($790/año con descuento)
**Ideal para:** Negocios en crecimiento con inventario

**Características:**
- ✅ Todo lo del plan Básico
- ✅ **Módulo de Inventario completo**
  - Control de stock en tiempo real
  - Alertas de productos bajos
  - Valoración de inventario (PEPS, Promedio)
- ✅ Hasta 5 usuarios con roles
- ✅ Reportes avanzados (sin límite de tiempo)
- ✅ Productos y servicios ilimitados
- ✅ **Multi-sucursal (hasta 3 sucursales)**
  - Inventario independiente por sucursal
  - Reportes consolidados y por sucursal
  - Traslado de productos entre sucursales
- ✅ Soporte prioritario (email + chat)

**Límites:**
- Max usuarios: 5
- Max sucursales: 3
- Retención de datos: Ilimitada

---

### 3️⃣ **Plan Empresarial** - $199/mes ($1990/año con descuento)
**Ideal para:** Empresas grandes con necesidades avanzadas

**Características:**
- ✅ Todo lo del plan Profesional
- ✅ **Usuarios ilimitados**
- ✅ **Multi-sucursal ilimitado**
  - Gestión de red de sucursales
  - Transferencias automáticas de inventario
  - Consolidación financiera multi-sucursal
- ✅ Dashboard ejecutivo con KPIs
- ✅ Integración con contabilidad
- ✅ Firma electrónica avanzada
- ✅ Backup automático diario
- ✅ Soporte 24/7 (teléfono + WhatsApp)
- ✅ Capacitación mensual incluida

**Límites:**
- Max usuarios: Ilimitados
- Max sucursales: Ilimitadas
- Retención de datos: Ilimitada + backups

---

---

## 🔌 Add-on: Integración Sigma ERP (GRATIS)
**Disponible para:** Todos los planes

**Características:**
- ✅ **API REST completa**
  - Endpoints para crear DTEs desde Sigma
  - Webhook de notificaciones en tiempo real
  - Consulta de estado de facturas
- ✅ Facturación ilimitada desde Sigma
- ✅ Documentación técnica completa
- ✅ Tokens de autenticación renovables
- ✅ Ambiente de pruebas (sandbox)
- ✅ Se activa automáticamente al conectar Sigma
- ⚠️ Inventario manejado desde Sigma (no en FacturaXpress)

**¿Por qué es gratis?**
Porque el costo ya está incluido en el plan base de cada clínica. Sigma solo actúa como puente para enviar las facturas.

**Límites:**
- API calls: 50,000/mes (suficiente para cualquier clínica)
- Si excede: sin costo adicional, solo throttling
- Retención de datos: según plan activo

---

---

## 🏢 Lógica de Multi-Sucursal (Sistema Completo)

### 🎯 Concepto General

El sistema multi-sucursal permite que una empresa gestione **múltiples puntos de venta o bodegas** desde una sola cuenta, con inventarios independientes pero consolidados.

---

### 📊 Arquitectura de Base de Datos

#### Tabla: `sucursales`
```sql
CREATE TABLE sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, -- "Sucursal Centro", "Bodega Norte"
  codigo TEXT NOT NULL, -- "SUC-001", "BOD-002" (para facturas)
  tipo TEXT DEFAULT 'sucursal', -- 'sucursal', 'bodega', 'matriz'
  
  -- Información de contacto
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  responsable TEXT, -- Nombre del encargado
  
  -- Configuración
  es_matriz BOOLEAN DEFAULT false, -- Solo una matriz por tenant
  puede_facturar BOOLEAN DEFAULT true, -- Bodegas no facturan
  puede_transferir BOOLEAN DEFAULT true,
  activa BOOLEAN DEFAULT true,
  
  -- Metadata
  metadata JSONB, -- Horarios, coordenadas GPS, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabla: `inventario_sucursal`
```sql
CREATE TABLE inventario_sucursal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  
  -- Stock
  cantidad DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_minimo DECIMAL(10,2) DEFAULT 0, -- Alerta por sucursal
  stock_maximo DECIMAL(10,2),
  ubicacion TEXT, -- "Pasillo 3, Estante B" (opcional)
  
  -- Control
  ultima_actualizacion TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(producto_id, sucursal_id)
);
```

#### Tabla: `traslados_sucursal`
```sql
CREATE TABLE traslados_sucursal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Origen y destino
  sucursal_origen_id UUID REFERENCES sucursales(id),
  sucursal_destino_id UUID REFERENCES sucursales(id),
  
  -- Información del traslado
  numero_traslado TEXT UNIQUE, -- "TRA-2026-001"
  fecha_solicitud TIMESTAMP DEFAULT NOW(),
  fecha_envio TIMESTAMP,
  fecha_recepcion TIMESTAMP,
  
  -- Estado
  estado TEXT DEFAULT 'pendiente', 
  -- Estados: 'pendiente', 'en_transito', 'recibido', 'cancelado'
  
  -- Usuario que realiza el traslado
  solicitado_por UUID REFERENCES users(id),
  enviado_por UUID REFERENCES users(id),
  recibido_por UUID REFERENCES users(id),
  
  -- Datos
  observaciones TEXT,
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabla: `traslado_items`
```sql
CREATE TABLE traslado_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traslado_id UUID REFERENCES traslados_sucursal(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  
  cantidad_solicitada DECIMAL(10,2) NOT NULL,
  cantidad_enviada DECIMAL(10,2),
  cantidad_recibida DECIMAL(10,2),
  
  -- Valoración
  costo_unitario DECIMAL(10,2), -- Para valorizar el traslado
  
  observaciones TEXT, -- Ej: "Llegó dañado", "Faltante"
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 🔄 Flujos de Operación

#### 1️⃣ Creación de Sucursal
```typescript
// Usuario: tenant_admin
POST /api/sucursales
{
  "nombre": "Sucursal San Salvador Centro",
  "codigo": "SUC-SSC",
  "tipo": "sucursal",
  "direccion": "Calle Arce #123",
  "responsable": "Juan Pérez",
  "puede_facturar": true
}

// Backend:
1. Validar límite de sucursales según plan
   - Básico: 1 (solo matriz)
   - Profesional: 3
   - Empresarial: Ilimitado
2. Crear registro en tabla `sucursales`
3. Inicializar inventario vacío para esta sucursal
4. Asignar usuarios que pueden operar en esta sucursal
```

#### 2️⃣ Gestión de Inventario por Sucursal

**Al crear un producto nuevo:**
```typescript
POST /api/productos
{
  "nombre": "Laptop Dell XPS 15",
  "codigo": "LAP-DELL-001",
  "precio": 1200,
  "inventario_inicial": {
    "sucursal_matriz": 50,    // 50 unidades en matriz
    "sucursal_centro": 20,    // 20 en sucursal centro
    "sucursal_norte": 30      // 30 en sucursal norte
  }
}

// Backend:
1. Crear producto en tabla `productos`
2. Crear registros en `inventario_sucursal` para cada sucursal
3. Validar que la suma no exceda stock total (si aplica)
```

**Al vender un producto:**
```typescript
POST /api/facturas
{
  "sucursal_id": "uuid-sucursal-centro",
  "items": [
    { "producto_id": "uuid-laptop", "cantidad": 2 }
  ]
}

// Backend:
1. Validar stock disponible EN ESA SUCURSAL
2. Descontar de `inventario_sucursal` WHERE sucursal_id = 'centro'
3. Registrar venta con código de sucursal en factura
4. Si stock < stock_minimo → Enviar alerta al responsable
```

#### 3️⃣ Traslado de Productos entre Sucursales

**Escenario:** Sucursal Centro se queda sin laptops, pero Matriz tiene 50.

**Paso 1: Solicitar Traslado**
```typescript
// Usuario en Sucursal Centro
POST /api/traslados
{
  "sucursal_origen_id": "uuid-matriz",
  "sucursal_destino_id": "uuid-centro",
  "items": [
    { "producto_id": "uuid-laptop", "cantidad": 10 }
  ],
  "observaciones": "Stock bajo, necesito reabastecimiento"
}

// Backend:
1. Validar que origen tenga stock suficiente
2. Crear traslado con estado 'pendiente'
3. Notificar a responsable de sucursal origen
4. NO mover inventario todavía (solo reserva)
```

**Paso 2: Enviar Traslado**
```typescript
// Usuario en Matriz (origen)
PATCH /api/traslados/{id}/enviar
{
  "cantidad_real": 10, // Confirmación
  "fecha_envio": "2026-01-13T10:00:00"
}

// Backend:
1. Descontar de inventario_sucursal (matriz)
2. Cambiar estado a 'en_transito'
3. Registrar usuario que envió y fecha
4. Notificar a sucursal destino
```

**Paso 3: Recibir Traslado**
```typescript
// Usuario en Centro (destino)
PATCH /api/traslados/{id}/recibir
{
  "items_recibidos": [
    { 
      "producto_id": "uuid-laptop", 
      "cantidad_recibida": 10, // Si todo llegó bien
      "observaciones": ""
    }
  ]
}

// Backend:
1. Sumar a inventario_sucursal (centro)
2. Cambiar estado a 'recibido'
3. Registrar usuario y fecha de recepción
4. Si hay faltantes/daños → Crear reporte de incidencia
```

#### 4️⃣ Reportes Consolidados

**Reporte de Stock Global:**
```sql
-- Ver stock total de un producto en todas las sucursales
SELECT 
  p.nombre,
  s.nombre as sucursal,
  i.cantidad,
  i.stock_minimo
FROM productos p
JOIN inventario_sucursal i ON p.id = i.producto_id
JOIN sucursales s ON i.sucursal_id = s.id
WHERE p.id = 'uuid-laptop' AND p.tenant_id = 'uuid-tenant';

-- Resultado:
-- Laptop Dell XPS 15 | Matriz | 40 | 10
-- Laptop Dell XPS 15 | Centro | 30 | 5
-- Laptop Dell XPS 15 | Norte  | 30 | 5
-- TOTAL: 100 unidades
```

**Reporte de Ventas por Sucursal:**
```sql
SELECT 
  s.nombre as sucursal,
  COUNT(f.id) as total_facturas,
  SUM(f.total) as ingresos
FROM facturas f
JOIN sucursales s ON f.sucursal_id = s.id
WHERE f.tenant_id = 'uuid-tenant'
  AND f.fecha BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY s.id, s.nombre;

-- Resultado:
-- Matriz  | 150 | $45,000
-- Centro  | 230 | $67,500
-- Norte   | 180 | $52,000
-- TOTAL:  | 560 | $164,500
```

---

### 🎨 Interfaz de Usuario

#### Panel de Control Multi-Sucursal
```
┌─────────────────────────────────────────────────┐
│  Inventario Multi-Sucursal                      │
├─────────────────────────────────────────────────┤
│  Producto: Laptop Dell XPS 15                   │
│                                                 │
│  ┌──────────────┬──────────┬──────────────┐     │
│  │ Sucursal     │ Stock    │ Acciones     │     │
│  ├──────────────┼──────────┼──────────────┤     │
│  │ 🏢 Matriz    │ 40 uds   │ [Trasladar]  │     │
│  │ 🏪 Centro    │ 30 uds ⚠️│ [Abastecer]  │     │
│  │ 🏬 Norte     │ 30 uds   │ [Trasladar]  │     │
│  └──────────────┴──────────┴──────────────┘     │
│                                                 │
│  TOTAL SISTEMA: 100 unidades                    │
│                                                 │
│  [📊 Reporte Consolidado] [🔄 Traslados]        │
└─────────────────────────────────────────────────┘
```

#### Historial de Traslados
```
┌─────────────────────────────────────────────────┐
│  Traslados Entre Sucursales                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  TRA-2026-001  | Matriz → Centro                │
│  10 Laptops    | 🟢 Recibido | 13/01/2026       │
│  [Ver Detalle]                                  │
│                                                 │
│  TRA-2026-002  | Centro → Norte                 │
│  5 Laptops     | 🟡 En Tránsito | 13/01/2026   │
│  [Confirmar Recepción]                          │
│                                                 │
│  TRA-2026-003  | Matriz → Norte                 │
│  15 Laptops    | ⏳ Pendiente | 13/01/2026     │
│  [Enviar]                                       │
└─────────────────────────────────────────────────┘
```

---

### 🔐 Permisos por Rol

```typescript
// Roles y permisos en multi-sucursal
{
  "tenant_admin": {
    "sucursales": ["crear", "editar", "eliminar", "ver_todas"],
    "traslados": ["solicitar", "aprobar", "enviar", "recibir"],
    "inventario": ["ver_consolidado", "editar_todas"]
  },
  
  "manager": {
    "sucursales": ["ver_asignadas"],
    "traslados": ["solicitar", "enviar", "recibir"], // Solo su sucursal
    "inventario": ["ver_sucursal", "editar_sucursal"]
  },
  
  "cashier": {
    "sucursales": ["ver_asignada"],
    "traslados": ["ver"],
    "inventario": ["ver_sucursal"] // Solo lectura
  }
}
```

#### Asignación de Usuario a Sucursales
```sql
-- Tabla intermedia
CREATE TABLE user_sucursales (
  user_id UUID REFERENCES users(id),
  sucursal_id UUID REFERENCES sucursales(id),
  es_principal BOOLEAN DEFAULT false, -- Sucursal por defecto al login
  PRIMARY KEY (user_id, sucursal_id)
);

-- Ejemplo: Juan puede operar en 2 sucursales
INSERT INTO user_sucursales VALUES
  ('uuid-juan', 'uuid-matriz', true),    -- Su sucursal principal
  ('uuid-juan', 'uuid-centro', false);   -- Puede consultar
```

---

### 📈 Casos de Uso Reales

#### Caso 1: Farmacia con 3 Sucursales
```
Matriz (Bodega Central)
├─ Stock: 10,000 productos
├─ No factura al público
└─ Abastece a otras sucursales

Sucursal Centro
├─ Stock: 2,000 productos
├─ Factura directamente
└─ Solicita traslados a Matriz

Sucursal Norte  
├─ Stock: 1,500 productos
├─ Factura directamente
└─ Solicita traslados a Matriz
```

**Flujo diario:**
1. Ventas en Centro agotan producto → Stock = 0
2. Sistema alerta: "Paracetamol bajo stock mínimo"
3. Manager solicita traslado desde Matriz
4. Bodeguero en Matriz prepara y envía
5. Centro recibe y actualiza inventario
6. Puede seguir vendiendo

#### Caso 2: Restaurante con Cocina Central
```
Cocina Central (Preparación)
├─ Compra ingredientes
├─ Prepara platos
└─ Distribuye a restaurantes

Restaurante Centro
├─ Recibe platos preparados
└─ Vende al público

Restaurante Norte
├─ Recibe platos preparados  
└─ Vende al público
```

---

### 💡 Ventajas del Sistema

✅ **Visibilidad Total:** Ver stock en tiempo real de todas las sucursales
✅ **Optimización:** Mover productos de sucursales con exceso a las que faltan
✅ **Trazabilidad:** Historial completo de traslados y movimientos
✅ **Control Financiero:** Reportes consolidados y por sucursal
✅ **Escalabilidad:** Agregar nuevas sucursales sin límite (plan Empresarial)

---

---

## 🛠️ Implementación Técnica: API para Sigma

### Endpoints Exclusivos (Protegidos)

```typescript
// Middleware de autenticación
const authenticateSigma = (req, res, next) => {
  const apiKey = req.headers['x-sigma-api-key'];
  const medicoId = req.headers['x-sigma-medico-id'];
  
  if (apiKey !== process.env.SIGMA_MASTER_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Identificar tenant interno para este médico
  req.sigmaTenant = `sigma-${medicoId}`;
  next();
};

// Rutas
POST   /api/sigma/facturas          - Generar factura desde Sigma
GET    /api/sigma/facturas/:id      - Consultar estado
POST   /api/sigma/anular/:id        - Anular factura
GET    /api/sigma/credenciales      - Validar credenciales MH (Sigma configura)
```

### Tabla: `sigma_tenants` (Tenants Especiales)

```sql
CREATE TABLE sigma_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- Tenant interno
  sigma_medico_id TEXT UNIQUE NOT NULL, -- ID del médico en Sigma
  
  -- Info del médico (copiada desde Sigma)
  medico_nombre TEXT,
  medico_nit TEXT,
  
  -- Facturación
  facturas_generadas INTEGER DEFAULT 0,
  ultima_factura TIMESTAMP,
  
  -- Control
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Flujo de Facturación desde Sigma

```typescript
// Sigma envía:
POST /api/sigma/facturas
{
  "medico_id": "med-12345",
  "medico": {
    "nit": "0614-123456-123-4",
    "nombre": "Dr. Juan Pérez"
  },
  "paciente": {
    "nombre": "María López",
    "nit": "06141234567",
    "email": "maria@example.com"
  },
  "servicios": [
    {
      "codigo": "CONS-001",
      "descripcion": "Consulta General",
      "cantidad": 1,
      "precio": 25.00
    }
  ]
}

// FacturaXpress procesa:
1. Valida API Key de Sigma
2. Busca/crea tenant: "sigma-med-12345"
3. Usa credenciales MH configuradas por Sigma
4. Genera DTE
5. Envía a Hacienda
6. Actualiza contador de facturas
7. Retorna resultado a Sigma

// Response:
{
  "success": true,
  "factura": {
    "id": "uuid",
    "numero": "DTE-2026-001",
    "codigoGeneracion": "ABC123...",
    "selloRecibido": "XYZ789...",
    "estado": "procesado",
    "pdf_url": "https://...",
    "json_url": "https://..."
  }
}
```

### Panel Super Admin: NO muestra tenants de Sigma

Los tenants creados vía Sigma:
- ✅ Aparecen en base de datos con flag `origen: 'sigma'`
- ❌ NO aparecen en lista de empresas del super admin
- ❌ NO se pueden editar desde panel web
- ✅ Tienen reporte separado: "Facturación Sigma"

```sql
-- Filtrar tenants en super admin
SELECT * FROM tenants 
WHERE origen IS NULL OR origen != 'sigma'
ORDER BY created_at DESC;

-- Reporte de Sigma
SELECT 
  COUNT(*) as total_medicos,
  SUM(facturas_generadas) as facturas_totales,
  MAX(ultima_factura) as ultima_actividad
FROM sigma_tenants
WHERE activo = true;
```

---

## 🗄️ Esquema de Base de Datos

### Tabla: `subscription_plans`
```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- 'basico', 'profesional', 'empresarial', 'sigma'
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_annual DECIMAL(10,2) NOT NULL,
  features JSONB NOT NULL, -- { "inventory": false, "multi_sucursal": false }
  limits JSONB NOT NULL,   -- { "max_users": 5, "max_sucursales": 3 }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ejemplo de features por plan:
-- Básico: { "inventory": false, "multi_sucursal": false }
-- Profesional: { "inventory": true, "multi_sucursal": true, "max_sucursales": 3 }
-- Empresarial: { "inventory": true, "multi_sucursal": true, "max_sucursales": -1 }
-- Nota: max_sucursales = -1 significa ilimitado
```

### Tabla: `tenant_subscriptions`
```sql
CREATE TABLE tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  status TEXT DEFAULT 'active', -- active, past_due, suspended, cancelled
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, annual
  
  -- Fechas
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  next_billing_date TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Facturación
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT, -- 'card', 'bank_transfer', 'paypal'
  
  -- Metadata
  trial_ends_at TIMESTAMP, -- Para periodos de prueba
  grace_period_ends_at TIMESTAMP, -- Tolerancia de pago
  metadata JSONB, -- Datos extra (descuentos, promociones)
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla: `payment_history`
```sql
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES tenant_subscriptions(id),
  tenant_id UUID REFERENCES tenants(id),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, completed, failed, refunded
  payment_method TEXT,
  transaction_id TEXT, -- ID del procesador de pagos
  invoice_number TEXT,
  paid_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎯 Funcionalidades del Panel Super Admin

### 📈 Dashboard Ampliado
```
┌─────────────────────────────────────────────────┐
│  Panel SaaS - Suscripciones                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  💰 Ingresos Mensuales    📊 MRR (Monthly      │
│  $12,450                     Recurring Revenue) │
│                              $11,890            │
│                                                 │
│  📦 Plan más Popular      ⚠️ Pagos Pendientes  │
│  Profesional (45%)        3 empresas            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 🛠️ Gestión de Empresas (Mejorada)

**Columnas adicionales en tabla:**
- **Plan actual** (badge con color por plan)
- **Estado de pago** (✅ Al día, ⚠️ Vence pronto, ❌ Vencido)
- **Próxima facturación** (fecha)
- **MRR** (ingreso mensual de esa empresa)

**Acciones adicionales:**
- 🔄 Cambiar Plan
- 💳 Ver Historial de Pagos
- 🎁 Aplicar Descuento/Cupón
- ⏸️ Pausar Suscripción (mantiene datos, no cobra)
- 📧 Enviar Recordatorio de Pago

### 📋 Nueva Sección: Gestión de Planes

```
┌─────────────────────────────────────────────────┐
│  Planes de Suscripción                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  [+ Crear Plan Personalizado]                  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 📦 Plan Básico          [Editar] [❌]   │   │
│  │ $29/mes | 12 empresas activas            │   │
│  │ Características: Facturación, 1 usuario  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🚀 Plan Profesional     [Editar] [❌]   │   │
│  │ $79/mes | 45 empresas activas            │   │
│  │ Características: + Inventario, 5 usuarios│   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 💰 Nueva Sección: Reportes de Facturación

**Vistas:**
1. **Ingresos por mes** (gráfica de líneas)
2. **Distribución por plan** (gráfica de dona)
3. **Tasa de churn** (empresas que cancelan)
4. **LTV (Lifetime Value)** por empresa
5. **Pagos pendientes** con alertas

---

## 🔄 Flujo de Cambio de Plan

### Upgrade (Básico → Profesional)
1. Usuario solicita upgrade desde su panel
2. Se calcula prorrateo (días restantes del periodo actual)
3. Se cobra diferencia inmediatamente
4. Se activan nuevas características al instante
5. Notificación: "Plan actualizado exitosamente"

### Downgrade (Profesional → Básico)
1. Usuario solicita downgrade
2. **Advertencia:** "Perderás acceso a inventario y usuarios adicionales"
3. Cambio se aplica al finalizar el periodo actual
4. Se notifica 3 días antes del cambio
5. Al momento del cambio:
   - Se desactivan módulos no disponibles
   - Se mantienen los datos (lectura only)
   - Se envía email de confirmación

---

## ⚙️ Configuración de Pagos

### Procesadores Soportados (Fase 1)
- **Stripe** (tarjetas de crédito, ACH)
- **PayPal** (cuentas PayPal)
- **Transferencia Bancaria** (manual, requiere verificación)

### Recordatorios Automáticos
- **7 días antes:** Email "Tu suscripción vence pronto"
- **3 días antes:** Email + SMS
- **Día del vencimiento:** Intento automático de cobro
- **1 día después:** Email "Pago fallido, reintentaremos en 3 días"
- **3 días después:** Segundo intento
- **7 días después:** Suspensión automática (grace period terminado)
- **30 días después:** Cancelación definitiva + notificación de backup

---

## 🎁 Sistema de Cupones y Descuentos

### Tipos de Cupones
```typescript
type CouponType = 
  | 'percentage'  // 20% de descuento
  | 'fixed'       // $10 de descuento
  | 'trial'       // 30 días gratis
  | 'upgrade';    // 50% off en upgrade
```

### Tabla: `coupons`
```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'BLACKFRIDAY2026'
  type TEXT NOT NULL,
  value DECIMAL(10,2),
  applicable_plans JSONB, -- ['profesional', 'empresarial']
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id), -- super_admin que lo creó
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 Roadmap de Implementación

### Fase 1: Base (2 semanas)
- [ ] Migración de base de datos (tablas nuevas)
- [ ] Crear planes por defecto en BD
- [ ] Endpoint: GET /api/admin/plans (listar planes)
- [ ] Endpoint: POST /api/admin/subscriptions (asignar plan a tenant)
- [ ] UI: Sección "Planes" en super-admin
- [ ] UI: Selector de plan al crear empresa

### Fase 2: Facturación (2 semanas)
- [ ] Integración con Stripe
- [ ] Endpoint: POST /api/admin/payments (registrar pago manual)
- [ ] UI: Historial de pagos por empresa
- [ ] Cron job: Verificar suscripciones vencidas
- [ ] Email: Recordatorios automáticos

### Fase 3: Upgrades/Downgrades (1 semana)
- [ ] Endpoint: PATCH /api/subscriptions/change-plan
- [ ] Lógica de prorrateo
- [ ] UI: Botón "Cambiar Plan" en configuración
- [ ] Restricción de features por plan

### Fase 4: Cupones y Promociones (1 semana)
- [ ] Tabla y endpoints de cupones
- [ ] UI: Gestión de cupones en super-admin
- [ ] Validación de cupones al crear suscripción
- [ ] Tracking de uso de cupones

### Fase 5: Reportes y Analytics (1 semana)
- [ ] Dashboard de métricas financieras
- [ ] Gráficas de ingresos
- [ ] Reporte de churn
- [ ] Exportar datos a CSV/Excel

---

## 💡 Consideraciones Importantes

### Seguridad
- ✅ Encriptar datos de tarjetas (nunca almacenar CVV)
- ✅ Logs de todos los cambios de plan
- ✅ Webhook signatures para validar pagos de Stripe
- ✅ Rate limiting en endpoints de pagos

### Legal
- ⚠️ Términos y condiciones de suscripción
- ⚠️ Política de reembolsos (7 días)
- ⚠️ Notificación 30 días antes de cambios de precio
- ⚠️ Derecho a exportar datos (GDPR)

### UX
- ✅ Mostrar siempre próxima fecha de cobro
- ✅ Permitir cancelación en cualquier momento
- ✅ Confirmar antes de cambios que afectan datos
- ✅ Explicar claramente qué se pierde en downgrade

---

## 📞 Contacto y Soporte por Plan

| Plan | Canales | Tiempo de Respuesta |
|------|---------|---------------------|
| **Básico** | Email | 48 horas |
| **Profesional** | Email + Chat | 24 horas |
| **Empresarial** | Email + Chat + Tel + WhatsApp | 2 horas |

**Nota sobre Sigma:** Los médicos que usan Sigma reciben soporte directamente de Sigma, no de FacturaXpress.

---

## 🎯 KPIs a Monitorear

1. **MRR (Monthly Recurring Revenue):** Ingresos mensuales recurrentes
2. **Churn Rate:** % de empresas que cancelan
3. **ARPU (Average Revenue Per User):** Ingreso promedio por empresa
4. **LTV (Lifetime Value):** Valor total de una empresa durante su vida
5. **CAC (Customer Acquisition Cost):** Costo de adquirir un cliente
6. **Conversion Rate:** % de trials que se convierten en pago

---

## 📝 Notas Finales

Este sistema de suscripciones está diseñado para:
- ✅ Escalar de 10 a 10,000 empresas
- ✅ Soportar múltiples monedas (futuro)
- ✅ Integrarse con cualquier procesador de pagos
- ✅ Permitir personalización de planes por cliente
- ✅ Generar reportes financieros automáticos

**Próximo paso:** Revisar y aprobar el plan antes de iniciar Fase 1.
