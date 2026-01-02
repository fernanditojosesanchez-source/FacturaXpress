# 🎯 PLAN DE ACCIÓN ESPECÍFICO - FacturaXpress

**Objetivo:** Preparar FacturaXpress para pruebas con Ministerio de Hacienda  
**Plazo:** 2 semanas  
**Prioridad:** Crítica  

---

## 📅 CRONOGRAMA RECOMENDADO

### SEMANA 1: Cambios Críticos

#### **Lunes (Hoy)**
- [ ] Leer documentos de análisis (30 min)
- [ ] Reunión con equipo para revisar bloqueantes (30 min)
- [ ] Iniciar rama: `git checkout -b mejoras/numero-control`

#### **Martes**
- [ ] Implementar generación segura de número de control (6-8h)
  - Crear tabla `secuencial_control` en BD
  - Función `getNextNumeroControl()` en `storage.ts`
  - Actualizar `routes.ts` para usar nueva función
  - Testing de duplicados

**Entrega:** Poder generar números control válidos en servidor

#### **Miércoles**
- [ ] Validación de unicidad código generación (2-3h)
- [ ] Verificación de estructura DTE vs schema (1h)
- [ ] Mejora de mensajes de error (2-3h)

**Entrega:** Errores humanizados y validaciones robustas

#### **Jueves**
- [ ] Descarga de DTE en JSON (1-2h)
- [ ] Prueba completa de flujo (2-3h)
- [ ] Documentación de cambios (1h)

**Entrega:** Flujo completo probado

#### **Viernes**
- [ ] Testing final y ajustes (3-4h)
- [ ] Preparar reporte para Hacienda (1h)
- [ ] Merge a main: `git merge main`

**Entrega:** Aplicación lista para pruebas

---

### SEMANA 2: Firma Digital y Transmisión

*(Requiere certificado digital)*

#### **Lunes-Miércoles**
- [ ] Obtener certificado de prueba de DGII
- [ ] Implementar firma SVFE-API-Firmador (6-8h)
- [ ] Integrar en flujo de creación

#### **Jueves-Viernes**
- [ ] Transmisión MH real (4-6h)
- [ ] Pruebas con ambiente de Hacienda
- [ ] Ajustes finales

---

## 🔄 INTEGRACIÓN DE MEJORAS PROPUESTAS (Backlog consolidado)

**1-2 semanas (críticas/productividad inmediata)**
- Seguridad de contraseñas: usar `bcrypt` con salt, fuerza mínima y flujo de reset seguro.
- Rate limiting: `express-rate-limit` (login 5/15min; API general 100/15min).
- Persistencia real: mover de MemoryStore a PostgreSQL + `connect-pg-simple` para sesiones (Drizzle ya configurado).
- Validación de duplicados: bloquear `codigoGeneracion` y NIT repetidos al crear factura.
- Catálogo de productos: tabla con código/descripcion/precio/unidad/tipo; autocomplete y carga CSV.
- Catálogo de clientes: NIT/nombre/dirección/contacto; búsqueda rápida y ver historial por cliente.
- Atajos de teclado: Ctrl+N nueva factura, Ctrl+H historial, Ctrl+S guardar, Escape cancelar.
- Confirmaciones globales: `AlertDialog` en operaciones destructivas.

**2-4 semanas (UX)**
- Barra de progreso global: `NProgress` para mutations/queries largas.
- Toasts con undo, agrupación y persistencia de avisos importantes.
- Vista previa enriquecida: nombres legibles de catálogos, totales destacados y layout similar al PDF final.
- Búsqueda avanzada en historial: sliders de montos, multi-select de estados, full-text en observaciones, guardar vistas en `localStorage`.

**4-6 semanas (Integración MH)**
- Certificado digital: firma PKCS#7 con `node-forge`/`jsrsasign`; endpoint `POST /api/dte/firmar` que recibe DTE validado y devuelve firmado.
- Transmisión real MH: cliente HTTP con retry/timeout, guardar sello, cola Bull+Redis para envíos asíncronos.
- Notificaciones email: `nodemailer` con template (logo, resumen, botón PDF) tras transmisión exitosa.

**6-8 semanas (Performance/Escalabilidad)**
- Lazy loading: `React.lazy()` en rutas pesadas (reportes/historial) con `Suspense` + skeletons.
- Virtualización: `react-virtual` para tablas >100 filas.
- Paginación server-side: `limit/offset` y cursor para catálogos e historial.
- Índices BD: `codigoGeneracion`, `numDocumento` receptor, `fechaEmision`, `estado`.
- Modo offline PWA: Vite PWA + service worker para cache estático, productos/clientes y facturas recientes; sincronización al reconectar.

## 🔴 TAREAS CRÍTICAS - DETALLES TÉCNICOS

### TAREA 1: Número de Control Seguro

**Archivos a Modificar:**
1. `server/storage.ts` - Agregar métodos
2. `server/routes.ts` - Usar nueva función
3. `shared/schema.ts` - Actualizar validación (opcional)

**Paso 1: Crear tabla en storage.ts**

```typescript
// server/storage.ts - En clase Storage

// Agregar tabla secuencial_control
const SQL_CREATE_SECUENCIAL = `
  CREATE TABLE IF NOT EXISTS secuencial_control (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emisor_nit TEXT NOT NULL,
    tipo_dte TEXT NOT NULL,
    secuencial INTEGER NOT NULL DEFAULT 1,
    ultimo_numero_control TEXT,
    fecha_creacion INTEGER NOT NULL,
    fecha_actualizacion INTEGER NOT NULL,
    UNIQUE(emisor_nit, tipo_dte)
  )
`;

// En initialize()
db.exec(SQL_CREATE_SECUENCIAL);

// Agregar método:
async getNextNumeroControl(emisorNit: string, tipoDte: string): Promise<string> {
  const now = Date.now();
  
  // Obtener o crear registro
  let record = this.db.prepare(
    `SELECT * FROM secuencial_control 
     WHERE emisor_nit = ? AND tipo_dte = ?`
  ).get(emisorNit, tipoDte);
  
  if (!record) {
    this.db.prepare(
      `INSERT INTO secuencial_control 
       (emisor_nit, tipo_dte, secuencial, fecha_creacion, fecha_actualizacion)
       VALUES (?, ?, ?, ?, ?)`
    ).run(emisorNit, tipoDte, 1, now, now);
    record = { secuencial: 1 };
  }
  
  // Incrementar secuencial
  const newSecuencial = record.secuencial + 1;
  
  // Formatear número de control: 001-000000000000000001
  const prefix = String(tipoDte).padStart(3, '0');
  const suffix = String(newSecuencial).padStart(18, '0');
  const numeroControl = `${prefix}-${suffix}`;
  
  // Guardar
  this.db.prepare(
    `UPDATE secuencial_control 
     SET secuencial = ?, ultimo_numero_control = ?, fecha_actualizacion = ?
     WHERE emisor_nit = ? AND tipo_dte = ?`
  ).run(newSecuencial, numeroControl, now, emisorNit, tipoDte);
  
  return numeroControl;
}
```

**Paso 2: Actualizar routes.ts**

```typescript
// server/routes.ts - En POST /api/facturas

app.post("/api/facturas", async (req: Request, res: Response) => {
  try {
    // Validación Zod
    const parsed = insertFacturaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validación fallida" });
    }
    
    // ✅ NUEVO: Generar número de control en servidor
    const numeroControl = await storage.getNextNumeroControl(
      parsed.data.dte.emisor.nit,
      parsed.data.dte.tipoDte
    );
    
    // Actualizar DTE con número generado
    const dteConNumero = {
      ...parsed.data.dte,
      numeroControl
    };
    
    // Validación DGII
    const dteValidation = validateDTESchema(dteConNumero);
    if (!dteValidation.valid) {
      return res.status(400).json({
        error: "Validación DGII fallida",
        dgiiErrors: dteValidation.errors
      });
    }
    
    // Crear factura
    const factura = await storage.createFactura({
      ...parsed.data,
      dte: dteConNumero
    });
    
    res.status(201).json(factura);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear factura" });
  }
});
```

**Testing:**

```bash
# Crear múltiples facturas y verificar secuencial
# Números deberían ser: 001-000000000000000001, 001-000000000000000002, etc.
```

---

### TAREA 2: Validación de Unicidad Código Generación

**Archivo:** `server/storage.ts`

```typescript
// Agregar método en Storage
async getFacturaByCodigoGeneracion(codigoGen: string): Promise<Factura | null> {
  const result = this.db.prepare(
    `SELECT * FROM facturas WHERE dte_json LIKE ?`
  ).get(`%"codigoGeneracion":"${codigoGen}"%`);
  
  if (!result) return null;
  
  return this.dbRowToFactura(result);
}
```

**Archivo:** `server/routes.ts`

```typescript
app.post("/api/facturas", async (req: Request, res: Response) => {
  try {
    // ... validaciones anteriores ...
    
    // ✅ NUEVO: Validar unicidad código generación
    const existente = await storage.getFacturaByCodigoGeneracion(
      req.body.dte.codigoGeneracion
    );
    
    if (existente) {
      return res.status(400).json({
        error: "Código de generación ya existe",
        codigo: "DUPLICADO_CODIGO_GEN",
        message: "Este código de generación ya fue usado. Genera uno nuevo."
      });
    }
    
    // ... resto del código ...
  }
});
```

---

### TAREA 3: Mejora de Errores

**Archivo:** `server/dgii-validator.ts`

```typescript
// Agregar función para humanizar errores
export function humanizeValidationError(error: AJVError, fieldLabel?: string): {
  field: string;
  message: string;
  ejemplo?: string;
} {
  const path = error.instancePath || error.schemaPath || "root";
  let fieldName = fieldLabel || path.split('/').pop() || "Campo desconocido";
  
  const errorMap: Record<string, { message: string; ejemplo: string }> = {
    'nit': {
      message: 'NIT debe tener formato: 14 dígitos - 1 verificador',
      ejemplo: '00123456789012-9'
    },
    'dui': {
      message: 'DUI debe tener formato: 8 dígitos - 1 verificador',
      ejemplo: '12345678-9'
    },
    'numeroControl': {
      message: 'Número de control debe ser: 3 dígitos - 18 dígitos',
      ejemplo: '001-000000000000000001'
    },
    'monto': {
      message: 'Monto debe ser un número positivo',
      ejemplo: '100.00'
    },
    'cantidad': {
      message: 'Cantidad debe ser un número positivo',
      ejemplo: '1.00'
    }
  };
  
  const key = Object.keys(errorMap).find(k => fieldName.toLowerCase().includes(k));
  if (key) {
    return {
      field: fieldName,
      message: errorMap[key].message,
      ejemplo: errorMap[key].ejemplo
    };
  }
  
  return {
    field: fieldName,
    message: error.message || 'Error de validación',
    ejemplo: undefined
  };
}
```

**Uso en routes.ts:**

```typescript
if (!dteValidation.valid) {
  const errorDetails = dteValidation.errors.map(err => 
    humanizeValidationError(err as AJVError)
  );
  
  return res.status(400).json({
    error: "Validación DGII fallida",
    errors: errorDetails
  });
}
```

---

## 🟠 TAREAS IMPORTANTES - SEGUIMIENTO

### TAREA 4: Descarga de DTE

**Archivo:** `client/src/pages/historial.tsx`

```typescript
// Agregar función
function descargarDTE(factura: Factura) {
  const json = JSON.stringify(factura.dte, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DTE-${factura.numeroControl.replace('/', '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Agregar botón en tabla
<Button
  size="sm"
  variant="outline"
  onClick={() => descargarDTE(factura)}
>
  📥 Descargar
</Button>
```

---

### TAREA 5: Testing Completo

**Crear archivo:** `tests/flujo-completo.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Flujo Completo de Factura', () => {
  it('Debe generar número de control único', async () => {
    // Test de generación de números de control
  });
  
  it('Debe validar DTE contra schema DGII', async () => {
    // Test de validación
  });
  
  it('Debe rechazar código generación duplicado', async () => {
    // Test de duplicados
  });
  
  it('Debe calcular totales correctamente', async () => {
    // Test de cálculos
  });
});
```

---

## ✅ CHECKLIST DE COMPLETITUD

### Implementación

- [ ] Tabla `secuencial_control` creada
- [ ] Función `getNextNumeroControl()` en storage
- [ ] `routes.ts` usa generación en servidor
- [ ] Validación de código generación único
- [ ] Humanización de errores
- [ ] Descarga de JSON DTE
- [ ] Testing local completo

### Validación

- [ ] No hay errores TypeScript: `npm run check`
- [ ] Número control formato válido: `001-000000000000000001`
- [ ] Secuencial incrementa: `001-000000000000000002`
- [ ] No hay duplicados de código generación
- [ ] Errores muestran ejemplos

### Documentación

- [ ] Cambios documentados en README
- [ ] Comentarios en código
- [ ] Commits descriptivos

---

## 🚀 COMANDOS ESENCIALES

```bash
# Crear rama para cambios
git checkout -b mejoras/numero-control

# Verificar cambios
npm run check
npm run lint:fix

# Testing
npm run dev

# Commit
git add .
git commit -m "feat: generación segura número de control"

# Merge
git checkout main
git merge mejoras/numero-control
git push origin main
```

---

## 📞 PUNTOS DE CONTACTO IMPORTANTES

### Con Hacienda
- Número de control debe ser generado por servidor ✅
- Schema DGII debe validarse 100% ✅
- Firma digital requerida ❌ (Requiere certificado)

### Con DGII
- Solicitar certificado de prueba
- Solicitar endpoints de firma digital
- Solicitar credentials para transmisión

### Internos
- Backup de base de datos antes de cambios mayores
- Testing en ambiente de desarrollo primero
- Mantener rama de producción limpia

---

## 💾 BACKUP Y SEGURIDAD

```bash
# Hacer backup de BD antes de cambios
cp app.db app.db.backup.$(date +%s)

# Verificar integridad
sqlite3 app.db ".tables"
sqlite3 app.db "SELECT COUNT(*) FROM facturas;"
```

---

## 🎯 ÉXITO SIGNIFICA

✅ Poder crear una factura válida  
✅ Número de control generado en servidor  
✅ DTE válida contra schema DGII  
✅ Errores claros y accionables  
✅ Descarga de JSON funciona  
✅ Sin errores TypeScript  
✅ Documentación actualizada  

---

**¿Necesitas que implementemos esto ahora mismo?**

Responde y empezamos.
