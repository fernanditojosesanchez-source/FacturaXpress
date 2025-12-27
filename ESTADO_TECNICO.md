# Estado Técnico y Alcance

## Tecnologías principales
- Frontend: React 18 + TypeScript, Vite, TanStack Query, react-hook-form + Zod, Shadcn/UI, Tailwind.
- Backend: Node + Express, TypeScript, AJV + ajv-formats, session cookies (HTTP-only), drizzle-zod schemas compartidos.
- Validación DGII: JSON Schema oficial (server/dgii-resources/factura-schema.json) + `validateDTESchema` (AJV).
- Infra UI: Animaciones ligeras (animate-fade-in-up), smart blur selectivo, tablas responsivas.

## Funcionalidad implementada
- Autenticación: login/logout/me con sesiones y hook `useAuth` + rutas protegidas.
- Catálogos DGII: endpoints `/api/catalogos/*` y hook `useCatalogos` con caché 1h; integrados en formularios.
- Formulario Nueva Factura:
  - Selects dinámicos (tipo DTE, tipo doc, departamento, condición, forma de pago, unidad medida, tipo item).
  - Columna de unidad de medida en items; payload usa `uniMedida` real.
  - Pre-validación DGII antes de crear factura (`useValidateDTE` → `POST /api/validar-dte`).
  - Banners de error/éxito DGII; botón con estados Validando/Generando.
  - Helper `buildFacturaPayload` evita duplicación y garantiza esquema completo.
- Backend facturas: `POST /api/facturas` valida Zod + AJV, `GET /api/facturas` lista.
- Documentación: DGII_VALIDATION.md, STATUS.md, QUICK_REFERENCE.md, INTEGRATION_PLAN.md, SUMMARY.md, DOCUMENTATION_INDEX.md, PLAN_ACCION.md, etc.
- Scripts: `verify.sh` para chequeos rápidos.

## Visual y UX
- Dashboard y formularios sin blur invasivo; cards con fondos sólidos.
- Inputs numéricos ampliados en items; layout 4 columnas (3/4 formulario, 1/4 resumen).
- Botones con estados hover y feedback en banners.

## Qué falta / Próximos pasos
1) Firma digital DTE: integrar servicio de firmado (SVFE-API-Firmador), endpoint `POST /api/dte/firmar`, manejo de certificados.
2) Transmisión MH: endpoint `POST /api/dte/enviar`, manejo de respuestas (aprobado/rechazado), almacenamiento `selloRecibido`.
3) Vista previa enriquecida: mostrar unidades y nombres legibles de catálogos en la previsualización.
4) Hardening: más pruebas automáticas, manejo de errores y límites de tamaño en uploads futuros.

## Estado actual del repositorio
- Rama: main (sin pending after push).
- Build pasa (`npm run build`).
- Warning PostCSS `from`: inofensivo.

## Cómo validar rápidamente
- `npm run dev` → login `admin/admin` (usar seed si falta).
- Nueva factura → probar datos incompletos (ver errores DGII) y datos completos (crear factura con payload válido).
