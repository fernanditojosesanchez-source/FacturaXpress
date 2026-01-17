# 🚀 FacturaXpress - Plataforma de Facturación Electrónica

**Estado del Proyecto:** ✅ **Activo** | **Versión:** 2.1.0 | **Última Actualización:** 2026-01-17 | **Status:** ✅ DEPLOYED

---

## � **DEPLOYMENT COMPLETADO: Migraciones + Cron Jobs**

**Fecha:** 17 de enero de 2026 | **Commit:** `616ac5a`

### ✅ Migraciones Ejecutadas (4/4)

1. **sigma_jit** - JIT workflow para Sigma Support (3 tablas, 4 índices)
2. **catalog_sync** - Sincronización automática de catálogos DGII (3 tablas, 9 índices, 1 trigger)
3. **vault_logs_immutable** - Logs de auditoría inmutables (2 tablas, 2 triggers, 4 RLS policies)
4. **feature_flags_rollout_v2** - Sistema de feature flags con rollout gradual (6 tablas, 15+ índices, 3 triggers, 7 RLS policies)

### ⏰ Cron Jobs Activos (2/2)

| Job | Frecuencia | Función | Status |
|-----|-----------|---------|--------|
| Feature Flags Auto-Rollout | Cada 15 min | Incrementa canary deployment | ✅ Configurado |
| Catalog Sync | 2:00 AM diarios | Sincroniza catálogos DGII | ✅ Activo |

**Ver:** [DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md) para detalles completos

---

## �🎯 Resumen Ejecutivo

**FacturaXpress** es una plataforma de facturación electrónica diseñada para simplificar la emisión, recepción y validación de Documentos Tributarios Electrónicos (DTE) en cumplimiento con las normativas de la DGII.

La plataforma está construida con un stack moderno y seguro, utilizando **React** y **TypeScript** en el frontend, y **Node.js/Express** en el backend, con **Supabase/PostgreSQL** como base de datos.

### 🆕 **FASE 3 COMPLETADA: Feature Flags + Rollout Gradual**

**FacturaXpress v2.1** ahora incluye sistema profesional de feature flags:

#### 🚦 Feature Flags & Rollout Gradual
Sistema completo para control dinámico de funcionalidades:
- ✅ 5 estrategias de rollout (boolean, percentage, tenants, user_ids, gradual)
- ✅ Canary deployments y A/B testing
- ✅ Rollout por porcentaje de usuarios
- ✅ Kill switches para emergencias
- ✅ Monitoreo y analytics integrados
- ✅ UI de administración completa

> **Documentación Feature Flags:** [FEATURE_FLAGS_GUIDE.md](FEATURE_FLAGS_GUIDE.md)

### 🆕 **FASE 2 COMPLETADA: Stock en Tránsito + Sigma Support**

**FacturaXpress v2.0** ahora incluye dos nuevas funcionalidades principales:

#### 📦 Stock en Tránsito
Sistema completo de gestión de movimientos de inventario entre sucursales:
- ✅ Rastreo automático de entregas
- ✅ Análisis de eficiencia de transporte
- ✅ Alertas automáticas de problemas (entregas parciales, devoluciones)
- ✅ Historial completo de cambios
- ✅ Dashboard con métricas en tiempo real

#### 🔐 Soporte Sigma (Admin)
Sistema de auditoría y control de acceso para personal de soporte:
- ✅ Control de acceso temporal con expiración automática
- ✅ Auditoría completa sin PII (100% seguro)
- ✅ Gestión de tickets de soporte
- ✅ Estadísticas por tenant
- ✅ Permisos granulares

> **Documentación Fase 2:** [README_FASE2.md](README_FASE2.md) | [Guía de Usuario](STOCK_SIGMA_USER_GUIDE.md)

### ✨ **Arquitectura de Seguridad con Supabase Vault**

Todos los datos sensibles, como **certificados digitales, contraseñas y credenciales**, ahora se almacenan de forma segura utilizando **Supabase Vault**, una solución de gestión de secretos de nivel empresarial.

**Características Clave de Seguridad:**
- ✅ **Encriptación Industrial:** XChaCha20Poly1305 (libsodium).
- ✅ **Claves Gestionadas por Supabase:** Las claves de encriptación nunca son accesibles para la aplicación.
- ✅ **Auditoría Completa:** Cada acceso a un secreto es registrado (quién, qué, cuándo, desde dónde).
- ✅ **Aislamiento de Tenants:** Cada cliente solo puede acceder a sus propios secretos.
- ✅ **Cero Texto Plano:** Los secretos nunca se almacenan sin encriptar en la base de datos, backups o logs.

> Para más detalles, consulta la **[Política de Seguridad de Vault](VAULT_SECURITY_POLICY.md)**.

---

## 🚀 Quick Start para Desarrolladores

### 1. **Requisitos Previos**
- Node.js (v18+)
- npm/pnpm/yarn
- Supabase CLI (para gestión de base de datos local)
- Un proyecto de Supabase configurado.

### 2. **Instalación**

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd FacturaXpress

# 2. Instalar dependencias
npm install
```

### 3. **Configuración del Entorno**

Crea un archivo `.env` en la raíz del proyecto a partir de `.env.example` y completa las variables:

```env
# Supabase
SUPABASE_URL="https://<project_ref>.supabase.co"
SUPABASE_ANON_KEY="<your_anon_key>"
DATABASE_URL="postgresql://postgres:<your_db_password>@db.<project_ref>.supabase.co:5432/postgres"

# Aplicación
PORT=5000
ENCRYPTION_KEY="<una_clave_segura_de_32_caracteres>" # Para encriptación legacy
ADMIN_PASSWORD="<contraseña_para_el_super_admin>"

# Redis (Rate limiting distribuido y colas BullMQ)
# Usa REDIS_URL o parámetros separados. Ejemplos:
# REDIS_URL="rediss://default:<PASSWORD>@<HOST>:6380/0"
# REDIS_HOST="<HOST>"
# REDIS_PORT=6380
# REDIS_USERNAME="default"
# REDIS_PASSWORD="<PASSWORD>"
# REDIS_TLS=true
# Prefijo de claves para aislar entornos/tenants
REDIS_NAMESPACE=fx
```

### 4. **Ejecutar la Aplicación (Modo Desarrollo)**

```bash
# Inicia el servidor de desarrollo (backend y frontend con Vite)
npm run dev
```
La aplicación estará disponible en `http://localhost:5000`.

### 5. **Acceder a las Nuevas Funcionalidades (Fase 2)**

Una vez iniciado el servidor, puedes acceder a:

**Stock en Tránsito** (Managers y Admins):
- URL: `http://localhost:5000/stock-transito`
- Gestión de movimientos de inventario entre sucursales

**Soporte Sigma** (Solo Admins):
- URL: `http://localhost:5000/sigma-support`
- Control de accesos y auditoría de soporte

> Ver guía completa: [STOCK_SIGMA_USER_GUIDE.md](STOCK_SIGMA_USER_GUIDE.md)

### 6. **Ejecutar Tests**

```bash
# Todos los tests (incluyendo Fase 2)
npm run test

# Tests específicos de Fase 2
npm run test -- stock-transito
npm run test -- sigma-support

# Watch mode
npm run test:watch
```

### 7. **Probar la Implementación de Vault**

Para verificar que la integración con Supabase Vault funciona correctamente, ejecuta el script de testing:

```bash
# Este script realiza 9 pruebas de integración con Vault
npx ts-node scripts/test-vault.ts
```

**Salida esperada:**
```
✅ TODOS LOS TESTS PASARON (9/9 - 100%)
```

### 8. **Verificar Conectividad Redis (opcional)**

```bash
# Requiere definir variables REDIS_*
npm run check:redis
```

Salida esperada:
```
✅ PING/PONG y SET/GET OK: ok
```

### 9. **Gestionar Feature Flags**

Para activar/desactivar features dinámicamente:

**UI de Admin:**
- URL: `http://localhost:5000/configuracion` → pestaña "Feature Flags"

**API REST:**
```bash
# Listar todos los flags
curl http://localhost:5000/api/admin/feature-flags

# Toggle de un flag
curl -X POST http://localhost:5000/api/admin/feature-flags/mi_feature/toggle

# Incrementar rollout gradual
curl -X POST http://localhost:5000/api/admin/feature-flags/mi_feature/increment-rollout \
  -H "Content-Type: application/json" \
  -d '{ "incremento": 10 }'
```

> Ver guía completa: [FEATURE_FLAGS_GUIDE.md](FEATURE_FLAGS_GUIDE.md)

---

## 📚 Documentación Esencial

Para ponerte al día rápidamente, revisa los siguientes documentos en orden:

### 🆕 Documentación Fase 3 (Feature Flags)

1. **[FEATURE_FLAGS_GUIDE.md](FEATURE_FLAGS_GUIDE.md)** (30 min)
   - **Para todos.** Guía completa de feature flags: uso, estrategias, best practices.

### 🆕 Documentación Fase 2 (Stock + Sigma)

1. **[PROJECT_DASHBOARD.md](PROJECT_DASHBOARD.md)** (5 min)
   - **Para todos.** Vista general del proyecto v2.0 con métricas y funcionalidades.

2. **[STOCK_SIGMA_USER_GUIDE.md](STOCK_SIGMA_USER_GUIDE.md)** (15 min)
   - **Para usuarios finales.** Cómo usar Stock en Tránsito y Sigma Support.

3. **[README_FASE2.md](README_FASE2.md)** (10 min)
   - **Para desarrolladores.** Overview técnico de las nuevas funcionalidades.

4. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** (30 min)
   - **Para DevOps.** Guía completa para deployar a producción.

5. **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** (5 min)
   - **Para todos.** Índice completo de toda la documentación disponible.

### 🔐 Documentación de Seguridad (Vault)

1. **[VAULT_QUICK_START.md](VAULT_QUICK_START.md)** (5 min)
   - **Para desarrolladores.** Cómo usar la nueva API de Vault para guardar y leer secretos.

2. **[VAULT_SECURITY_POLICY.md](VAULT_SECURITY_POLICY.md)** (10 min)
   - **Para todos.** Las reglas de oro de seguridad. Qué se debe y qué no se debe hacer.

### 📊 Estado del Proyecto

1. **[STATUS.md](STATUS.md)** - Estado general del proyecto
2. **[STATUS_FASE2.md](STATUS_FASE2.md)** - Estado detallado de Fase 2
3. **[P2_FINAL_CHECKLIST.md](P2_FINAL_CHECKLIST.md)** - Checklist de validación completo

### 📖 Documentación Adicional

- **[documentacion/DOCUMENTATION_INDEX.md](documentacion/DOCUMENTATION_INDEX.md)** - Índice de documentación técnica
- **[CIRCUIT_BREAKER.md](CIRCUIT_BREAKER.md)** - Patrón Circuit Breaker implementado
- **[MONOREPO_MIGRATION_PLAN.md](MONOREPO_MIGRATION_PLAN.md)** - Plan de migración a monorepo

---

## 🗂️ Estructura del Proyecto

```
FacturaXpress/
├── client/                      # Frontend React + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── stock-transito.tsx        🆕 Stock en Tránsito
│   │   │   ├── sigma-support.tsx         🆕 Sigma Support
│   │   │   ├── dashboard.tsx
│   │   │   ├── nueva-factura.tsx
│   │   │   └── ...
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   └── public/
├── server/                      # Backend Node.js + Express
│   ├── lib/
│   │   ├── stock-transito.ts             🆕 Queries Stock (5)
│   │   ├── sigma-support.ts              🆕 Queries Sigma (6)
│   │   ├── vault.ts                      # Supabase Vault integration
│   │   ├── circuit-breaker.ts            # Resilience pattern
│   │   ├── redis.ts                      # Cache + Rate limiting
│   │   └── ...
│   ├── routes/
│   │   ├── stock-transito.ts             🆕 Endpoints Stock (9)
│   │   ├── sigma-support.ts              🆕 Endpoints Sigma (4)
│   │   └── ...
│   └── index.ts
├── shared/                      # Schemas compartidos
│   └── schema.ts                # Drizzle ORM schemas (7 nuevas tablas)
├── tests/
│   └── unit/
│       ├── stock-transito.test.ts        🆕 8 test cases
│       ├── sigma-support.test.ts         🆕 10 test cases
│       └── ...
├── apps/
│   └── load-tests/              🆕 K6 load testing suite
├── documentacion/               # Docs técnicas
├── scripts/                     # Utilidades
└── ...
```
├── client/         # Frontend en React + TypeScript
├── server/         # Backend en Express.js
│   ├── lib/
│   │   └── vault.ts  # 🔐 Servicio centralizado de Vault
│   ├── routes/
│   │   └── certificados.ts # Endpoints de ejemplo para Vault
│   └── storage.ts    # Capa de abstracción de datos (con integración de Vault)
├── scripts/
│   └── test-vault.ts # 🧪 Script de prueba de Vault
├── VAULT_*.md      # 📄 Documentación de la arquitectura de seguridad
└── ...
```

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, sigue las guías de estilo y seguridad del proyecto. Antes de implementar una nueva característica que maneje datos sensibles, consulta la **[Política de Seguridad de Vault](VAULT_SECURITY_POLICY.md)**.
