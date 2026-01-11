# 📋 Plan de Acción - FacturaXpress
**Versión**: 1.0  
**Fecha**: 25 de diciembre de 2025  
**Duración estimada**: 6 meses  

---

## 🎯 Objetivos Estratégicos

1. **Seguridad**: Sistema de autenticación y autorización robusto
2. **Productividad**: Catálogos de productos/clientes para agilizar facturación
3. **Cumplimiento**: Integración real con Ministerio de Hacienda
4. **Escalabilidad**: Soporte multi-usuario y alto volumen de transacciones
5. **Experiencia**: UX mejorada con notificaciones, reportes avanzados y modo offline

---

## 📅 FASE 1: Fundamentos de Seguridad y Producción (Semanas 1-8)

### **Sprint 1: Autenticación Básica** (Semanas 1-2)
**Prioridad**: 🔴 CRÍTICA

#### Tareas Backend
- [ ] Crear esquema de usuarios en `shared/schema.ts`
  ```typescript
  - id, email, password (hash), nombre, rol (admin/usuario), createdAt
  ```
- [ ] Implementar `bcrypt` para hash de contraseñas
- [ ] Configurar `express-session` con MemoryStore (después migrar a PG)
- [ ] Middleware de autenticación `requireAuth()` en routes.ts
- [ ] Endpoints:
  - `POST /api/auth/register` (solo admin puede crear usuarios)
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`

#### Tareas Frontend
- [ ] Crear `pages/login.tsx` con formulario Zod
- [ ] Crear `pages/register.tsx` (solo accesible por admin)
- [ ] Hook `useAuth()` con contexto global
- [ ] Proteger rutas con `<ProtectedRoute>`
- [ ] Mostrar usuario logueado en navbar

#### Estimación
- Backend: 8 horas
- Frontend: 6 horas
- Testing manual: 2 horas
- **Total: 16 horas (2 días)**

---

### **Sprint 2: Certificado Digital MH** (Semanas 3-4)
**Prioridad**: 🔴 CRÍTICA

#### Tareas
- [ ] Obtener certificado `.p12` del MH (trámite externo)
- [ ] Instalar dependencias: `node-forge`, `jsrsasign`
- [ ] Implementar firma PKCS#7 en `mh-service.ts`
- [ ] Crear `MHServiceReal` clase que reemplace Mock
- [ ] Configurar variables de entorno:
  ```bash
  MH_CERT_PATH=/certs/emisor.p12
  MH_CERT_PASSWORD=****
  MH_API_BASE_URL=https://api.mh.gob.sv/v1
  MH_AMBIENTE=00 # 00=prueba, 01=producción
  ```
- [ ] Endpoint de prueba: transmitir DTE de test y validar sello
- [ ] Manejo de errores específicos del MH (timeouts, rechazos)

#### Entregables
- `server/mh-real.ts` con firma funcional
- Documentación de configuración
- Script de validación de certificado

#### Estimación
- Investigación/setup: 6 horas
- Implementación: 12 horas
- Pruebas con MH sandbox: 6 horas
- **Total: 24 horas (3 días)**

---

### **Sprint 3: Seguridad Backend** (Semanas 5-6)
**Prioridad**: 🟡 IMPORTANTE

#### Tareas
- [ ] Instalar `helmet` para headers de seguridad
- [ ] Configurar CORS con whitelist de dominios
- [ ] Implementar `express-rate-limit`:
  - Login: 5 intentos/15min
  - API general: 100 req/15min
- [ ] Validar duplicados de NIT en emisor
- [ ] Sanitización de inputs (trim, escape HTML)
- [ ] Logs de auditoría (quién creó/modificó facturas)
- [ ] Variables de entorno para secretos (JWT_SECRET, SESSION_SECRET)

#### Estimación
- 10 horas (1.5 días)

---

### **Sprint 4: Gestión de Productos** (Semanas 7-8)
**Prioridad**: 🟡 IMPORTANTE

#### Schema de DB
```typescript
Producto {
  id: string
  codigo: string (único)
  descripcion: string
  precioBase: number
  unidadMedida: string (99, 59, etc.)
  tipoItem: "1" | "2" | "3" | "4"
  activo: boolean
  createdAt: Date
}
```

#### Tareas Backend
- [ ] CRUD endpoints en `routes.ts`:
  - `GET /api/productos` (con paginación)
  - `POST /api/productos`
  - `PATCH /api/productos/:id`
  - `DELETE /api/productos/:id`
- [ ] Importador CSV (endpoint `POST /api/productos/import`)

#### Tareas Frontend
- [ ] Página `pages/productos.tsx` con tabla + CRUD
- [ ] Componente `<ProductoCombobox>` con search
- [ ] Integrar en `nueva-factura.tsx`:
  - Autocomplete al escribir descripción
  - Rellenar precio automáticamente
- [ ] Botón "Importar CSV" con drag & drop

#### Estimación
- Backend: 8 horas
- Frontend: 12 horas
- **Total: 20 horas (2.5 días)**

---

## 📅 FASE 2: Productividad y Experiencia (Semanas 9-16)

### **Sprint 5: Gestión de Clientes** (Semanas 9-10)
**Prioridad**: 🟡 IMPORTANTE

#### Schema
```typescript
Cliente {
  id: string
  tipoDocumento: string
  numDocumento: string (único)
  nombre: string
  nrc?: string
  direccion: { departamento, municipio, complemento }
  telefono?: string
  correo?: string
  activo: boolean
  totalFacturado: number (calculado)
  ultimaFactura?: Date
}
```

#### Tareas
- [ ] CRUD endpoints similares a productos
- [ ] Página `pages/clientes.tsx`
- [ ] Componente `<ClienteCombobox>` en nueva factura
- [ ] Vista "Historial por cliente" en historial.tsx
- [ ] Importador CSV de clientes

#### Estimación
- 18 horas (2 días)

---

### **Sprint 6: Notificaciones Email** (Semanas 11-12)
**Prioridad**: 🟡 IMPORTANTE

#### Tareas Backend
- [ ] Configurar Nodemailer con SMTP (Gmail/SendGrid)
- [ ] Template HTML de email con:
  - Logo del emisor
  - Resumen de factura
  - Botón "Ver PDF" (link temporal)
  - Footer con datos fiscales
- [ ] Endpoint `POST /api/facturas/:id/enviar-email`
- [ ] Cola de envíos con `bull` (Redis) para no bloquear

#### Tareas Frontend
- [ ] Botón "Enviar Email" en historial (modal con preview)
- [ ] Input de correos adicionales (CC, BCC)
- [ ] Notificación toast de confirmación/error
- [ ] Badge "Enviado por correo" en tabla

#### Estimación
- Backend: 10 horas
- Frontend: 6 horas
- **Total: 16 horas (2 días)**

---

### **Sprint 7: Reportes Avanzados** (Semanas 13-14)
**Prioridad**: 🟢 MEJORA

#### Nuevos reportes
- [ ] **Top 10 clientes** por monto facturado
- [ ] **Comparativa año anterior** (gráfico de líneas)
- [ ] **Proyección de ventas** (regresión lineal simple)
- [ ] **Distribución por departamento** (mapa de SV)
- [ ] **Análisis de IVA** (recaudado vs periodos anteriores)

#### Exportaciones
- [ ] Botón "Exportar Excel" usando `xlsx`
- [ ] Botón "Exportar PDF" con gráficos embebidos
- [ ] Filtros persistentes (guardar en localStorage)

#### Estimación
- 20 horas (2.5 días)

---

### **Sprint 8: Búsqueda y Filtros Avanzados** (Semanas 15-16)
**Prioridad**: 🟢 MEJORA

#### Mejoras en Historial
- [ ] Filtro por NIT/DUI del receptor (input dedicado)
- [ ] Slider de rango de montos (react-slider)
- [ ] Multi-select de estados (no solo uno)
- [ ] Búsqueda full-text en observaciones
- [ ] Guardar "vistas" de filtros (localStorage)
- [ ] Botón "Limpiar filtros"

#### Backend
- [ ] Endpoint con query params avanzados:
  ```
  GET /api/facturas?
    search=cliente&
    estados=generada,sellada&
    minAmount=100&
    maxAmount=5000&
    dateFrom=2025-01-01&
    dateTo=2025-12-31&
    tipoDte=01,03
  ```

#### Estimación
- 14 horas (2 días)

---

## 📅 FASE 3: Escalabilidad y Optimización (Semanas 17-24)

### **Sprint 9: Multi-Usuario y Permisos** (Semanas 17-19)
**Prioridad**: 🟢 MEJORA

#### Roles
- **Admin**: Acceso total, gestiona usuarios
- **Contador**: CRUD facturas, clientes, productos, reportes
- **Vendedor**: Solo crear/ver facturas propias
- **Auditor**: Solo lectura

#### Tareas
- [ ] Tabla `permisos` con matriz rol-acción
- [ ] Middleware `requireRole(['admin', 'contador'])`
- [ ] Filtrar facturas por `creadoPor` si rol=vendedor
- [ ] UI de gestión de usuarios en `/configuracion`
- [ ] Selector de usuario activo en navbar (si admin)

#### Estimación
- 24 horas (3 días)

---

### **Sprint 10: PWA y Modo Offline** (Semanas 20-21)
**Prioridad**: 🔵 OPCIONAL

#### Tareas
- [ ] Configurar Vite PWA plugin
- [ ] Service Worker que cachea:
  - Assets estáticos (JS, CSS, fonts)
  - Datos de productos/clientes
  - Facturas recientes
- [ ] Sincronización cuando vuelve conexión
- [ ] Banner "Trabajando sin conexión"
- [ ] `manifest.json` con íconos PWA

#### Estimación
- 16 horas (2 días)

---

### **Sprint 11: Testing Automatizado** (Semanas 22-23)
**Prioridad**: 🟡 IMPORTANTE

#### Stack de testing
- **Vitest**: Tests unitarios (utils, schemas)
- **React Testing Library**: Componentes
- **Playwright**: E2E flows

#### Cobertura mínima
- [ ] `utils.ts`: 90%
- [ ] Schemas Zod: 85%
- [ ] Componentes críticos: 70%
- [ ] E2E: Login → Crear factura → Transmitir → Ver historial

#### Estimación
- 30 horas (4 días)

---

### **Sprint 12: Optimizaciones de Performance** (Semana 24)
**Prioridad**: 🟢 MEJORA

#### Tareas
- [ ] React.lazy() para rutas pesadas
- [ ] Virtualización de tabla larga (react-virtual)
- [ ] Optimistic updates en mutations
- [ ] Server-side pagination (limit/offset)
- [ ] Índices en DB (numDocumento, codigoGeneracion)
- [ ] Compresión gzip en Express
- [ ] CDN para assets estáticos

#### Estimación
- 12 horas (1.5 días)

---

## 🚀 Quick Wins (Implementación Inmediata)

### **Quick Win 1: Atajos de Teclado** ⏱️ 2 horas
```typescript
// En App.tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      navigate('/factura/nueva');
    }
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      navigate('/historial');
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### **Quick Win 2: Confirmación de Eliminación Global** ⏱️ 1 hora
- Usar `<AlertDialog>` en todos los DELETE
- Texto personalizado según entidad

### **Quick Win 3: Indicador de Carga Global** ⏱️ 3 horas
- Barra de progreso arriba (NProgress o similar)
- Activar durante mutations/queries lentas

### **Quick Win 4: Contador de Facturas en Dashboard** ⏱️ 30min
- Badge con total de facturas en navbar
- Badge con facturas pendientes de transmitir

### **Quick Win 5: Tema del Emisor** ⏱️ 4 horas
- Upload de logo en `/configuracion`
- Mostrar logo en navbar y PDFs
- Selector de color primario (guardar en emisor)

---

## 📊 Métricas de Éxito

### KPIs Técnicos
- **Uptime**: >99.5%
- **Response time**: <200ms (p95)
- **Test coverage**: >80%
- **Lighthouse score**: >90

### KPIs de Negocio
- **Tiempo de facturación**: <2min (actual ~5min)
- **Tasa de error MH**: <2%
- **Satisfacción del usuario**: >4.5/5
- **Facturas/mes**: Capacidad para >1000

---

## 🛠 Stack Tecnológico Actualizado

### Nuevas Dependencias
```json
{
  "bcrypt": "^5.1.1",
  "nodemailer": "^6.9.8",
  "bull": "^4.12.0",
  "redis": "^4.6.13",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.5",
  "node-forge": "^1.3.1",
  "jsrsasign": "^11.1.0",
  "xlsx": "^0.18.5",
  "vitest": "^1.6.0",
  "@playwright/test": "^1.42.0"
}
```

---

## 🎓 Recursos de Aprendizaje

### Documentación MH
- [Manual DTE El Salvador](https://www.mh.gob.sv/factura/)
- [API Reference](https://api.mh.gob.sv/docs)
- Decreto 700-DGII-MN-2023

### Tutoriales
- [Node.js Authentication Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices)
- [React Query Advanced Patterns](https://tanstack.com/query/latest/docs/react/guides/advanced-ssr)
- [PKCS#7 Signing in Node.js](https://github.com/digitalbazaar/forge)

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Certificado MH no llega a tiempo | Media | Alto | Continuar con Mock, agregar flag de producción |
| Performance con >10k facturas | Alta | Medio | Implementar paginación e índices desde Fase 1 |
| Usuario no adopta catálogos | Media | Bajo | Hacer opcional, permitir entrada manual |
| Falla Redis (emails) | Baja | Medio | Fallback a envío directo sin cola |
| Tiempo de desarrollo se extiende | Alta | Medio | Priorizar Quick Wins y Fase 1, diferir Fase 3 |

---

## 📞 Contacto y Soporte

**Desarrollador Lead**: [Tu nombre]  
**Repositorio**: https://github.com/fernanditojosesanchez-source/FacturaXpress  
**Documentación**: Ver `README.md` y carpeta `docs/`

---

## 🎯 Próximos Pasos Inmediatos

1. **Hoy**: Implementar Quick Win 1-3 (atajos de teclado, confirmaciones, loading)
2. **Esta semana**: Iniciar Sprint 1 (Autenticación)
3. **Coordinar**: Trámite de certificado digital MH
4. **Revisar**: Este plan semanalmente, ajustar prioridades según feedback

---

**Última actualización**: 25/12/2025  
**Versión del plan**: 1.0  
**Estado**: 🟢 Aprobado para ejecución
