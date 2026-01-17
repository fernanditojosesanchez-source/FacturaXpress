# Sistema de Feature Flags - Guía Completa

**Versión**: 1.0.0  
**Fecha**: 2026-01-17  
**Fase**: P3 - Despliegue Gradual

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura](#arquitectura)
3. [Instalación y Setup](#instalación-y-setup)
4. [Uso Básico](#uso-básico)
5. [Estrategias de Rollout](#estrategias-de-rollout)
6. [Integración Frontend](#integración-frontend)
7. [Integración Backend](#integración-backend)
8. [Monitoreo y Analytics](#monitoreo-y-analytics)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Introducción

El sistema de Feature Flags permite:
- ✅ Activar/desactivar features dinámicamente sin deploys
- ✅ Rollout gradual por porcentaje de usuarios
- ✅ Segmentación por tenant o usuario
- ✅ Canary deployments y A/B testing
- ✅ Kill switches para emergencias
- ✅ Configuraciones dinámicas por feature

---

## Arquitectura

### Componentes Principales

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│  ┌─────────────────┐  ┌──────────────────────────┐ │
│  │ useFeatureFlags │  │ Feature Flags Admin UI   │ │
│  │ useFeature()    │  │ (feature-flags.tsx)      │ │
│  └────────┬────────┘  └────────────┬─────────────┘ │
└───────────┼──────────────────────────┼──────────────┘
            │                          │
            │ GET /api/feature-flags/  │
            │     my-flags             │
            │                          │
┌───────────┼──────────────────────────┼──────────────┐
│           ▼                          ▼    Backend   │
│  ┌──────────────────────────────────────────────┐  │
│  │        Feature Flags Routes                  │  │
│  │  /api/admin/feature-flags                    │  │
│  │  /api/feature-flags/my-flags                 │  │
│  └───────────────────┬──────────────────────────┘  │
│                      │                              │
│  ┌───────────────────▼──────────────────────────┐  │
│  │     FeatureFlagsService                      │  │
│  │  - evaluate()                                │  │
│  │  - isEnabled()                               │  │
│  │  - evaluateBulk()                            │  │
│  │  - updateMetrics()                           │  │
│  └───────────────────┬──────────────────────────┘  │
│                      │                              │
│  ┌───────────────────▼──────────────────────────┐  │
│  │           Middleware                         │  │
│  │  requireFeature()                            │  │
│  │  requireAllFeatures()                        │  │
│  │  injectFeatureFlags()                        │  │
│  └───────────────────┬──────────────────────────┘  │
└────────────────────────┼──────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────┐
│              PostgreSQL (Supabase)                │
│  ┌──────────────────┐  ┌────────────────────────┐│
│  │ feature_flags    │  │ feature_flag_history   ││
│  │ - key            │  │ - cambios              ││
│  │ - habilitado     │  │ - auditoría            ││
│  │ - estrategia     │  └────────────────────────┘│
│  │ - porcentaje     │                            │
│  │ - configuracion  │  ┌────────────────────────┐│
│  └──────────────────┘  │ feature_flag_          ││
│                        │   evaluations          ││
│                        │ - analytics (10%)      ││
│                        └────────────────────────┘│
└────────────────────────────────────────────────────┘
```

### Bases de Datos

**Tablas:**
1. `feature_flags` - Configuración de flags
2. `feature_flag_history` - Historial de cambios
3. `feature_flag_evaluations` - Analytics (sampling 10%)

---

## Instalación y Setup

### 1. Ejecutar Migración SQL

```bash
psql $DATABASE_URL -f db/migrations/20260117_feature_flags.sql
```

O usando Supabase CLI:
```bash
supabase db push
```

### 2. Verificar Instalación

```bash
# Verificar que las tablas existen
psql $DATABASE_URL -c "SELECT key, habilitado FROM feature_flags;"
```

Deberías ver 4 flags pre-creados:
- `stock_transito`
- `sigma_support`
- `offline_mode`
- `performance_mode`

---

## Uso Básico

### Frontend: Verificar un Feature

```tsx
import { useFeature } from "@/hooks/use-feature-flags";

function MyComponent() {
  const hasNewFeature = useFeature("mi_nueva_feature");

  if (!hasNewFeature) {
    return <div>Feature no disponible</div>;
  }

  return <NewFeatureComponent />;
}
```

### Frontend: Verificar Múltiples Features

```tsx
import { useFeatures } from "@/hooks/use-feature-flags";

function Dashboard() {
  const features = useFeatures([
    "stock_transito",
    "sigma_support",
    "reporting_v2"
  ]);

  return (
    <div>
      {features.stock_transito && <StockTransitoWidget />}
      {features.sigma_support && <SigmaSupportWidget />}
      {features.reporting_v2 && <NewReportsWidget />}
    </div>
  );
}
```

### Backend: Proteger un Endpoint

```typescript
import { requireFeature } from "../middleware/feature-flags";

// Opción 1: Middleware
router.get(
  "/api/nueva-funcionalidad",
  requireAuth,
  requireFeature("nueva_funcionalidad"),
  handler
);

// Opción 2: Verificación manual en handler
router.get("/api/endpoint", requireAuth, async (req, res) => {
  const enabled = await checkFeature(req, "mi_feature");
  
  if (!enabled) {
    return res.status(403).json({ 
      error: "Feature no disponible" 
    });
  }

  // ... lógica del endpoint
});
```

---

## Estrategias de Rollout

### 1. Boolean (Simple On/Off)

**Uso:** Kill switches, features completos

```typescript
{
  key: "nueva_feature",
  estrategia: "boolean",
  habilitado: true
}
```

- ✅ Todos los usuarios ven el feature
- ❌ Sin gradualidad

### 2. Percentage (Rollout Gradual)

**Uso:** Canary deployments, testing con usuarios reales

```typescript
{
  key: "nueva_feature",
  estrategia: "percentage",
  habilitado: true,
  porcentajeRollout: 25 // 25% de usuarios
}
```

**Cómo funciona:**
- Hash determinístico basado en `tenantId` o `userId`
- El mismo usuario siempre verá el mismo resultado (consistencia)
- Distribución uniforme

**Incrementar rollout:**
```bash
# Desde la UI de admin, o vía API:
POST /api/admin/feature-flags/nueva_feature/increment-rollout
{
  "incremento": 10
}
```

### 3. Tenants (Por Cliente)

**Uso:** Features enterprise, beta testing con clientes específicos

```typescript
{
  key: "feature_enterprise",
  estrategia: "tenants",
  habilitado: true,
  tenantsPermitidos: [
    "uuid-tenant-1",
    "uuid-tenant-2"
  ]
}
```

- ✅ Control granular por cliente
- ✅ Ideal para features pagos

### 4. User IDs (Por Usuario)

**Uso:** Internal testing, beta testers específicos

```typescript
{
  key: "experimental_feature",
  estrategia: "user_ids",
  habilitado: true,
  usuariosPermitidos: [
    "uuid-user-1",
    "uuid-user-2"
  ]
}
```

### 5. Gradual (Rollout Automático)

**Uso:** Rollout programático que incrementa automáticamente

```typescript
{
  key: "nueva_feature",
  estrategia: "gradual",
  habilitado: true,
  porcentajeRollout: 0 // Incrementar manualmente o con cron
}
```

**Plan de rollout típico:**
1. Día 1: 5% (early adopters)
2. Día 3: 25% (si no hay errores)
3. Día 5: 50%
4. Día 7: 100%

---

## Integración Frontend

### Hook Principal: `useFeatureFlags()`

```tsx
import { useFeatureFlags } from "@/hooks/use-feature-flags";

function App() {
  const { data, isLoading, error } = useFeatureFlags();

  if (isLoading) return <Loading />;

  // data.flags = { stock_transito: true, sigma_support: false, ... }
  
  return (
    <FeaturesProvider value={data.flags}>
      <AppRoutes />
    </FeaturesProvider>
  );
}
```

### Hook Individual: `useFeature(key)`

```tsx
function MyComponent() {
  const isEnabled = useFeature("mi_feature");

  return isEnabled ? <NewVersion /> : <OldVersion />;
}
```

### Hook con Configuración: `useFeatureConfig(key)`

```tsx
function MaxUploadSize() {
  const config = useFeatureConfig("max_upload_size");
  const maxSize = config?.size_mb || 10;

  return <FileUploader maxSize={maxSize} />;
}
```

### Renderizado Condicional

```tsx
function ConditionalFeature() {
  const hasFeature = useFeature("nueva_feature");

  if (!hasFeature) {
    return null; // O mostrar mensaje
  }

  return <NewFeatureComponent />;
}
```

---

## Integración Backend

### Middleware: `requireFeature()`

Bloquea acceso si feature deshabilitado:

```typescript
router.post(
  "/api/stock-transito",
  requireAuth,
  requireFeature("stock_transito"),
  async (req, res) => {
    // Solo ejecuta si flag habilitado
  }
);
```

**Con mensaje personalizado:**
```typescript
requireFeature("stock_transito", {
  customMessage: "Stock en tránsito solo disponible en plan Enterprise"
})
```

**Fail silently (no bloquea, solo log):**
```typescript
requireFeature("feature_opcional", {
  failSilently: true
})
```

### Middleware: `requireAllFeatures()`

Requiere TODOS los flags habilitados:

```typescript
router.post(
  "/api/advanced-reporting",
  requireAuth,
  requireAllFeatures(["reporting_v2", "analytics_pro"]),
  handler
);
```

### Middleware: `requireAnyFeature()`

Requiere AL MENOS UNO habilitado:

```typescript
router.post(
  "/api/export",
  requireAuth,
  requireAnyFeature(["export_pdf", "export_excel"]),
  handler
);
```

### Middleware: `injectFeatureFlags()`

Inyecta flags en `req.features` para uso en handler:

```typescript
router.use(injectFeatureFlags([
  "stock_transito",
  "sigma_support"
]));

router.get("/api/dashboard", requireAuth, async (req, res) => {
  const features = (req as any).features;
  
  const widgets = [];
  if (features.stock_transito) {
    widgets.push(await getStockTransitoWidget());
  }
  if (features.sigma_support) {
    widgets.push(await getSigmaWidget());
  }

  res.json({ widgets });
});
```

### Verificación Manual: `checkFeature()`

```typescript
import { checkFeature } from "../middleware/feature-flags";

router.post("/api/factura", requireAuth, async (req, res) => {
  const usePriorityQueue = await checkFeature(req, "priority_queue");

  if (usePriorityQueue) {
    await addToHighPriorityQueue(req.body);
  } else {
    await processImmediately(req.body);
  }

  res.json({ success: true });
});
```

---

## Monitoreo y Analytics

### Métricas Integradas

Cada flag rastrea automáticamente:
- `vecesConsultado` - Total de evaluaciones
- `vecesActivado` - Veces que retornó `true`
- `vecesDesactivado` - Veces que retornó `false`
- `ultimaConsulta` - Última vez que fue evaluado

### Dashboard de Admin

Acceder a `/configuracion` → pestaña "Feature Flags"

Métricas disponibles:
- Total flags activos/inactivos
- Porcentaje de rollout por flag
- Historial de cambios
- Estadísticas de uso últimos 7 días

### API de Estadísticas

```bash
GET /api/admin/feature-flags/mi_feature/stats?days=7
```

**Respuesta:**
```json
{
  "flagKey": "mi_feature",
  "totalEvaluations": 12500,
  "enabledCount": 3125,
  "disabledCount": 9375,
  "enabledPercentage": 25.0,
  "uniqueTenants": 45,
  "uniqueUsers": 230,
  "period": "7 days"
}
```

### Historial de Cambios

```bash
GET /api/admin/feature-flags/mi_feature/history
```

Rastrea:
- Quién hizo el cambio
- Qué campo cambió
- Valor anterior → valor nuevo
- Timestamp

---

## Best Practices

### 1. Naming Conventions

✅ **Buenos nombres:**
- `stock_transito`
- `reporting_v2`
- `sigma_support`
- `payment_gateway_stripe`

❌ **Malos nombres:**
- `feature1`
- `test`
- `new_thing`

**Regla:** snake_case, descriptivo, sin versiones genéricas

### 2. Ciclo de Vida de un Flag

```
1. Crear flag (habilitado: false)
   ↓
2. Desarrollar feature detrás del flag
   ↓
3. Activar en pruebas/staging (habilitado: true, estrategia: boolean)
   ↓
4. Rollout gradual en producción (estrategia: percentage, 5% → 100%)
   ↓
5. Feature estable (habilitado: true, 100%)
   ↓
6. Remover flag del código (después de 2-4 semanas estable)
   ↓
7. Desactivar flag en BD (habilitado: false)
   ↓
8. Eliminar flag de BD (después de 1 mes desactivado)
```

### 3. Feature Flag Debt

⚠️ **Problema:** Acumular flags sin limpiar

**Solución:**
- Auditar flags cada mes
- Eliminar flags con 100% rollout > 1 mes
- Documentar fecha de remoción esperada en descripción

```typescript
{
  key: "nueva_feature",
  descripcion: "Nueva feature X. Remover después de 2026-02-15",
  tags: ["remover_feb_2026"]
}
```

### 4. Estrategia por Tipo de Feature

| Tipo de Feature | Estrategia Recomendada |
|----------------|------------------------|
| Kill switch | `boolean` |
| Nueva UI | `percentage` → `gradual` |
| Feature enterprise | `tenants` |
| Beta testing | `user_ids` |
| Configuración | `boolean` con `configuracion` |
| A/B test | `percentage` (50/50) |

### 5. Testing

**Unit Tests:**
```typescript
// Mockear el servicio
jest.mock("../lib/feature-flags-service");

it("debería mostrar nueva feature si flag habilitado", async () => {
  featureFlagsService.isEnabled.mockResolvedValue(true);
  
  const response = await request(app)
    .get("/api/nueva-feature")
    .expect(200);
    
  expect(response.body).toHaveProperty("data");
});
```

**Integration Tests:**
```typescript
beforeEach(async () => {
  await db.insert(featureFlags).values({
    key: "test_feature",
    habilitado: true,
    estrategia: "boolean"
  });
});

it("debería respetar feature flag en endpoint", async () => {
  // Test con flag habilitado
  await request(app)
    .get("/api/endpoint")
    .expect(200);

  // Deshabilitar flag
  await db.update(featureFlags)
    .set({ habilitado: false })
    .where(eq(featureFlags.key, "test_feature"));

  // Test con flag deshabilitado
  await request(app)
    .get("/api/endpoint")
    .expect(403);
});
```

### 6. Configuraciones Dinámicas

Usar `configuracion` JSON para parámetros variables:

```typescript
{
  key: "max_upload_size",
  configuracion: {
    size_mb: 100,
    allowed_types: ["pdf", "jpg", "png"]
  }
}
```

Consumir en frontend:
```tsx
const config = useFeatureConfig("max_upload_size");
const maxSize = config?.size_mb || 10;
```

---

## Troubleshooting

### ❌ Flag no aparece en frontend

**Causa:** No está habilitado o no existe

**Solución:**
```bash
# Verificar en BD
psql $DATABASE_URL -c "SELECT * FROM feature_flags WHERE key = 'mi_flag';"

# Si no existe, crear
curl -X POST http://localhost:5000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "mi_flag",
    "nombre": "Mi Flag",
    "habilitado": true,
    "estrategia": "boolean"
  }'
```

### ❌ Rollout no incrementa

**Causa:** Estrategia incorrecta

**Solución:**
```bash
# Verificar estrategia
psql $DATABASE_URL -c "SELECT key, estrategia, porcentaje_rollout FROM feature_flags WHERE key = 'mi_flag';"

# Cambiar a percentage/gradual
curl -X PATCH http://localhost:5000/api/admin/feature-flags/mi_flag \
  -H "Content-Type: application/json" \
  -d '{
    "estrategia": "percentage",
    "porcentajeRollout": 25
  }'
```

### ❌ Usuario no ve feature con 100% rollout

**Causa:** Cache de frontend

**Solución:**
- El hook `useFeatureFlags` actualiza cada 5 minutos
- Forzar refresh: Hard reload (Ctrl+Shift+R)
- O invalidar cache manualmente:
```tsx
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ["/api/feature-flags/my-flags"] });
```

### ❌ Middleware bloquea endpoint incorrectamente

**Causa:** Contexto de tenant/user no disponible

**Solución:**
```typescript
// Asegurar que el middleware de auth se ejecuta primero
router.get(
  "/api/endpoint",
  requireAuth, // ← PRIMERO: establece req.user
  requireFeature("mi_flag"), // ← DESPUÉS: usa req.user
  handler
);
```

### ❌ Tabla `feature_flags` no existe

**Causa:** Migración no ejecutada

**Solución:**
```bash
# Ejecutar migración
psql $DATABASE_URL -f db/migrations/20260117_feature_flags.sql

# Verificar
psql $DATABASE_URL -c "\dt feature_flags"
```

---

## Comandos Útiles

### Crear Flag via API

```bash
curl -X POST http://localhost:5000/api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "nueva_feature",
    "nombre": "Nueva Feature",
    "descripcion": "Descripción de la feature",
    "estrategia": "percentage",
    "categoria": "feature",
    "habilitado": true,
    "porcentajeRollout": 10
  }'
```

### Toggle Flag

```bash
curl -X POST http://localhost:5000/api/admin/feature-flags/nueva_feature/toggle
```

### Incrementar Rollout

```bash
curl -X POST http://localhost:5000/api/admin/feature-flags/nueva_feature/increment-rollout \
  -H "Content-Type: application/json" \
  -d '{ "incremento": 10 }'
```

### Ver Estadísticas

```bash
curl http://localhost:5000/api/admin/feature-flags/nueva_feature/stats?days=7
```

### Evaluar Flag Manualmente

```bash
curl -X POST http://localhost:5000/api/admin/feature-flags/nueva_feature/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "uuid-tenant",
    "userId": "uuid-user"
  }'
```

---

## Ejemplos de Uso Avanzado

### Ejemplo 1: Canary Deployment

```typescript
// Semana 1: 5%
await featureFlagsService.upsertFlag("nueva_ui", {
  habilitado: true,
  estrategia: "percentage",
  porcentajeRollout: 5
}, "admin");

// Semana 2: 25% (si sin errores)
await featureFlagsService.incrementGradualRollout("nueva_ui", 20, "admin");

// Semana 3: 50%
await featureFlagsService.incrementGradualRollout("nueva_ui", 25, "admin");

// Semana 4: 100%
await featureFlagsService.incrementGradualRollout("nueva_ui", 50, "admin");
```

### Ejemplo 2: A/B Testing

```typescript
// Crear dos variantes
await featureFlagsService.upsertFlag("ui_variant_a", {
  habilitado: true,
  estrategia: "percentage",
  porcentajeRollout: 50,
  configuracion: { variant: "A", color: "blue" }
}, "admin");

await featureFlagsService.upsertFlag("ui_variant_b", {
  habilitado: true,
  estrategia: "percentage",
  porcentajeRollout: 50,
  configuracion: { variant: "B", color: "green" }
}, "admin");

// En frontend
const variantA = useFeature("ui_variant_a");
const variantB = useFeature("ui_variant_b");

return variantA ? <ButtonBlue /> : <ButtonGreen />;
```

### Ejemplo 3: Feature Enterprise por Tenant

```typescript
// Crear flag para clientes premium
await featureFlagsService.upsertFlag("advanced_analytics", {
  habilitado: true,
  estrategia: "tenants",
  tenantsPermitidos: [
    "uuid-tenant-premium-1",
    "uuid-tenant-premium-2"
  ],
  categoria: "feature"
}, "admin");

// En frontend
function AdvancedAnalytics() {
  const hasAccess = useFeature("advanced_analytics");

  if (!hasAccess) {
    return <UpgradeToPremiumBanner />;
  }

  return <AdvancedAnalyticsDashboard />;
}
```

---

## Próximos Pasos

1. ✅ Sistema implementado
2. ⏳ Crear flags para features existentes
3. ⏳ Migrar features hardcodeados a flags
4. ⏳ Setup monitoring en producción
5. ⏳ Documentar proceso de rollout en wiki

---

## Referencias

- [Schema Feature Flags](../shared/schema-feature-flags.ts)
- [Feature Flags Service](../server/lib/feature-flags-service.ts)
- [Feature Flags Middleware](../server/middleware/feature-flags.ts)
- [Feature Flags Routes](../server/routes/feature-flags.ts)
- [React Hooks](../client/src/hooks/use-feature-flags.ts)
- [Admin UI](../client/src/pages/feature-flags.tsx)
- [Migración SQL](../db/migrations/20260117_feature_flags.sql)

---

**Mantenido por:** Equipo FacturaXpress  
**Última actualización:** 2026-01-17
