# 📘 Resumen Ejecutivo: Manual de Procedimientos Operativos - DTE
## Documento Tributarios Electrónicos (DTE) - Versión 1.1

**Fecha de Referencia**: Manual de Procedimientos Operativos oficial MH  
**Estado del Documento**: Normativa vigente  
**Relevancia para FacturaXpress**: Respaldo normativo y requerimientos obligatorios  
**Última Actualización**: 25 de Diciembre, 2025

---

## 🎯 1. INTRODUCCIÓN Y FUNDAMENTOS

### 1.1 Propósito, Alcance y Marco Normativo

**Objeto del Manual:**
Establecer procedimientos claros y unificados para la emisión, transmisión y gestión de Documentos Tributarios Electrónicos (DTE) conforme a la "Normativa de Cumplimiento de los Documentos Tributarios Electrónicos" (Versión 1.1) del Ministerio de Hacienda.

**Beneficios Organizacionales:**
- ✅ Optimización de procesos tributarios
- ✅ Reducción de costos operativos (eliminación de papel)
- ✅ Garantía de conformidad legal
- ✅ Validez fiscal de operaciones comerciales

**Ámbito de Aplicación:**
- **Sujetos Obligados:** Sujetos pasivos emisores de DTE
- **Base Legal:** Artículo 119-A inciso segundo del Código Tributario de El Salvador
- **Cumplimiento:** Estrictamente obligatorio

---

## 📋 2. TIPOLOGÍA DE DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS

### 2.1 Tipos de DTE Soportados (11 tipos)

| Sigla | Documento | Aplicación |
|-------|-----------|---|
| **CCFE** | Comprobante de Crédito Fiscal Electrónico | Ventas B2B con derecho a crédito fiscal |
| **FE** | Factura Electrónica | Ventas B2C estándar |
| **FEXE** | Factura de Exportación Electrónica | Operaciones de exportación |
| **NRE** | Nota de Remisión Electrónica | Remisión de bienes sin venta inmediata |
| **NCE** | Nota de Crédito Electrónica | Devoluciones/ajustes por menor monto |
| **NDE** | Nota de Débito Electrónica | Cargos adicionales por error de cálculo |
| **CLE** | Comprobante de Liquidación Electrónico | Liquidaciones de servicios/retenciones |
| **CRE** | Comprobante de Retención Electrónico | Retenciones de IVA/renta |
| **DCLE** | Documento Contable de Liquidación Electrónico | Documentos contables especiales |
| **FSEE** | Factura de Sujeto Excluido Electrónica | Emisores excluidos del régimen tributario |
| **CDE** | Comprobante de Donación Electrónico | Donaciones documentadas |

---

## 🔤 3. GLOSARIO DE TÉRMINOS ESENCIALES

### Definiciones Normativas Clave

**Archivo DTE**
- Archivo electrónico en extensión JSON
- Contiene: texto plano + estructura según Anexo II + firma JWS + Sello de Recepción MH
- Formato mandatorio de entrega

**Código de Generación**
- Identificador único universal (UUID v4)
- 128 bits expresado en 36 caracteres hexadecimales
- Ejemplo: `550E8400-E29B-41D4-A716-446655440000`
- Permite consulta independiente en portal MH

**Contingencia**
- Situación imprevista por caso fortuito o fuerza mayor
- Impide transmisión previa a la Administración Tributaria
- Activa modalidad de emisión diferida con evento especial

**Documento Tributario Electrónico (DTE)**
- Documento generado en estructura JSON
- Firmado conforme estándar JWS
- Transmitido electrónicamente a MH
- Posee Sello de Recepción que confiere validez fiscal

**Emisor**
- Sujeto que expide DTE
- Responsable de estructura, firma, transmisión y conservación
- Obligado a certificado electrónico autorizado

**Evento**
- Mensaje de datos firmado electrónicamente
- Contiene información relacionada con DTEs
- Transmitido a MH con Sello de Recepción resultante
- Tipos: Invalidación, Contingencia

**Evento de Contingencia**
- Declaración formal de situación de fuerza mayor
- Se genera y transmite al cesar la contingencia
- Notifica DTEs emitidos durante la interrupción
- Plazo: ≤24h post cese; DTEs ≤72h

**Evento de Invalidación**
- Declaración de anulación de DTE previamente sellado
- Motivos: errores, rescisión, ajustes operacionales
- Causa pérdida total de validez fiscal del original
- Plazos específicos según tipo de error (1 día a 3 meses)

**Firma Electrónica**
- Datos electrónicos en el documento
- Identifica al emisor
- Indica aprobación del contenido
- Requisito para Sello de Recepción

**Receptor**
- Persona natural o jurídica que recibe el DTE
- Obligado a exigir entrega en formato JSON con Sello
- Responsable de verificación en portal MH
- Necesario para respaldo de deducciones/créditos

**Sello de Recepción**
- Código especial otorgado por Administración Tributaria
- Base: UUID v4 + caracteres alfanuméricos adicionales
- Acredita transmisión, recepción y validez fiscal
- Requisito indispensable para validez tributaria
- Confiere carácter inatacable al documento

**Transmisión**
- Envío de DTE generado y firmado a plataforma MH
- Objetivo: obtener Sello de Recepción
- Modalidades: normal (previa) o diferida (contingencia)

---

## 🔨 4. PROCEDIMIENTO DE GENERACIÓN DE DTE

### 4.1 Estructura del Documento y Formato Electrónico

**Formato Base:** JSON-schema conforme Anexo I (Especificaciones Tecnológicas)

**Secciones Obligatorias del DTE:**

#### 1. **Identificación**
- Versión del documento
- Tipo de DTE (CAT-002)
- Número de Control (identificador único secuencial)
- Código de Generación (UUID v4)
- Fecha de emisión
- Hora de emisión
- Ambiente (pruebas: "00", producción: "01")

#### 2. **Emisor**
- NIT (Número de Identificación Tributaria)
- Nombre o razón social
- Nombre comercial (opcional)
- Actividad económica (CIIU)
- Dirección (departamento, municipio, complemento)
- Teléfono
- Correo electrónico
- Código de establecimiento (asignado por MH)
- Código de punto de venta (asignado por MH)

#### 3. **Receptor**
- Tipo de documento (NIT, DUI, pasaporte, etc.)
- Número de documento
- NRC (opcional según tipo DTE)
- Nombre o razón social
- Actividad económica (opcional)
- Dirección (departamento, municipio, complemento)
- Teléfono (opcional)
- Correo electrónico (opcional)

#### 4. **Cuerpo del Documento**
- Array de ítems (bienes/servicios)
- Por cada ítem:
  - Número de línea
  - Cantidad
  - Código de producto (opcional)
  - Unidad de medida (CAT-015)
  - Descripción
  - Precio unitario
  - Descuentos por ítem
  - Venta no sujeta
  - Venta exenta
  - Venta gravada
  - Tributos aplicables
  - IVA del ítem

#### 5. **Resumen**
- Totales por categoría: no sujeto, exento, gravado
- Subtotal de ventas
- Descuentos totales (por categoría)
- Subtotal neto
- Tributos consolidados (descripción + monto)
- IVA total
- Retenciones (IVA, Renta)
- Monto total de operación
- Total a pagar
- Montos en letras
- Condición de operación (contado/crédito)
- Formas de pago

### 4.2 Creación de Códigos y Controles

#### **Código de Generación (UUID v4)**
- Identificador único universal de 128 bits
- Formato: 36 caracteres hexadecimales separados por guiones
- RFC 4122 compliant
- **Ejemplo**: `a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6`
- **Garantía**: Unicidad global del documento
- **Uso**: Consulta en portal MH de manera independiente

#### **Número de Control**
Estructura: `DTE + TipoDTE + PuntoVenta + Consecutivo`

| Componente | Formato | Descripción | Ejemplo |
|-----------|---------|---|---|
| Prefijo | 3 caracteres | Literal "DTE" | DTE |
| Tipo | 2 dígitos | Código CAT-002 | 03 (FE) |
| Punto Venta | 4 dígitos | Asignado por MH | 0001 |
| Consecutivo | 15 dígitos | Secuencial 000000000000001 a 999999999999999 | 000000000000005 |

**Resultado**: `DTE-03-0001-000000000000005`

**Propiedades Críticas:**
- Secuencial: sin saltos ni duplicados
- Atomicidad: contador persistente en base de datos
- Auditoría: cualquier brecha es señal de falla

### 4.3 Reglas de Cálculo y Redondeo

#### **Precisión Decimal por Sección**

**Ítems (Cuerpo del Documento):**
- Máximo: 8 posiciones decimales
- Regla: Si 9ª posición ≥ 5, redondea 8ª posición hacia arriba
- Afecta: cantidad, precio unitario, descuentos por ítem

**Resumen:**
- Máximo: 2 posiciones decimales
- Regla: Si 3ª posición ≥ 5, redondea 2ª posición hacia arriba
- Afecta: totales, subtotales, tributos consolidados

**Ejemplo de Redondeo**:
```
Cantidad: 1.456789123 → redondea a 1.45678912
Subtotal: 150.4567 → redondea a 150.46
```

#### **Regla de Holgura (Tolerancia)**
- **Tolerancia permitida**: ±$0.01 (una centésima)
- **Aplicación**: Diferencia entre cálculos del contribuyente y validación MH
- **Propósito**: Absorber diferencias de precisión de punto flotante
- **No excedera**: El sistema debe bloquear si excede ±$0.01

**Implementación Recomendada**:
```typescript
const diferencia = Math.abs(calculoSistema - calculoMH);
if (diferencia > 0.01) {
  throw new Error("Falla en validación de holgura");
}
```

---

## ✍️ 5. PROCEDIMIENTO DE EMISIÓN Y FIRMA ELECTRÓNICA

### 5.1 Modalidades de Emisión

#### **Modalidad 1: Emisión con Transmisión Previa (NORMAL)**
- **Regla**: Obligatoria para todas las operaciones normales
- **Flujo**: Generar → Firmar → Transmitir → Obtener Sello → Entregar
- **Requisito**: DTE no válido sin Sello antes de entregar al receptor
- **Validez**: Inmediata post Sello

#### **Modalidad 2: Emisión con Transmisión Diferida (CONTINGENCIA)**
- **Excepción**: Solo en caso fortuito o fuerza mayor declarado
- **Flujo**: Generar → Firmar → Entregar (sin Sello) → Evento Contingencia → Transmisión diferida
- **Plazo Transmisión**: ≤72 horas post Sello del Evento
- **DTEs Afectados**: CCFE, FE, NRE, NCE, NDE, FEXE, FSEE
- **Consecuencia Legal**: Documentos presumen ingreso gravado hasta obtener Sello

### 5.2 Proceso de Firma Electrónica

#### **Certificado Electrónico (Digital)**
- **Obligatorio**: Sí, para toda emisión
- **Emisor**: Proveedor de servicios de certificación autorizado por MH
- **Contenido**: Llave pública + privada (PKCS#8)
- **Formato**: Típicamente .p12 o .pfx (PKCS#12)
- **Protección**: Contraseña o HSM (Hardware Security Module)
- **Validez**: Debe estar vigente en momento de firma

#### **Estándar de Firma: JWS (JSON Web Signature)**
- **RFC**: RFC 7515
- **Formato**: Compact Serialization = `Header.Payload.Signature`
- **Algoritmo**: RS256 (RSA Signature with SHA-256)

**Estructura JWS para DTE:**
```
{
  "header": {
    "alg": "RS256",        // RSA + SHA-256
    "typ": "JWS"           // Tipo de contenido
  },
  "payload": {
    // Contenido JSON del DTE (canonicalizado)
  },
  "signature": {
    // Hash SHA-256 del payload, cifrado con llave privada del emisor
  }
}
```

**Proceso Detallado:**
1. Serializar JSON del DTE de forma determinística (canonicalización)
2. Calcular hash SHA-256 del JSON serializado
3. Cifrar hash con llave privada del certificado (RSA)
4. Codificar todo en Base64URL
5. Concatenar: `Base64(header).Base64(payload).Base64(firma)`

#### **Implicaciones Fiscales de la Firma**

| Escenario | Consecuencia Fiscal |
|-----------|---|
| DTE firmado + transmitido + Sello | ✅ Válido, respaldo total de costos/gastos |
| DTE firmado + NO transmitido | ⚠️ Presume ingreso gravado para emisor |
| DTE firmado sin Sello (contingencia) | ⏳ Válido temporalmente; requiere transmisión en 72h |
| DTE NO firmado | ❌ Inválido, no surtir efectos fiscales |

**Para el Receptor:**
- DTEs sin Sello: NO deducibles hasta obtener sello
- DTEs con Sello: Plenamente deducibles
- Obligación: Verificar Sello en portal antes de usar para deducciones

---

## 📤 6. PROCEDIMIENTO DE TRANSMISIÓN Y RECEPCIÓN

### 6.1 Plataformas de Transmisión

#### **Plataforma 1: Sistema de Transmisión DTE (API)**
- **Tipo**: Servicio web (REST API)
- **Usuario**: Contribuyentes con sistema de facturación propio
- **Integración**: Directa, automatizada, programática
- **Validación**: En tiempo real
- **Volumen**: Soporta transmisión unitaria y por lotes

#### **Plataforma 2: Sistema de Facturación DTE (Web)**
- **Tipo**: Aplicación web interactiva
- **Usuario**: Contribuyentes sin sistema propio
- **Costo**: Gratuito (ofrecido por MH)
- **Operación**: Manual, vía portal web
- **Limite**: Para pequeños volúmenes

### 6.2 Modalidades de Transmisión

| Modalidad | Descripción | Timing | DTEs Afectados |
|-----------|---|---|---|
| **Normal (Previa)** | Envío anterior a entrega al receptor | Inmediato | Todos |
| **Contingencia (Diferida)** | Envío post superación de fuerza mayor | ≤72h post Evento | CCFE, FE, NRE, NCE, NDE, FEXE, FSEE |

### 6.3 Obtención del Sello de Recepción y Estados

#### **Proceso de Validación MH**
1. Recepción de DTE firmado en API
2. Validación de estructura JSON vs. Anexo II
3. Validación de firma JWS
4. Validación de campos obligatorios
5. Validación de catálogos (CAT-*)
6. Validación de cálculos (con holgura ±0.01)
7. Validación de integridad de datos

#### **Decisión de MH**

**Si APROBADO:**
- ✅ Otorga Sello de Recepción (UUID + alfanuméricos)
- ✅ Estado: "Transmitido Satisfactoriamente"
- ✅ Documento adquiere validez fiscal
- ✅ Sub-estados posibles: Ajustado, Observado

**Si RECHAZADO:**
- ❌ Emite Código de Error + observaciones detalladas
- ❌ Sin Sello, sin validez fiscal
- ⏱️ Plazo para corrección y retransmisión: 24 horas
- 🔄 Retransmisión: Mismo Código de Generación, DTE corregido

#### **Estados Finales del DTE**

| Estado | Definición | Validez Fiscal | Utilidad |
|--------|---|---|---|
| **Transmitido Satisfactoriamente** | Sello otorgado sin observaciones | ✅ Plena | Respaldo total costos/gastos |
| Transmitido - Ajustado | Sello otorgado pero otra operación lo ajusta | ✅ Afectada | Refleja cambios en cadena de operaciones |
| Transmitido - Observado | Sello otorgado con comentarios MH no bloqueantes | ✅ Plena | Nota de advertencia, sin afectar validez |
| **Rechazado** | No cumplió reglas de validación | ❌ Ninguna | Debe corregirse y retransmitirse |
| **Invalidado** | Sello obtenido pero anulado por evento | ❌ Ninguna | No puede respaldar deducciones |

---

## 📮 7. PROCEDIMIENTOS DE ENTREGA Y CONSERVACIÓN

### 7.1 Entrega del DTE al Receptor

#### **Requisitos de Entrega**

**1. Formato Electrónico:**
- Archivo JSON con estructura completa
- Debe incluir: Sello de Recepción MH
- Validación previa: Receptor verifica Sello en portal

**2. Representación Gráfica (PDF):**
- Formato legible e interpretable
- Claridad de datos: emisor, receptor, detalle, resumen
- Incluir: Código de Generación, Sello, fecha/hora
- Código QR: URL de consulta en portal MH

**3. Obligación Legal:**
- Art. 119-C Código Tributario: Receptor tiene derecho a exigir DTE
- Receptor tiene obligación de exigir entrega en formato JSON con Sello
- Falta de entrega: Responsabilidad civil del emisor

#### **Medios de Entrega Autorizados**
- Correo electrónico
- Portal web del contribuyente
- Descarga desde sistema del emisor
- Cualquier medio electrónico garantizado

### 7.2 Conservación de DTE y Anulación de Documentos

#### **Obligaciones de Conservación**

**Duración:**
- Mínimo: 10 años (conforme Código Tributario)
- Recomendado: 15 años (cubre prescripción completa)

**Condiciones:**
- Formato: Electrónico seguro e inalterable
- Estructura: Idéntica a original (sin modificaciones)
- Integridad: JSON y Sello preservados bit por bit
- Accesibilidad: Recuperable en tiempo razonable (auditoría)
- Cadena de confianza: Certificados raíz y CRL disponibles

**Medio de Almacenamiento:**
- Base de datos con redundancia
- WORM (Write Once, Read Many) recomendado
- Backups cifrados en localización segura
- No en dispositivos removibles sin protección

#### **Documentos Físicos Preimpresos**
- Facturación anterior a DTE: talonarios, libros preimpresos
- Procedimiento: Presentación a MH para anulación oficial
- Documentación: Acta de anulación y destrucción
- Plazo: Según instrucciones MH

---

## 🔄 8. GESTIÓN DE EVENTOS

### 8.1 Procedimiento para Evento de Invalidación

#### **Definición y Propósito**
Mecanismo formal para anular un DTE que:
- Obtuvo Sello de Recepción pero
- Contiene error material (no corrección de operación)
- O la operación fue rescindida/ajustada

#### **Casos, Condiciones y Plazos**

| Caso | Condición | Plazo Máximo |
|------|-----------|---|
| **1** | Error material sin ajuste operacional (fecha, nombre, descripción) | 1 día post Sello |
| **2** | Rescisión total de la operación | 1 día post Sello |
| **3** | Rescisión o afectación de operación (FE/FEXE) | 3 meses post Sello |

#### **Procedimiento**
1. Identificar error/rescisión del DTE original
2. Generar Evento de Invalidación (mensaje firmado)
3. Incluir referencia a DTE a invalidar (Código Generación)
4. Indicar motivo/observación
5. Firmar evento con certificado emisor
6. Transmitir a MH dentro del plazo
7. Obtener Sello del Evento

#### **Efectos de la Invalidación**
- ❌ DTE original pierde toda validez tributaria
- ❌ No puede utilizarse para amparar deducciones
- ❌ No puede respaldar créditos fiscales
- ⚠️ Receptor debe desechar la copia original
- 📋 Evento se registra públicamente

### 8.2 Procedimiento para Evento de Contingencia

#### **Definición y Propósito**
Declaración formal de situación imprevista (caso fortuito, fuerza mayor) que impedía transmisión previa de DTEs.

**Motivos Válidos:**
- Falla de internet del contribuyente
- Caída de servidores de MH
- Desastre natural
- Fallo de sistema de facturación
- Caída de energía eléctrica
- Razones de seguridad (ataque cibernético)

#### **Procedimiento Obligatorio**

**Paso 1: Agotamiento de Reintentos**
- Intentar conexión múltiples veces
- Documentar cada intento fallido
- Esperar según política de reintentos (ej. 1min, 5min, 10min, 30min)
- Solo tras agotar reintentos, declarar contingencia

**Paso 2: Transmisión del Evento de Contingencia**
- Plazo: ≤24 horas contadas desde cese de la falla
- Contenido: Tipo de contingencia, fecha/hora inicio, fecha/hora fin, motivo
- Firma: Electrónica conforme JWS
- Resultado: Obtiene Sello de Recepción del Evento

**Paso 3: Transmisión de DTEs Emitidos en Contingencia**
- Plazo: ≤72 horas post Sello del Evento de Contingencia
- DTEs afectados: CCFE, FE, NRE, NCE, NDE, FEXE, FSEE
- Validación: DTEs ya fueron entregados al receptor (sin Sello)
- Procesamiento: Se tramitan como transmisión normal, obtienen Sello retroactivo

**Paso 4: Informe Técnico (si contingencia > 48h)**
- Obligación: Si falla dura más de 48 horas consecutivas
- Plazo: Junto o post-evento
- Contenido: Causas raíz, acciones tomadas, medidas correctivas
- Receptor: Administración Tributaria

#### **Cronograma De Contingencia**

```
Inicio Contingencia (Hora 0)
        ↓
DTEs emitidos/entregados (SIN Sello)
        ↓
Fin Contingencia + 24h
        ↓
Evento Contingencia transmitido (OBTIENE SELLO)
        ↓
+ 72h desde Sello Evento
        ↓
Todos los DTEs transmitidos (OBTIENEN SELLOS)
        ↓
Fin: Contingencia regularizada
```

#### **Penalizaciones por Incumplimiento**
- ⚠️ Falta de evento: DTEs presumen ingresos gravados indefinidamente
- ⚠️ Retardo en transmisión: Auditoría y multas
- ⚠️ Falsa contingencia: Violación normativa, sanciones penales

---

## 🔍 9. CONSULTA Y VERIFICACIÓN DE DTE

### 9.1 Derechos y Obligaciones de Consulta

#### **Para el Emisor**
- Acceso: Portal web oficial del Ministerio de Hacienda
- Información disponible:
  - Estado de todos los DTEs emitidos
  - Estado de DTEs recibidos de proveedores
  - Sello de Recepción
  - Observaciones o errores
- Beneficio: Control riguroso y auditoria interna
- Utilidad: Confirmar correcta recepción por DGII

#### **Para el Receptor**
- Obligación: Exigir y verificar validez del DTE recibido
- Procedimiento: Ingresar Código de Generación en portal MH
- Validaciones necesarias:
  - Presencia de Sello de Recepción
  - Estado: "Transmitido Satisfactoriamente"
  - Datos de emisor y monto coinciden
- Consecuencia: Sin verificación, no deducible sin riesgo
- Utilidad: Respaldar costos, gastos y créditos fiscales

### 9.2 Plataforma de Consulta
- **URL**: Sitio web oficial Ministerio de Hacienda (consulta DTE)
- **Acceso**: Pública y gratuita
- **Identificador**: Código de Generación (UUID)
- **Información retornada**: Estado, Sello, Emisor, Receptor, Monto

---

## 🔀 10. FLUJO DE PROCESO INTEGRADO DE DTE

### 10.1 Diagrama de Flujo Simplificado

```
┌─────────────────────────────────────────────────────┐
│ INICIO: Necesidad de emitir DTE por operación      │
└────────────────┬────────────────────────────────────┘
                 ↓
         ┌───────────────────┐
         │ GENERACIÓN        │  Crear JSON con estructura Anexo II
         │ (Sección 4)       │  - Identificación, Emisor, Receptor
         │                   │  - Cuerpo (ítems), Resumen
         └────────┬──────────┘  - Códigos (UUID + Número Control)
                  ↓              - Cálculos y redondeos
         ┌───────────────────┐
         │ FIRMA JWS         │  - Cargar certificado digital
         │ (Sección 5.2)     │  - Canonicalizar JSON
         │                   │  - Hash SHA-256 + RSA
         └────────┬──────────┘  - Generar firma RS256
                  ↓
         ┌───────────────────────────────┐
         │ ¿CONTINGENCIA?                │
         └───┬───────────────────────┬───┘
             │ SÍ                    │ NO
             ↓                       ↓
        ┌──────────────┐      ┌──────────────────┐
        │ ENTREGAR A   │      │ TRANSMISIÓN A MH │
        │ RECEPTOR     │      │ (Sección 6)      │
        │ (sin Sello)  │      │ - API o Sistema  │
        └──────┬───────┘      │   Web MH         │
               ↓              └────────┬─────────┘
        ┌──────────────────────────┐   ↓
        │ EVENTO CONTINGENCIA      │ ┌──────────────────┐
        │ - Generar y transmitir   │ │ VALIDACIÓN MH    │
        │   dentro 24h             │ │ - Estructura JSON│
        │ - Obtener Sello          │ │ - Firma JWS      │
        └──────┬───────────────────┘ │ - Campos requeridos
               ↓                      │ - Catálogos      │
        ┌──────────────────────────┐ │ - Cálculos       │
        │ DTEs en CONTINGENCIA     │ │ - Integridad     │
        │ - Transmitir ≤72h       │ └───┬──────────────┘
        │ - Obtener Sellos         │    ↓
        └──────────────┬───────────┘ ┌──────────────────┐
                       ↓             │ DECISIÓN MH      │
                   ┌───────────────┐ └───┬──┬──────────┘
                   │ (continúa)    │     │  │
                   └─────────┬─────┘     │  │
                             ↓          │  │
               ┌──────────────────┐  APROBADO  RECHAZADO
               │ SELLO OBTENIDO   │  │  │
               │ (Válido fiscal)  │  │  ↓
               └────────┬─────────┘  │ ┌──────────────┐
                        ↓            │ │ ERROR / RES. │
               ┌────────────────────┐ │ - Corregir   │
               │ ALMACENAMIENTO    │ │ - 24h plazo  │
               │ (Conservación)    │ │ - Retransmit │
               │ 10-15 años, seguro│ └──────┬───────┘
               └────────┬─────────┘        ↓
                        ↓          (Regresa a GENERACIÓN)
               ┌────────────────────┐
               │ EVENTO INVALIDACIÓN │ (opcional)
               │ Si hay rescisión o  │
               │ error (días/meses)  │
               │ Anula el DTE original
               └────────┬─────────────┘
                        ↓
               ┌────────────────────┐
               │ FIN DEL CICLO      │
               │ DTE completamente  │
               │ gestionado         │
               └────────────────────┘
```

### 10.2 Secuencia Detallada de Pasos

| Paso | Actividad | Responsable | Resultado |
|------|-----------|---|---|
| 1 | Inicio: Operación comercial | Emisor | Necesidad de DTE |
| 2 | Generación JSON | Sistema de Facturación | Archivo JSON estructura Anexo II |
| 3 | Firma electrónica JWS | Sistema + Certificado | DTE firmado RS256 |
| 4 | Verificar contingencia | Sistema | Decisión: Normal o Diferida |
| 5a (Normal) | Transmisión a MH | Sistema → API MH | Envío para validación |
| 5b (Contingencia) | Entrega al receptor | Emisor → Receptor | DTE recibido (sin Sello aún) |
| 6a (Normal) | Validación MH | MH (automático) | Aprobación o rechazo |
| 6b (Contingencia) | Evento Contingencia | Emisor → MH (≤24h) | Sello del evento |
| 7a (Normal-Aprobado) | Sello otorgado | MH | DTE plenamente válido |
| 7b (Normal-Rechazado) | Código de error | MH | Retorno al paso 2 (corrección) |
| 7c (Contingencia) | DTEs diferidos | Sistema → MH (≤72h) | Transmisión post evento |
| 8 | Almacenamiento seguro | Emisor (Base datos) | Conservación 10-15 años |
| 9 | Evento Invalidación (opt.) | Emisor → MH | Anulación si requiere |
| 10 | Fin del ciclo | — | Gestión completada |

---

## ⚡ 11. IMPLICACIONES CLAVE PARA FACTURAEXPRESS

### 11.1 Requisitos Normativo vs. Implementación

| Requisito | Estado en FacturaXpress | Prioridad |
|-----------|---|---|
| **Estructura JSON Anexo II** | ✅ Implementado | — |
| **Códigos (UUID + Número Control)** | ✅ Implementado | — |
| **Reglas de Cálculo (redondeo, holgura)** | ✅ Estructura lista | — |
| **Firma JWS RS256** | 🟡 Skeleton | 🔴 CRÍTICA |
| **Certificado Digital X.509** | 🟡 Interface | 🔴 CRÍTICA |
| **Transmisión Normal** | ✅ Mock implementado | — |
| **Transmisión Contingencia** | 🟡 Campos, no lógica | 🟡 ALTA |
| **Evento de Invalidación** | ❌ No implementado | 🟡 ALTA |
| **Evento de Contingencia** | ❌ No implementado | 🟡 ALTA |
| **Consulta de DTE** | ✅ Mock implementado | — |
| **PDF + QR** | 🟡 Incompleto | 🟡 MEDIA |
| **Conservación 10 años** | ✅ Arquitectura lista | — |
| **Auditoría/Logs** | 🟡 Parcial | 🟡 MEDIA |

### 11.2 Plazos Críticos a Implementar

```
OPERACIÓN DTE:
├─ Generación: Inmediata
├─ Firma: Inmediata post generación
├─ Transmisión: Inmediata (normal)
├─ Validación MH: ~1-3s
├─ Corrección (si rechazo): ≤24h post rechazo
│
CONTINGENCIA:
├─ Evento: ≤24h post cese de falla
├─ DTEs emitidos: ≤72h post Sello del evento
├─ Informe técnico: Si falla >48h
│
INVALIDACIÓN:
├─ Error simple: ≤1 día post Sello
├─ Rescisión: ≤1 día post Sello
├─ FE/FEXE afectadas: ≤3 meses post Sello
```

### 11.3 Puntos de Validación Obligatorios

- ✅ Estructura JSON conforme Anexo II
- ✅ Campos obligatorios presentes
- ✅ Catálogos válidos (CAT-001 a CAT-032)
- ✅ Códigos únicos (UUID + Número Control sin duplicar)
- ✅ Redondeo conforme reglas (8 decimales ítems, 2 resumen)
- ✅ Cálculos con holgura ±0.01
- ✅ Firma JWS válida
- ✅ Certificado digital vigente
- ✅ Transmisión exitosa (Sello recibido)
- ✅ Almacenamiento íntegro por 10+ años

---

## 📚 12. REFERENCIAS Y NORMATIVA

| Documento | Versión | Cobertura |
|-----------|---------|---|
| **Normativa de Cumplimiento DTE** | 1.1 | Estructura, firma, transmisión |
| **Manual de Procedimientos Operativos** | Vigente | Generación, eventos, conservación |
| **Anexo I: Especificaciones Tecnológicas** | RFC 7515 (JWS), RFC 4122 (UUID) | Estructura JSON, formato |
| **Anexo II: Estructura de Datos** | Vigente | Campos y tipos |
| **Catálogos CAT-001 a CAT-032** | Actualizados | Validación de valores |
| **Código Tributario El Salvador** | Art. 119-A, 119-C, 206 | Obligatoriedad, validez fiscal |
| **RFC 4122** | UUID v4 | Código de Generación |
| **RFC 7515** | JWS Compact Serialization | Firma electrónica |
| **RFC 7159** | JSON | Formato de datos |

---

**Documento Preparado**: 25 de Diciembre, 2025  
**Fuente Normativa**: Manual de Procedimientos Operativos - MH El Salvador (Versión 1.1)  
**Clasificación**: Interno - Respaldo de Requerimientos  
**Confidencialidad**: Información pública - Normativa oficial MH
