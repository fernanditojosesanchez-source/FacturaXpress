# Integración de Validación DGII en FacturaXpress

## Descripción General

Se ha implementado validación automática de Documentos Tributarios Electrónicos (DTEs) según los estándares de la Dirección General de Ingresos (DGII) de El Salvador.

## Características Implementadas

### 1. **JSON Schema DGII** (`/server/dgii-resources/factura-schema.json`)

Validación de estructura DTE completa incluyendo:
- ✅ Información de emisor (NIT, NRC, actividad)
- ✅ Información de receptor (tipo documento, número)
- ✅ Detalles de items (cantidad, descripción, precios)
- ✅ Resumen de operación (totales, IVA, moneda)
- ✅ Códigos de departamento/municipio

### 2. **Validador DGII** (`/server/dgii-validator.ts`)

Funciones de validación especializadas:

```typescript
// Validación de estructura DTE completa
validateDTESchema(dte) → { valid: boolean, errors: DTEValidationError[] }

// Validación de números de control (3 dígitos - 18 dígitos)
validateNumeroControl(numeroControl) → boolean

// Validación de UUID v4 para código de generación
validateCodigoGeneracion(codigoGeneracion) → boolean

// Validación con verificador de NIT
validateNITComplete(nit) → boolean

// Validación con verificador de DUI
validateDUIComplete(dui) → boolean

// Cálculo del dígito verificador de NIT (algoritmo DGII)
calculateNITVerifier(nit) → string
```

### 3. **Endpoints API**

#### Validación pre-creación de DTE
```
POST /api/validar-dte
Content-Type: application/json

{
  "tipoDte": "01",
  "numeroControl": "001-123456789012345678",
  "codigoGeneracion": "550e8400-e29b-41d4-a716-446655440000",
  // ... datos DTE
}

Response (200):
{ "valid": true, "message": "DTE válido según schema DGII" }

Response (400):
{ 
  "valid": false, 
  "errors": [
    { "field": "/emisor/nit", "message": "must match pattern..." }
  ]
}
```

#### Creación de factura con validación automática
```
POST /api/facturas
Content-Type: application/json

Response (201): Factura creada
Response (400): { "error": "Validación DGII fallida", "dgiiErrors": [...] }
```

### 4. **Hook de Validación Frontend** (`/client/src/hooks/use-validate-dte.ts`)

```typescript
const { mutate: validarDTE, isPending } = useValidateDTE();

validarDTE(dteData, {
  onSuccess: (response) => {
    // DTE válido, proceder a crear
  },
  onError: (error) => {
    // Mostrar errores de validación al usuario
    console.log(error.errors);
  }
});
```

## Flujo de Validación

```
Usuario crea DTE en formulario
        ↓
Frontend valida con Zod (validaciones básicas)
        ↓
Frontend llama POST /api/validar-dte (opcional, pre-validación)
        ↓
Usuario envía a crear
        ↓
Backend valida con Zod nuevamente
        ↓
Backend valida con schema DGII (AJV)
        ↓
✅ DTE creado / ❌ Errores devueltos al usuario
```

## Algoritmos de Verificación

### NIT (14 dígitos - 1 verificador)

```
Multiplicadores: [3,7,13,17,19,23,29,31,37,41,43,47,53,59]
Suma = Σ(dígito_i × multiplicador_i)
Verificador = 11 - (Suma mod 11)
- Si resultado = 10 → verificador = 0
- Si resultado = 11 → verificador = 9
```

Ejemplo: `06050000000000-7`

### DUI (8 dígitos - 1 verificador)

Algoritmo Modulo 10 con multiplicadores [2,3,4,5,6,7,2,3]

Ejemplo: `12345678-9`

## Catálogos DGII Integrados

Disponibles vía `GET /api/catalogos/all`:

- **Tipos DTE**: Factura, Comprobante de Crédito, Nota Débito/Crédito, etc.
- **Departamentos**: 14 departamentos de El Salvador
- **Municipios**: Códigos de municipios por departamento
- **Tipos Documento**: NIT, DUI, Pasaporte, etc.
- **Formas Pago**: Contado, Crédito, Cheque, etc.
- **Unidades Medida**: Unidad, Kilo, Metro, etc.

## Testing

### Crear DTE válido
```bash
curl -X POST http://localhost:5000/api/validar-dte \
  -H "Content-Type: application/json" \
  -d @test-dte-valido.json
```

### Crear DTE inválido
```bash
curl -X POST http://localhost:5000/api/validar-dte \
  -H "Content-Type: application/json" \
  -d '{"tipoDte":"99"}' # tipoDte inválido
```

## Campos Requeridos Principales

| Campo | Formato | Ejemplo |
|-------|---------|---------|
| tipoDte | Enum (01-15) | "01" (Factura) |
| numeroControl | ###-################ | "001-123456789012345678" |
| codigoGeneracion | UUID v4 | "550e8400-e29b-41d4-a716-446655440000" |
| emisor.nit | ##############-# | "06050000000000-7" |
| emisor.nrc | Numérico | "123456" |
| receptor.numDocumento | Variable por tipo | "12345678-9" |
| fecEmi | YYYY-MM-DD | "2024-01-15" |
| horEmi | HH:MM:SS | "14:30:45" |

## Próximas Fases

1. **Firma Digital** (`SVFE-API-Firmador`): Integración de firma electrónica
2. **Transmisión MH**: Envío de DTEs a Ministerio de Hacienda
3. **Sellado MH**: Recepción de respuesta con sello digital
4. **Consulta Estado**: Verificación de estado de DTEs transmitidos

## Referencias

- [DGII - Estándares DTE](https://dgii.mh.gob.sv/)
- [Formato XML DTEs](https://www.hacienda.gob.sv/)
- Algoritmos de verificación DGII (NIT, DUI)
