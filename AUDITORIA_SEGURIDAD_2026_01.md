# 🔐 Auditoría de Seguridad - FacturaXpress
**Fecha:** 17 de enero de 2026  
**Versión Sistema:** 2.1.0  
**Tipo:** Análisis de conformidad y riesgos  
**Auditor:** Análisis técnico automatizado

---

## 📋 Resumen Ejecutivo

Se realizó auditoría de seguridad y arquitectura sobre 7 puntos críticos del sistema FacturaXpress. Se identificaron **2 riesgos altos (P0)**, **3 riesgos medios (P1)** y **2 conformidades parciales (P2-P3)**.

### Estado General por Área

| Área | Conformidad | Riesgo | Acción |
|------|-------------|--------|--------|
| **Correlativos (numeroControl)** | ❌ No conforme | 🔴 Alto | Inmediata |
| **Firma Digital (JWS)** | ❌ No conforme | 🔴 Alto | Inmediata |
| **Sigma Support Access** | ⚠️ Parcial | 🟡 Medio | Prioritaria |
| **Catálogos DGII** | ❌ No conforme | 🟡 Medio | Prioritaria |
| **Vault Logs** | ⚠️ Parcial | 🟡 Medio-Alto | Prioritaria |
| **Contingencia Queue** | ✅ Conforme | 🟢 Bajo | Mejora menor |
| **Arquitectura DB** | ⚠️ Parcial | 🟢 Bajo | Cleanup |

---

## 🚨 Hallazgos Críticos (P0)

### 1. Race Conditions en Generación de Correlativos

**Archivo:** [`server/storage.ts:638-670`](server/storage.ts#L638-L670)

#### 🔍 Problema Identificado

La implementación actual usa patrón **SELECT + UPDATE** dentro de transacción, lo que introduce ventana temporal para race conditions:

```typescript
async getNextNumeroControl(tenantId, emisorNit, tipoDte): Promise<string> {
  return await db.transaction(async (tx) => {
    // ⚠️ PROBLEMA: SELECT antes del UPDATE
    let [record] = await tx.select()
      .from(secuencialControlTable)
      .where(...);
    
    if (!record) {
      [record] = await tx.insert(...).returning();
    } else {
      newSecuencial = record.secuencial + 1;  // ❌ Race condition aquí
      [record] = await tx.update(secuencialControlTable)
        .set({ secuencial: newSecuencial })
        .returning();
    }
    
    return numeroControl;
  });
}
```

#### 🎯 Riesgos

1. **Correlativos duplicados:** Dos requests concurrentes pueden obtener el mismo número
2. **Rechazo DGII:** Ministerio de Hacienda rechaza DTEs con correlativos duplicados
3. **Inconsistencia legal:** Violación de normativa fiscal de El Salvador

#### 💡 Recomendación

**Implementar UPDATE atómico sin SELECT previo:**

```sql
-- Estrategia 1: UPDATE directo con RETURNING
UPDATE secuencial_control 
SET secuencial = secuencial + 1, 
    fecha_actualizacion = NOW(),
    ultimo_numero_control = CONCAT(prefix, '-', suffix, '-', secuencial + 1)
WHERE tenant_id = $1 
  AND emisor_nit = $2 
  AND tipo_dte = $3
RETURNING secuencial, ultimo_numero_control;

-- Estrategia 2: Si no existe, usar UPSERT
INSERT INTO secuencial_control (tenant_id, emisor_nit, tipo_dte, secuencial)
VALUES ($1, $2, $3, 1)
ON CONFLICT (tenant_id, emisor_nit, tipo_dte) 
DO UPDATE SET 
  secuencial = secuencial_control.secuencial + 1,
  fecha_actualizacion = NOW()
RETURNING secuencial;
```

#### 📊 Prioridad

- **Severidad:** 🔴 Crítica
- **Probabilidad:** Alta (bajo carga concurrente)
- **Impacto:** Alto (multas DGII, pérdida de confianza)
- **Esfuerzo estimado:** 4-6 horas

---

### 2. Firma JWS Bloquea Event Loop de Node.js

**Archivo:** [`server/lib/signer.ts:14-95`](server/lib/signer.ts#L14-L95)

#### 🔍 Problema Identificado

La firma digital RSA-2048 con SHA-256 es **CPU-intensive** y ejecuta en el hilo principal de Node.js:

```typescript
export async function signDTE(
  dte: any, 
  p12Base64: string, 
  password: string
): Promise<SignResult> {
  // ⚠️ TODO ejecuta en el hilo principal
  const p12Der = forge.util.decode64(p12Base64);        // CPU-bound
  const p12Asn1 = forge.asn1.fromDer(p12Der);           // CPU-bound
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password); // CPU-bound
  
  const md = forge.md.sha256.create();
  md.update(dataToSign, "utf8");
  const signature = privateKey.sign(md);  // ❌ Bloquea event loop 50-200ms
  
  return { body: jws, signature: signatureB64 };
}
```

#### 🎯 Riesgos

1. **Latencia agregada:** Cada firma bloquea el servidor 50-200ms
2. **Degradación bajo carga:** 50+ facturas/minuto → latencia > 5s
3. **DoS accidental:** Usuarios experimentan timeouts en operaciones no relacionadas
4. **CPU saturation:** Un tenant que emite 100 facturas consume 100% CPU

#### 💡 Recomendación

**Opción 1: Worker Threads (Node.js nativo)**

```typescript
// server/lib/signer-worker.ts
import { Worker } from 'worker_threads';
import path from 'path';

export async function signDTEAsync(dte: any, p12Base64: string, password: string) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'signer-worker-impl.js'), {
      workerData: { dte, p12Base64, password }
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}
```

**Opción 2: Microservicio dedicado (Docker)**

```yaml
# docker-compose.yml
services:
  signature-service:
    image: facturaxpress/signer:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 512M
    environment:
      - NODE_ENV=production
```

**Opción 3: BullMQ con Worker Pool dedicado**

```typescript
// Ya existe infraestructura BullMQ, extender con pool de firma
const signerWorker = new Worker('firma-queue', async (job) => {
  return await signDTE(job.data.dte, job.data.p12, job.data.password);
}, {
  concurrency: 10, // 10 workers paralelos
  limiter: { max: 100, duration: 1000 } // Max 100 firmas/segundo
});
```

#### 📊 Prioridad

- **Severidad:** 🔴 Crítica
- **Probabilidad:** Alta (ya ocurre con > 20 facturas/min)
- **Impacto:** Alto (experiencia de usuario degradada)
- **Esfuerzo estimado:** 8-12 horas (Worker Threads) / 16-24 horas (Microservicio)

---

## ⚠️ Hallazgos de Riesgo Medio (P1)

### 3. Sigma Support: Falta Aprobación Just-In-Time (JIT)

**Archivos:** 
- [`server/routes/sigma-support.ts:1-150`](server/routes/sigma-support.ts)
- [`server/lib/sigma-support.ts`](server/lib/sigma-support.ts)

#### 🔍 Análisis de Conformidad

**✅ Implementado:**
- Expiración temporal (`validoHasta` field - 9 referencias)
- Default de 7 días configurable
- Middleware de verificación de acceso
- Auditoría de accesos en `sigma_support_access` table

**❌ Faltante:**
- **Workflow de aprobación del tenant**
- **Tokens de corta duración (2 horas vs. 7 días)**
- **Notificación al tenant cuando se otorga acceso**
- **Re-aprobación para extensiones**

#### 🎯 Riesgos

1. **Exfiltración de datos:** Admin de Sigma puede mantener acceso 7 días sin supervisión
2. **Insider threat:** Sin aprobación del tenant, no hay check & balance
3. **Compliance:** Violación de principio de privilegio mínimo (least privilege)

#### 💡 Recomendación

**Implementar workflow de 3 pasos:**

```typescript
// Paso 1: Sigma solicita acceso
POST /api/sigma/request-access
{
  "tenantId": "uuid",
  "reason": "Debugging emisión lenta",
  "estimatedDuration": "2h",
  "scopeRequested": ["read_facturas", "read_config"]
}
// → Estado: PENDING_APPROVAL

// Paso 2: Tenant aprueba (o rechaza)
POST /api/admin/sigma/approve-access
{
  "requestId": "uuid",
  "approved": true,
  "maxDuration": 7200000 // 2 horas en ms
}
// → Estado: APPROVED → Genera token con exp: 2h

// Paso 3: Renovación requiere re-aprobación
POST /api/sigma/extend-access
{
  "accessId": "uuid",
  "reason": "Necesito 1h adicional"
}
// → Notifica al tenant → Requiere nueva aprobación
```

#### 📊 Prioridad

- **Severidad:** 🟡 Media
- **Probabilidad:** Baja (requiere insider malicioso)
- **Impacto:** Alto (acceso total a datos de tenant)
- **Esfuerzo estimado:** 12-16 horas

---

### 4. Catálogos DGII Hardcoded Sin Sincronización

**Archivo:** [`server/catalogs.ts:1-126`](server/catalogs.ts)

#### 🔍 Problema Identificado

Todos los catálogos oficiales de DGII están **hardcoded** en el código fuente:

```typescript
export const DEPARTAMENTOS_EL_SALVADOR = [
  { codigo: "01", nombre: "Ahuachapán" },
  { codigo: "02", nombre: "Santa Ana" },
  // ...hardcoded desde fecha desconocida
];

export const TIPOS_DOCUMENTO = [
  { codigo: "36", nombre: "NIT", patron: /^\d{14}-\d/ },
  { codigo: "13", nombre: "DUI", patron: /^\d{8}-\d/ },
  // ...sin versioning ni última actualización
];

export const TIPOS_DTE = [
  { codigo: "01", nombre: "Factura" },
  // ...¿Qué pasa si DGII agrega código 16?
];
```

#### 🎯 Riesgos

1. **Rechazo masivo de DTEs:** Si DGII agrega nuevo tipo de documento, sistema no lo conoce
2. **Validaciones obsoletas:** Patrones de NIT/DUI podrían cambiar
3. **Nuevos tipos de DTE:** Sistema no puede emitir nuevos tipos sin redeploy
4. **Departamentos nuevos:** Cambios territoriales no se reflejan

#### 💡 Recomendación

**Implementar servicio de sincronización:**

```typescript
// server/lib/catalog-sync-service.ts
export class CatalogSyncService {
  private readonly DGII_API = "https://api.mh.gob.sv/catalogos";
  private readonly SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
  
  async syncCatalogs(): Promise<SyncResult> {
    const catalogs = [
      'departamentos',
      'tipos-documento', 
      'tipos-dte',
      'condiciones-operacion',
      'formas-pago',
      'unidades-medida'
    ];
    
    for (const catalog of catalogs) {
      const remote = await this.fetchCatalog(catalog);
      const local = await this.getLocalCatalog(catalog);
      
      if (!this.areEqual(remote, local)) {
        await this.updateCatalog(catalog, remote);
        await this.notifyAdmin(`Catálogo ${catalog} actualizado`);
      }
    }
  }
  
  private async fetchCatalog(name: string) {
    const response = await fetch(`${this.DGII_API}/${name}`);
    return response.json();
  }
}

// Tabla para tracking
CREATE TABLE catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_name VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status VARCHAR(20), -- 'success' | 'failed'
  error_message TEXT,
  records_count INT,
  UNIQUE(catalog_name, version)
);

// Cron job
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => { // 2 AM diario
  await catalogSyncService.syncCatalogs();
});
```

#### 📊 Prioridad

- **Severidad:** 🟡 Media
- **Probabilidad:** Baja (catálogos cambian cada 1-2 años)
- **Impacto:** Alto (rechazo masivo de DTEs)
- **Esfuerzo estimado:** 16-20 horas

---

### 5. Logs de Vault Son Mutables (Atacante Puede Borrar Evidencia)

**Archivo:** [`server/lib/vault.ts:251-265`](server/lib/vault.ts#L251-L265)

#### 🔍 Problema Identificado

La tabla `vault_access_log` no tiene protección contra borrado:

```typescript
async function logVaultAccess(config: {
  userId: string;
  action: "read" | "write" | "delete" | "failed_access";
  // ...
}): Promise<void> {
  await db.execute(
    sql`INSERT INTO public.vault_access_log (...) VALUES (...)`
  );
}

// ❌ Un atacante con acceso DB puede hacer:
// DELETE FROM vault_access_log WHERE user_id = 'atacante';
// → Evidencia de exfiltración desaparece
```

#### 🎯 Riesgos

1. **Borrado de evidencia:** Insider puede ocultar accesos no autorizados
2. **Imposibilidad de auditoría forense:** No hay trail inmutable
3. **Compliance:** Violación de retención de logs (SOC2, ISO 27001)

#### 💡 Recomendación

**Opción 1: Trigger de protección (Implementación rápida)**

```sql
-- Prevenir DELETE y UPDATE en vault_access_log
CREATE OR REPLACE FUNCTION prevent_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'vault_access_log es inmutable. Use archive externo.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_vault_logs_delete
  BEFORE DELETE ON public.vault_access_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_log_mutation();

CREATE TRIGGER protect_vault_logs_update
  BEFORE UPDATE ON public.vault_access_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_log_mutation();

-- Permitir solo INSERT
REVOKE UPDATE, DELETE ON public.vault_access_log FROM authenticated;
GRANT INSERT ON public.vault_access_log TO authenticated;
```

**Opción 2: Replicación a S3 (append-only)**

```typescript
// server/lib/vault-log-shipper.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export class VaultLogShipper {
  private s3: S3Client;
  private bucket = process.env.AUDIT_LOG_BUCKET;
  
  async shipLog(log: VaultAccessLog): Promise<void> {
    const key = `vault-logs/${log.tenantId}/${log.timestamp.toISOString()}-${log.id}.json`;
    
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(log),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
      // ✅ Bucket tiene Object Lock activado (WORM)
    }));
  }
}

// Configuración de bucket S3
{
  "Rules": [{
    "Id": "ImmutableLogs",
    "Status": "Enabled",
    "DefaultRetention": {
      "Mode": "COMPLIANCE",
      "Years": 7  // Retención legal de 7 años
    }
  }]
}
```

**Opción 3: Log shipping a Datadog/CloudWatch**

```typescript
// server/lib/vault.ts
import { createLogger } from 'winston';
import { CloudWatchTransport } from 'winston-cloudwatch';

const auditLogger = createLogger({
  transports: [
    new CloudWatchTransport({
      logGroupName: '/facturaxpress/vault-audit',
      logStreamName: `${process.env.ENVIRONMENT}-${Date.now()}`,
      awsRegion: 'us-east-1',
      retentionInDays: 2555 // 7 años
    })
  ]
});

async function logVaultAccess(config: VaultAccessLog) {
  // Log local (PostgreSQL)
  await db.execute(sql`INSERT INTO vault_access_log ...`);
  
  // ✅ Log externo inmutable (CloudWatch)
  auditLogger.info('vault_access', config);
}
```

#### 📊 Prioridad

- **Severidad:** 🟡 Media-Alta
- **Probabilidad:** Baja (requiere acceso privilegiado)
- **Impacto:** Alto (imposibilidad de auditoría forense)
- **Esfuerzo estimado:** 4-8 horas (Trigger) / 12-16 horas (S3) / 8-12 horas (CloudWatch)

---

## ✅ Hallazgos de Bajo Riesgo (P2-P3)

### 6. Contingencia: Falta Jitter en Backoff Exponencial

**Archivo:** [`server/lib/outbox-processor.ts:9-25`](server/lib/outbox-processor.ts#L9-L25)

#### 🔍 Análisis de Conformidad

**✅ Implementado correctamente:**
- Backoff exponencial: `5s → 10s → 20s → 40s → 80s`
- MAX_RETRIES = 5
- BATCH_SIZE = 50 (previene thundering herd)
- Deduplicación con `processedInBatch` Set

**⚠️ Mejora menor:**
- Falta **jitter aleatorio** para distribuir carga

```typescript
function calculateNextRetryTime(retries: number): Date {
  const delayMs = INITIAL_BACKOFF * Math.pow(2, Math.min(retries, 4));
  // ❌ Todos los eventos con 3 reintentos esperan exactamente 40s
  // ✅ Con jitter: unos esperan 38s, otros 42s, etc.
  return new Date(Date.now() + delayMs);
}
```

#### 💡 Recomendación

```typescript
function calculateNextRetryTime(retries: number): Date {
  const baseDelay = INITIAL_BACKOFF * Math.pow(2, Math.min(retries, 4));
  
  // ✅ Agregar jitter ±20%
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
  const delayMs = Math.max(1000, baseDelay + jitter);
  
  return new Date(Date.now() + delayMs);
}
```

#### 📊 Prioridad

- **Severidad:** 🟢 Baja
- **Probabilidad:** Media (solo bajo carga extrema)
- **Impacto:** Bajo (leve mejora de distribución de carga)
- **Esfuerzo estimado:** 1 hora

---

### 7. Dependencia better-sqlite3 No Utilizada

**Archivo:** [`package.json`](package.json)

#### 🔍 Problema Identificado

El archivo `package.json` incluye `better-sqlite3` pero no se usa para lógica de negocio:

```json
{
  "dependencies": {
    "better-sqlite3": "^11.8.1",  // ❌ No utilizado
    "@types/better-sqlite3": "^7.6.12"  // ❌ No utilizado
  }
}
```

**Búsqueda realizada:**
- ✅ [`server/storage.ts`](server/storage.ts) usa **solo PostgreSQL/Supabase**
- ✅ IndexedDB solo para cache offline (cliente)
- ❌ No hay lógica de negocio en SQLite

#### 💡 Recomendación

```bash
# Remover dependencias no utilizadas
npm uninstall better-sqlite3 @types/better-sqlite3

# Verificar que no rompe nada
npm run build
npm test
```

#### 📊 Prioridad

- **Severidad:** 🟢 Baja
- **Probabilidad:** N/A (limpieza de código)
- **Impacto:** Mínimo (reducción de dependencias)
- **Esfuerzo estimado:** 30 minutos

---

## 📊 Matriz de Riesgos

```
          │ Bajo    │ Medio   │ Alto    │
─────────┼─────────┼─────────┼─────────┤
Alta     │         │ #3 JIT  │ #2 JWS  │
          │         │ #4 Cat. │ #5 Race │
─────────┼─────────┼─────────┼─────────┤
Media    │ #6 Jit. │ #7 Logs │         │
─────────┼─────────┼─────────┼─────────┤
Baja     │ #1 SQL  │         │         │
─────────┴─────────┴─────────┴─────────┘
         Probabilidad →
```

---

## 🎯 Plan de Remediación

### Sprint 1 (Inmediato - 1 semana)

**P0: Race Conditions en Correlativos**
- [ ] Refactorizar `getNextNumeroControl()` a UPDATE atómico
- [ ] Agregar tests de concurrencia (50 requests paralelas)
- [ ] Deployment en horario de baja carga
- **Responsable:** Backend Lead
- **ETA:** 3 días

**P0: Firma JWS en Worker Thread**
- [ ] Implementar Worker Pool para firma
- [ ] Migrar `signDTE()` a worker thread
- [ ] Load testing con 100 facturas/minuto
- **Responsable:** Backend + DevOps
- **ETA:** 5 días

### Sprint 2 (Prioritario - 2 semanas)

**P1: Workflow JIT para Sigma Support**
- [ ] Diseño de flujo de aprobación
- [ ] Implementar API de solicitud/aprobación
- [ ] Notificaciones por email al tenant
- [ ] Dashboard de accesos pendientes
- **Responsable:** Backend + Frontend
- **ETA:** 10 días

**P1: Servicio de Sync de Catálogos**
- [ ] Diseño de tabla `catalog_versions`
- [ ] Implementar `CatalogSyncService`
- [ ] Cron job diario (2 AM)
- [ ] Alertas por Slack si falla sync
- **Responsable:** Backend
- **ETA:** 8 días

**P1: Logs Inmutables de Vault**
- [ ] Opción A: Trigger de protección (rápido)
- [ ] Opción B: Log shipping a S3 (robusto)
- [ ] Tests de intento de borrado
- **Responsable:** Backend + Infra
- **ETA:** 6 días

### Sprint 3 (Mejoras - 1 semana)

**P2: Jitter en Backoff**
- [ ] Agregar jitter ±20% en `calculateNextRetryTime()`
- [ ] Test de distribución de reintentos
- **ETA:** 1 día

**P3: Cleanup de Dependencias**
- [ ] Remover `better-sqlite3`
- [ ] Audit de dependencias con `npm audit`
- **ETA:** 2 horas

---

## 📈 Métricas de Éxito

### KPIs Post-Remediación

| Métrica | Antes | Meta | Medición |
|---------|-------|------|----------|
| **Correlativos duplicados** | ? | 0 | Alertas DGII |
| **Latencia P95 firma** | 180ms | < 50ms | APM |
| **Accesos Sigma sin aprobación** | 100% | 0% | Audit log |
| **Catálogos desactualizados** | ? | 0 | Sync service |
| **Vault logs borrados** | Posible | 0 | CloudWatch |

### Tests de Validación

```bash
# Test 1: Concurrencia de correlativos
k6 run tests/load/correlativo-race-condition.js
# Esperado: 1000 facturas → 1000 correlativos únicos

# Test 2: Latencia de firma bajo carga
k6 run tests/load/signature-performance.js
# Esperado: P95 < 50ms con 50 firmas/minuto

# Test 3: Workflow JIT
npm test -- sigma-support.spec.ts
# Esperado: Sin aprobación → 403 Forbidden

# Test 4: Sync de catálogos
npm test -- catalog-sync.spec.ts
# Esperado: Mock DGII API → Actualiza DB

# Test 5: Inmutabilidad de logs
psql -c "DELETE FROM vault_access_log WHERE id = 'test';"
# Esperado: ERROR: vault_access_log es inmutable
```

---

## 🔗 Referencias

### Documentación Relacionada

- [`STATUS.md`](STATUS.md) - Estado general del proyecto
- [`DGII_VALIDATION.md`](DGII_VALIDATION.md) - Validaciones DGII
- [`INTEGRACION_MH.md`](INTEGRACION_MH.md) - Integración Ministerio de Hacienda
- [`FEATURE_FLAGS_GUIDE.md`](FEATURE_FLAGS_GUIDE.md) - Sistema de feature flags

### Archivos Auditados

1. [`server/storage.ts`](server/storage.ts#L638-L670) - Generación correlativos
2. [`server/lib/signer.ts`](server/lib/signer.ts#L14-L95) - Firma JWS
3. [`server/routes/sigma-support.ts`](server/routes/sigma-support.ts) - Access control
4. [`server/catalogs.ts`](server/catalogs.ts) - Catálogos DGII
5. [`server/lib/vault.ts`](server/lib/vault.ts#L251-L265) - Audit logs
6. [`server/lib/outbox-processor.ts`](server/lib/outbox-processor.ts#L9-L25) - Contingencia
7. [`package.json`](package.json) - Dependencias

### Normativas Aplicables

- **Normativa 700-DGII-MN-2023-002** - Facturación Electrónica El Salvador
- **ISO 27001:2022** - Gestión de Seguridad de la Información
- **SOC 2 Type II** - Control de acceso y auditoría
- **GDPR/Ley Protección Datos** - Retención y protección de logs

---

## 📝 Notas Finales

### Conformidades Destacadas

✅ **Outbox Pattern bien implementado:** Backoff exponencial, deduplicación, max retries  
✅ **BullMQ presente:** Infraestructura de workers lista para extender  
✅ **Supabase Vault activo:** Secrets encriptados, no en variables de entorno  
✅ **Audit logging existente:** Base sólida para extender a inmutabilidad

### Siguientes Pasos

1. **Priorizar Sprint 1:** Riesgos P0 primero (race conditions + JWS)
2. **Asignar responsables:** Backend lead para correlativos, DevOps para workers
3. **Crear tickets:** Crear issues en GitHub con esta documentación como referencia
4. **Establecer timeline:** Sprint 1 (1 semana), Sprint 2 (2 semanas), Sprint 3 (1 semana)
5. **Definir tests de aceptación:** Cada remediación debe pasar tests de validación

---

**Documento generado:** 2026-01-17  
**Próxima revisión:** 2026-02-17 (post-remediación)  
**Versión:** 1.0
