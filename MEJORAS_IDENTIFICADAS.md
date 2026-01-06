# 🎯 Mejoras Identificadas - Plan de Implementación

**Priorización:** Críticas → Importantes → Mejoras de UX

---

## ✅ CRÍTICAS COMPLETADAS (Enero 2026)

### ✅ 1. Generación Segura de Número de Control

**Estado:** ✅ IMPLEMENTADO

**Implementación Realizada:**

```typescript
// ✅ SEGURO: Generación server-side implementada
// server/storage.ts
async getNextNumeroControl(emisorNit: string, tipoDte: string): Promise<string> {
  // 1. ✅ Obtener secuencial actual de BD para emisor + tipo DTE
  // 2. ✅ Incrementar secuencial
  // 3. ✅ Formatear: XXX-YYYYYYYYYYYYYYYYY (3 dígitos - 18 dígitos)
  // 4. ✅ Validar unicidad con UNIQUE constraint
  // 5. ✅ Guardar en BD
  // 6. ✅ Retornar
}
```

**Archivos Modificados:**
- ✅ `server/storage.ts` - Tabla `secuencial_control` y función `getNextNumeroControl()`
- ✅ `server/routes.ts` - Llamada a función server-side en POST /api/facturas

**Commit:** `feat: implementar generación segura de número de control server-side`

---

### ✅ 2. Validación de Código de Generación (Unicidad)

**Estado:** ✅ IMPLEMENTADO

**Implementación Realizada:**

```typescript
// ✅ Validación de duplicados implementada
// server/routes.ts
const existente = await storage.getFacturaByCodigoGeneracion(codigoGeneracion);
if (existente) {
  return res.status(400).json({ 
    error: "Código de generación ya existe",
    codigo: "DUPLICADO_CODIGO_GEN"
  });
}
```

**Archivos Modificados:**
- ✅ `server/storage.ts` - Función `getFacturaByCodigoGeneracion()` con búsqueda LIKE
- ✅ `server/routes.ts` - Validación pre-insert

**Commit:** `feat: agregar validación de código de generación único`

---

### ✅ 3. Verificación Estructura DTE vs Schema DGII

**Estado:** ✅ VERIFICADO Y CONFIRMADO

**Resultado:**
- ✅ `numeroControl` formato correcto (000-000000000000000000)
- ✅ `codigoGeneracion` es UUID v4
- ✅ `version` es "1"
- ✅ `ambiente` es "01" o "02"
- ✅ `tipoDte` en enumeración válida
- ✅ Todos los IDs de catálogos válidos
- ✅ Totales en moneda correcta (USD)

**Commit:** `docs: verificar y confirmar 100% compatibilidad con schema DGII`

---

### ✅ 4. Humanización de Errores

**Estado:** ✅ IMPLEMENTADO

**Implementación Realizada:**

```typescript
// ✅ Mensajes user-friendly implementados
// server/dgii-validator.ts
function humanizeValidationError(error: ErrorObject): HumanizedError {
  // Diccionario con 10+ tipos de errores comunes
  // Incluye campo, mensaje y ejemplo para cada error
}
```

**Archivos Modificados:**
- ✅ `server/dgii-validator.ts` - Función `humanizeValidationError()` con diccionario

**Errores Cubiertos:**
- NIT, DUI, numeroControl, codigoGeneracion
- monto, cantidad, email, telefono
- campos requeridos, enumeraciones

**Commit:** `feat: humanizar errores de validación DGII con ejemplos`

---

## 🔴 CRÍTICAS PENDIENTES (Backlog Opcional)

### 0. Seguridad y Resiliencia

- **Hash de contraseñas** con `bcrypt` + salt, reglas de complejidad y flujo de reset seguro.
- **Rate limiting** con `express-rate-limit`: login 5 intentos/15min, API general 100/15min.
- **Persistencia real**: migrar de MemoryStore a PostgreSQL productivo y sesiones con `connect-pg-simple` (Drizzle ya listo).
- **Unicidad NIT**: validar NIT emisor/receptor antes de insertar factura
  fecha_ultimo INTEGER,
  UNIQUE(emisor_nit, tipo_dte)
);
```

2. Crear función en `server/storage.ts`:
```typescript
async getNextNumeroControl(emisorNit: string, tipoDte: string): Promise<string>
```

3. Actualizar `server/routes.ts`:
```typescript
const numeroControl = await storage.getNextNumeroControl(emisor.nit, tipoDte);
```

**Impacto:** CRÍTICO - Requerido para Hacienda  
**Tiempo Estimado:** 4-6 horas  
**Prioridad:** 🔴 HACER PRIMERO

---

### 2. Validación de Código de Generación (Unicidad)

**Archivo:** `server/routes.ts`

**Problema Actual:**
```typescript
// UUID generado por cliente, no se valida unicidad
codigoGeneracion: req.body.codigoGeneracion
```

**Riesgo:** Mismo código generación usado en múltiples DTEs

**Solución:**

```typescript
// En routes.ts, antes de crear factura:
const existente = await storage.getFacturaByCodigoGeneracion(codigoGeneracion);
if (existente) {
  return res.status(400).json({ 
    error: "Código de generación ya existe",
    codigo: "DUPLICADO_CODIGO_GEN"
  });
}
```

**Impacto:** CRÍTICO  
**Tiempo Estimado:** 1-2 horas  
**Prioridad:** 🔴 HACER AHORA

---

### 3. Estructura de DTE vs Schema DGII

**Verificar:** El JSON generado coincide 100% con schema oficial

**Checklist:**
- [ ] ¿`numeroControl` formato correcto? (000-000000000000000000)
- [ ] ¿`codigoGeneracion` es UUID v4?
- [ ] ¿`version` es "1"?
- [ ] ¿`ambiente` es "01" (Producción) o "02" (Prueba)?
- [ ] ¿`tipoDte` está en enumeración válida?
- [ ] ¿Todos los IDs de catálogos son válidos?
- [ ] ¿Totales en moneda correcta (USD)?

**Comando Test:**
```bash
curl -X POST http://localhost:5000/api/validar-dte \
  -H "Content-Type: application/json" \
  -d @test-dte-ejemplo.json
```

**Impacto:** CRÍTICO  
**Tiempo Estimado:** 30 minutos verificación  
**Prioridad:** 🔴 VERIFICAR HOY

---

## ✅ IMPORTANTES COMPLETADAS

### ✅ Validación Avanzada de Receptor

**Estado:** ✅ IMPLEMENTADO

**Implementación:**
- ✅ Campo `datosVerificados: boolean` en `facturaFormSchema`
- ✅ Checkbox "He verificado que los datos del receptor son correctos"
- ✅ Validación requerida antes de enviar

**Archivos Modificados:**
- ✅ `client/src/pages/nueva-factura.tsx`

**Commit:** `feat: agregar validación avanzada de receptor con checkbox de verificación`

---

### ✅ Testing Completo de Flujo

**Estado:** ✅ IMPLEMENTADO

**Suite de Tests:**
- ✅ Test: Número control único y secuencial
- ✅ Test: Independencia de secuencias por tipo DTE
- ✅ Test: Validación DGII schema
- ✅ Test: Detección de duplicados
- ✅ Test: Cálculo de IVA
- ✅ Test: Formato de número control

**Archivo Creado:**
- ✅ `tests/flujo-completo.test.ts` (6 tests)

**Commit:** `test: agregar suite completa de tests de flujo`

---

### ✅ Descarga DTE en JSON

**Estado:** ✅ IMPLEMENTADO

**Implementación:**
- ✅ Botón "Exportar JSON" en modal de detalles
- ✅ Genera archivo `DTE_{codigoGeneracion}.json`
- ✅ Formato DGII completo

**Archivos Modificados:**
- ✅ `client/src/pages/historial.tsx`

**Commit:** Incluido en commit de mejoras de UX

---

## ✅ MEJORAS DE UX COMPLETADAS (Nice-to-have)

### ✅ Búsqueda Avanzada en Historial

**Estado:** ✅ IMPLEMENTADO

**Implementación:**
- ✅ Función `exportToCSV()` con exportación de facturas filtradas
- ✅ Headers: Fecha, Número Control, Código Gen, Receptor, Monto, Estado, Tipo DTE
- ✅ Botón "Exportar CSV" en historial

**Archivos Modificados:**
- ✅ `client/src/pages/historial.tsx`

**Commit:** `feat: agregar exportación CSV y descarga PDF en historial`

---

### ✅ Dashboard con Métricas

**Estado:** ✅ IMPLEMENTADO

**Métricas Agregadas:**
- ✅ "Ventas Este Mes" con filtrado por mes actual
- ✅ "Cliente Principal" con ranking automático
- ✅ Cálculo de ventas por cliente con reduce()

**Archivos Modificados:**
- ✅ `client/src/pages/dashboard.tsx`

**Commit:** `feat: agregar métricas adicionales al dashboard (ventas mes, cliente principal)`

---

### ✅ PDF Preview de DTE

**Estado:** ✅ IMPLEMENTADO

**Implementación:**
- ✅ Módulo `client/src/lib/pdf-generator.ts` nuevo
- ✅ Función `generateFacturaHTML()` con template profesional
- ✅ Función `generatePDFFromElement()` con jsPDF + html2canvas
- ✅ Botón "Descargar PDF" en modal de detalles
- ✅ Formato A4/Letter con paginación automática
- ✅ Layout profesional: header, datos, items, totales, footer

**Archivo Creado:**
- ✅ `client/src/lib/pdf-generator.ts`

**Archivos Modificados:**
- ✅ `client/src/pages/historial.tsx`

**Librerías Instaladas:**
- ✅ jsPDF
- ✅ html2canvas

**Commit:** `feat: agregar exportación CSV y descarga PDF en historial`

---

## 🟠 IMPORTANTES PENDIENTES (Backlog Opcional)

### Productividad inmediata

- **Catálogo de productos**: tabla con código, descripción, precio base, unidad de medida y tipo de ítem; autocomplete en factura e importación CSV.
- **Catálogo de clientes**: NIT, nombre, dirección, contacto; búsqueda rápida y vista de historial por cliente.
- **Atajos de teclado**: Ctrl+N (nueva factura), Ctrl+H (historial), Ctrl+S (guardar), Escape (cancelar).
- **Confirmaciones globales**: `AlertDialog` para cualquier acción destructiva
  const json = JSON.stringify(factura.dte, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DTE-${factura.numeroControl}.json`;
  a.click();
}
```

**Impacto:** UX Improvement  
**Tiempo Estimado:** 1-2 horas  
**Prioridad:** 🟠 ANTES DE PRUEBAS

---

### 5. Validación Avanzada de Receptor

**Problema Actual:** Solo valida formato de NIT/DUI

**Mejora Propuesta:**

1. **Opción A (Recomendado):** Consulta API DGII
   - Llamar API pública de DGII para verificar NIT
   - Mostrar nombre registrado
   - Validar que no esté bloqueado

2. **Opción B (Rápido):** Validación manual
   - Campo "Confirmar datos del receptor"
   - Checkbox "Datos verificados"

**Para Opción A:**
```typescript
async function verificarNitGIII(nit: string): Promise<{valido: boolean, nombre?: string}> {
  // Llamar a API pública de DGII (si existe)
  // O usar servicio de verificación tercero
}
```

**Impacto:** IMPORTANTE  
**Tiempo Estimado:** 2-4 horas  
**Prioridad:** 🟠 ANTES DE HACIENDA

---

### 6. Manejo de Errores DGII

**Mejorar:** Mensajes de validación más específicos

**Actual:**
```json
{ "errors": [{ "field": "/emisor/nit", "message": "must match pattern..." }] }
```

**Mejorado:**
```json
{ 
  "errors": [{ 
    "field": "NIT Emisor", 
    "message": "Formato inválido. Debe ser: 14 dígitos-1 dígito verificador",
    "ejemplo": "00123456789012-9",
    "codigo": "INVALID_NIT_FORMAT"
  }] 
}
```

**Implementar:**
```typescript
// server/dgii-validator.ts
function humanizeValidationError(error: AJVError): string {
  const field = error.instancePath || error.schemaPath;
  
  if (field.includes('nit')) return "NIT debe tener formato XXXXXXXXXXXX-X";
  if (field.includes('dui')) return "DUI debe tener formato XXXXXXXX-X";
  if (field.includes('monto')) return "Monto debe ser número positivo";
  // etc...
}
```

**Impacto:** UX Improvement  
**Tiempo Estimado:** 2-3 horas  
**Prioridad:** 🟠 IMPORTANTE

---

## 🟡 MEJORAS DE UX/UI

### 10. Experiencia de uso

- **Barra de progreso global** con NProgress para mutations/queries largas.
- **Toasts avanzados** con undo, agrupación y persistencia de avisos importantes.
- **Vista previa enriquecida**: mostrar nombres legibles de catálogos, totales destacados y layout tipo PDF.
- **Búsqueda avanzada** en historial: rango de montos con slider, multi-select de estados, full-text en observaciones y guardado de vistas en `localStorage`.

### 11. Integración MH (posterior al certificado)

- **Firma PKCS#7** con `node-forge`/`jsrsasign`, endpoint `POST /api/dte/firmar` que recibe DTE validado y retorna firmado.
- **Transmisión real MH**: cliente HTTP con retry/timeout, almacenamiento de sello y cola Bull+Redis para envíos asíncronos.
- **Notificaciones email** con `nodemailer` y template HTML (logo, resumen, botón PDF) tras transmisión exitosa.

### 12. Performance y escalabilidad

- **Lazy loading**: `React.lazy()` + `Suspense` en rutas pesadas (reportes, historial) con skeletons.
- **Virtualización**: `react-virtual` para tablas >100 filas.
- **Paginación server-side**: `limit/offset` y cursor para catálogos e historial.
- **Índices BD**: `codigoGeneracion`, `numDocumento` receptor, `fechaEmision`, `estado`.
- **Modo offline PWA**: Vite PWA con SW para cache de estáticos, catálogos y facturas recientes; sincronización al reconectar.

### 7. PDF Preview de DTE

**Implementar generador PDF con estructura factura:**

```bash
npm install pdfkit html2pdf
```

```typescript
// server/pdf-service.ts
async function generarPDFFactura(factura: Factura): Promise<Buffer> {
  // Generar PDF con:
  // - Datos emisor (logo si existe)
  // - Datos receptor
  // - Detalle de items
  // - Totales
  // - Número control y código gen en formato QR
}
```

**Impacto:** UX Good-to-have  
**Tiempo Estimado:** 3-4 horas  
**Prioridad:** 🟡 DESPUÉS DE CRÍTICAS

---

### 8. Búsqueda Mejorada en Historial

**Agregar:**
- Búsqueda por rango de fechas
- Búsqueda por monto
- Búsqueda por tipo DTE
- Exportar a CSV

```typescript
// client/src/pages/historial.tsx - Agregar filtros:
<DateRangePicker onChange={setFechaRango} />
<Select options={tipos_dte} onChange={setTipoDte} />
<Button onClick={exportarCSV}>📊 Exportar CSV</Button>
```

**Impacto:** UX Improvement  
**Tiempo Estimado:** 2-3 horas  
**Prioridad:** 🟡 DESPUÉS DE PRUEBAS

---

### 9. Dashboard Mejorado

**Agregar métricas:**
- Total facturado (mes actual, año actual)
- Facturación por cliente
- Facturación por tipo DTE
- Tasa de aprobación MH

```typescript
// client/src/pages/dashboard.tsx
<Card>
  <h3>Facturación Este Mes</h3>
  <div className="text-3xl font-bold">$X,XXX.XX</div>
  <p className="text-xs text-slate-500">+X% vs mes anterior</p>
</Card>
```

**Impacto:** UX Nice-to-have  
**Tiempo Estimado:** 2-3 horas  
**Prioridad:** 🟡 DESPUÉS DE PRUEBAS

---

## 📋 Plan de Implementación Recomendado

### ESTA SEMANA (Antes de Pruebas)

**Lunes-Miércoles:**
1. ✅ Generación segura número control (4-6h)
2. ✅ Validación unicidad código gen (1-2h)
3. ✅ Verificación estructura DTE (0.5h)
4. ✅ Manejo mejorado de errores (2-3h)

**Tiempo Total:** ~10-12 horas = 1-2 días

**Jueves-Viernes:**
1. ✅ Descarga JSON de DTE (1-2h)
2. ✅ Validación avanzada receptor (2-4h)
3. ✅ Testing general (2-3h)

**Tiempo Total:** ~7-9 horas = 1 día

---

### SEGUNDA SEMANA (Con Certificado)

1. Firma digital SVFE (2-3 días)
2. Transmisión MH real (1-2 días)
3. Pruebas con Hacienda (1-2 días)

---

## ✅ Verificación Funcional Actual

### Test Rápido de Validación

```bash
# 1. DTE válido
curl -X POST http://localhost:5000/api/validar-dte \
  -H "Content-Type: application/json" \
  -d '{
    "tipoDte": "01",
    "ambiente": "02",
    "version": "1",
    "numeroControl": "001-000000000000000001",
    "codigoGeneracion": "550e8400-e29b-41d4-a716-446655440000",
    "emisor": {
      "nit": "00123456789012-0",
      "nrc": "123456-7",
      "nombre": "Mi Empresa",
      "giro": "Comercio",
      "departamento": "01",
      "municipio": "01",
      "direccion": "Calle 1"
    },
    "receptor": {
      "tipoDocumento": "01",
      "numeroDocumento": "00000000000000-0",
      "nombre": "Cliente"
    },
    "cuerpo": {
      "items": [{
        "cantidad": 1,
        "descripcion": "Producto",
        "precioUnitario": 100,
        "monto": 100
      }]
    },
    "resumen": {
      "totalExentos": 0,
      "totalGravados": 100,
      "totalIVA": 13,
      "totalAnteriores": 0,
      "moneda": "USD",
      "totalPagar": 113
    }
  }'

# Respuesta esperada:
# { "valid": true, "message": "DTE válido según schema DGII" }
```

---

## 📊 Matriz de Decisión

| Mejora | Crítica | Complejidad | Tiempo | Impacto | Orden |
|--------|---------|-------------|--------|---------|-------|
| Número control seguro | 🔴 | 🔴 | 4-6h | 🔴 Alto | 1 |
| Validación código gen | 🔴 | 🟢 | 1-2h | 🔴 Alto | 2 |
| Verificar DTE struct | 🔴 | 🟢 | 0.5h | 🔴 Alto | 3 |
| Errores humanizados | 🟠 | 🟢 | 2-3h | 🟡 Med | 4 |
| Descarga JSON DTE | 🟠 | 🟢 | 1-2h | 🟡 Med | 5 |
| Validación receptor | 🟠 | 🔴 | 2-4h | 🟠 Med | 6 |
| PDF Preview | 🟡 | 🔴 | 3-4h | 🟡 Low | 7 |
| Búsqueda avanzada | 🟡 | 🟢 | 2-3h | 🟡 Low | 8 |
| Dashboard metricas | 🟡 | 🟢 | 2-3h | 🟡 Low | 9 |

---

## 🚀 Comando para Iniciar

```bash
# Crear rama para mejoras
git checkout -b mejoras/pre-hacienda

# Implementar cambios en este orden
# 1. Número de control
# 2. Validación código gen
# 3. Errores mejorados
# 4. Descarga DTE
# 5. Testing completo

# Merge cuando esté listo
git merge main
```

---

**¿Necesitas que implemente alguno de estos cambios ahora mismo?**
