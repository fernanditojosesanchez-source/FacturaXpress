# 📚 Índice de Documentación - FacturaXpress

## 🎯 Empezar Aquí

### Para Desarrolladores Nuevos
1. **[SUMMARY.md](SUMMARY.md)** - Resumen ejecutivo (5 min)
2. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Tarjeta de referencia rápida (3 min)
3. **[STATUS.md](STATUS.md)** - Estado actual del proyecto (5 min)

### 🔐 NUEVO: Seguridad con Vault (Lectura Obligatoria)
1. **[VAULT_QUICK_START.md](../VAULT_QUICK_START.md)** - Guía rápida para desarrolladores (5 min) ⭐
2. **[VAULT_SECURITY_POLICY.md](../VAULT_SECURITY_POLICY.md)** - Política de seguridad (10 min) 📋
3. **[VAULT_COMPLETION_SUMMARY.md](../VAULT_COMPLETION_SUMMARY.md)** - Resumen técnico (15 min) 📊
4. **[VAULT_IMPLEMENTATION_STATUS.md](../VAULT_IMPLEMENTATION_STATUS.md)** - Estado técnico detallado (20 min) 🔧

### Para Integración UI (Próxima Fase)
1. **[INTEGRATION_PLAN.md](INTEGRATION_PLAN.md)** - Plan detallado de integración
2. **[DGII_VALIDATION.md](DGII_VALIDATION.md)** - Documentación técnica de validación

---

## 📖 Documentación por Tema

### 🔐 Seguridad con Supabase Vault
- **Política de Seguridad**: [VAULT_SECURITY_POLICY.md](../VAULT_SECURITY_POLICY.md)
- **Quick Start (EMPEZAR AQUÍ)**: [VAULT_QUICK_START.md](../VAULT_QUICK_START.md) ⭐
- **Implementación Técnica**: [VAULT_IMPLEMENTATION_STATUS.md](../VAULT_IMPLEMENTATION_STATUS.md)
- **Resumen de Completación**: [VAULT_COMPLETION_SUMMARY.md](../VAULT_COMPLETION_SUMMARY.md)
- **Servicio**: [server/lib/vault.ts](../server/lib/vault.ts)
- **Métodos en Storage**: [server/storage.ts](../server/storage.ts) (nuevos métodos)
- **Endpoints Demo**: [server/routes/certificados.ts](../server/routes/certificados.ts)
- **Testing**: `npx ts-node scripts/test-vault.ts`
- **Datos en Vault**: Certificados P12, contraseñas, credenciales MH, API Keys

### 🔐 Autenticación
- **Archivo**: [server/auth.ts](../server/auth.ts)
- **Hook**: [client/src/hooks/use-auth.ts](../client/src/hooks/use-auth.ts)
- **Referencia**: QUICK_REFERENCE.md → Sección "Autenticación"

### 📚 Catálogos DGII
- **Archivo**: [server/catalogs.ts](server/catalogs.ts)
- **Schema**: [shared/schema.ts](shared/schema.ts)
- **Hook**: [client/src/hooks/use-catalogos.ts](client/src/hooks/use-catalogos.ts)
- **Endpoints**: 
  - GET /api/catalogos/all
  - GET /api/catalogos/departamentos
  - GET /api/catalogos/tipos-documento
  - GET /api/catalogos/tipos-dte
  - GET /api/catalogos/condiciones-operacion
  - GET /api/catalogos/formas-pago
  - GET /api/catalogos/unidades-medida

### ✔️ Validación DGII Schema
- **Validador**: [server/dgii-validator.ts](server/dgii-validator.ts)
- **Schema**: [server/dgii-resources/factura-schema.json](server/dgii-resources/factura-schema.json)
- **Hook**: [client/src/hooks/use-validate-dte.ts](client/src/hooks/use-validate-dte.ts)
- **Endpoint**: POST /api/validar-dte
- **Documentación**: [DGII_VALIDATION.md](DGII_VALIDATION.md)

### 🧾 API REST
- **Rutas**: [server/routes.ts](server/routes.ts)
- **Documentación**: QUICK_REFERENCE.md → Sección "Endpoints"
- **Testing**: QUICK_REFERENCE.md → Sección "Testing Rápido"

### 📋 Formularios (Próxima Fase)
- **Plan**: [INTEGRATION_PLAN.md](INTEGRATION_PLAN.md)
- **Componentes**: Por crear
- **Validación**: useValidateDTE()

---

## 🔍 Archivos Importantes

### Backend
```
server/
├── index.ts              - Punto de entrada Express
├── routes.ts             - Definición de endpoints API
├── auth.ts               - Autenticación y sesiones
├── catalogs.ts           - Definiciones de catálogos DGII
├── dgii-validator.ts     - Validación de DTEs (NUEVO)
├── dgii-resources/
│   └── factura-schema.json  - Schema DGII (NUEVO)
└── mh-service.ts         - Integración MH (simulada)
```

### Frontend
```
client/
└── src/
    ├── hooks/
    │   ├── use-auth.ts
    │   ├── use-catalogos.ts
    │   └── use-validate-dte.ts       (NUEVO)
    ├── pages/
    │   ├── login.tsx
    │   ├── dashboard.tsx
    │   └── crear-factura.tsx         (próxima fase)
    └── components/
        └── (por crear en próxima fase)
```

### Shared
```
shared/
└── schema.ts             - Schemas Zod con validaciones
```

### Documentación
```
├── SUMMARY.md            - Resumen ejecutivo (NUEVO)
├── STATUS.md             - Estado actual (NUEVO)
├── QUICK_REFERENCE.md    - Referencia rápida (NUEVO)
├── DGII_VALIDATION.md    - Documentación técnica (NUEVO)
├── INTEGRATION_PLAN.md   - Plan de integración (NUEVO)
├── PLAN_ACCION.md        - Plan de acción inicial
├── COMPONENT_NESTING_GUIDE.md
└── design_guidelines.md
```

---

## 🚀 Comandos Comunes

```bash
# Desarrollo
npm run dev              # Iniciar servidor + cliente

# Build
npm run build            # Compilar para producción
npm run check            # Verificar TypeScript

# Lint
npm run lint             # Verificar linting
npm run lint:fix         # Arreglar errores de linting

# Testing
# (No configurado aún)
```

---

## 🧪 Testing Rápido

### Validar DTE
```bash
curl -X POST http://localhost:5000/api/validar-dte \
  -H "Content-Type: application/json" \
  -d @test-dte-ejemplo.json
```

### Obtener Catálogos
```bash
curl http://localhost:5000/api/catalogos/all
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"admin","password":"admin"}'
```

---

## 📊 Estado de Implementación

| Fase | Componente | Estado |
|------|-----------|--------|
| 0 | Autenticación | ✅ 100% |
| 0 | Catálogos DGII | ✅ 100% |
| 0 | Validación Schema | ✅ 100% |
| 1 | Formularios UI | 🔄 0% |
| 2 | Firma Digital | ⏳ 0% |
| 3 | Transmisión MH | ⏳ 0% |

---

## 👥 Roles y Responsabilidades

### Backend Developer
- Mantener [server/dgii-validator.ts](server/dgii-validator.ts)
- Actualizar [server/catalogs.ts](server/catalogs.ts) si hay nuevos catálogos
- Integrar firma digital (próxima fase)

### Frontend Developer
- Crear componentes de formulario
- Integrar hooks: useAuth(), useCatalogos(), useValidateDTE()
- Implementar validación en tiempo real

### QA/Testing
- Testear validación con casos válidos e inválidos
- Verificar flujo completo: crear → validar → firmar → transmitir

---

## 🔗 Recursos Externos

- **DGII**: https://www.hacienda.gob.sv/
- **Estándares DTE**: https://dgii.mh.gob.sv/
- **AJV (Validador)**: https://ajv.js.org/
- **React Query**: https://tanstack.com/query/latest
- **Zod (Validación)**: https://zod.dev/

---

## ⚠️ Notas Importantes

1. **Catálogos en caché**: 1 hora en frontend
2. **Sessions**: HTTP-only cookies, seguras
3. **Validación doble**: Cliente (Zod) + Servidor (Zod + AJV)
4. **Ambiente**: 00 = Pruebas, 01 = Producción
5. **Moneda**: Default USD, personalizable

---

## 📞 Preguntas Frecuentes

**P: ¿Dónde está el validador?**
R: [server/dgii-validator.ts](server/dgii-validator.ts)

**P: ¿Cuál es el schema de DTE?**
R: [server/dgii-resources/factura-schema.json](server/dgii-resources/factura-schema.json)

**P: ¿Cómo valido un DTE desde el frontend?**
R: Usa el hook `useValidateDTE()` de [client/src/hooks/use-validate-dte.ts](client/src/hooks/use-validate-dte.ts)

**P: ¿Qué catálogos están disponibles?**
R: Ve [STATUS.md](STATUS.md) → Sección "Catálogos DGII"

**P: ¿Cuál es la próxima fase?**
R: Integración de formularios. Lee [INTEGRATION_PLAN.md](INTEGRATION_PLAN.md)

---

## 🎯 Próximos Pasos

1. **Semana 1**: Integración de formularios
2. **Semana 2**: Firma digital (SVFE-API-Firmador)
3. **Semana 3**: Transmisión al MH
4. **Semana 4**: Testing exhaustivo y documentación

---

**Última actualización**: 26 de Diciembre, 2025  
**Versión**: 1.0  
**Mantenedor**: FacturaXpress Team
