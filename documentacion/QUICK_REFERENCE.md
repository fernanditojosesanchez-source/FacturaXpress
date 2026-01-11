# 🚀 FacturaXpress - Quick Reference Card

## 📋 Comandos Principales

```bash
# Iniciar servidor de desarrollo
npm run dev

# Build para producción
npm run build

# Compilar TypeScript
npm run check

# Ejecutar linter
npm run lint
npm run lint:fix
```

## 🔗 Endpoints Importantes

### Autenticación
- `POST /api/auth/login` - Login (body: `{username, password}`)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Usuario actual

### Catálogos
- `GET /api/catalogos/all` - Todos los catálogos
- `GET /api/catalogos/departamentos` - Departamentos
- `GET /api/catalogos/tipos-documento` - Tipos de documento
- `GET /api/catalogos/tipos-dte` - Tipos de DTE

### Validación & Facturas
- `POST /api/validar-dte` - Pre-validar DTE (body: objeto DTE)
- `GET /api/facturas` - Listar facturas
- `POST /api/facturas` - Crear factura con validación automática
- `GET /api/facturas/:id` - Obtener factura por ID
- `PATCH /api/facturas/:id` - Actualizar factura
- `DELETE /api/facturas/:id` - Eliminar factura

## 🪝 Hooks Disponibles

```typescript
// Autenticación
const { user, isAuthenticated, login, logout } = useAuth();

// Catálogos (con caché 1 hora)
const { data: catalogos, isLoading } = useCatalogos();

// Validación DTE
const { mutate: validarDTE, isPending } = useValidateDTE();
validarDTE(dteData, {
  onSuccess: (response) => console.log(response.valid),
  onError: (error) => console.log(error.errors)
});
```

## 📊 Estructura de Datos Clave

### DTE (Documento Tributario Electrónico)
```json
{
  "version": 1,
  "ambiente": "00|01",  // 00=Pruebas, 01=Producción
  "tipoDte": "01|03|05|06...",  // Tipo de documento
  "numeroControl": "001-123456789012345678",
  "codigoGeneracion": "UUID-v4",
  "fecEmi": "YYYY-MM-DD",
  "horEmi": "HH:MM:SS",
  "emisor": {
    "nit": "14-dígitos-1",
    "nombre": "Razón social",
    "direccion": { "departamento", "municipio", "complemento" }
  },
  "receptor": {
    "tipoDocumento": "36|13|02|03|37",
    "numDocumento": "documento",
    "nombre": "Nombre/Razón social"
  },
  "cuerpoDocumento": [
    {
      "cantidad": 1.0,
      "descripcion": "Producto/Servicio",
      "precioUni": 100.00,
      "ventaGravada": 100.00
    }
  ],
  "resumen": {
    "totalGravada": 100.00,
    "totalIva": 13.00,
    "totalPagar": 113.00
  }
}
```

## ✅ Validación de Campos

### NIT Emisor
- Formato: `^\d{14}-\d$` (14 dígitos - 1 verificador)
- Ejemplo: `06050000000000-7`

### DUI Receptor
- Formato: `^\d{8}-\d$` (8 dígitos - 1 verificador)
- Ejemplo: `12345678-9`

### Número de Control
- Formato: `^\d{3}-\d{18}$` (3 dígitos - 18 dígitos)
- Ejemplo: `001-123456789012345678`

### Código de Generación
- Formato: UUID v4
- Ejemplo: `550e8400-e29b-41d4-a716-446655440000`

## 📂 Estructura de Carpetas

```
FacturaExpress/
├── client/
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-catalogos.ts
│   │   │   └── use-validate-dte.ts
│   │   └── pages/
│   └── ...
├── server/
│   ├── dgii-validator.ts          ← Validación schema
│   ├── dgii-resources/
│   │   └── factura-schema.json    ← Schema DGII
│   ├── catalogs.ts                ← Catálogos
│   ├── auth.ts                    ← Autenticación
│   ├── routes.ts                  ← Endpoints API
│   └── ...
├── shared/
│   └── schema.ts                  ← Schemas Zod
├── DGII_VALIDATION.md
├── STATUS.md
└── package.json
```

## 🧪 Testing Rápido

```bash
# Test usuario admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Validar DTE completo
curl -X POST http://localhost:5000/api/validar-dte \
  -H "Content-Type: application/json" \
  -d @test-dte-ejemplo.json

# Obtener catálogos
curl http://localhost:5000/api/catalogos/all
```

## ⚙️ Variables de Entorno

```env
NODE_ENV=development|production
PORT=5000
```

## 🎯 Próximas Tareas (Backlog)

1. ✅ Validación DGII Schema completada
2. 🔄 Integración en formularios (EN PROGRESO)
3. ⏳ Firma digital (SVFE-API-Firmador)
4. ⏳ Transmisión al MH
5. ⏳ Reportes y auditoría

## 🚨 Problemas Comunes

### "No QueryClient set"
→ Asegúrate de que `<QueryClientProvider>` envuelva la app

### Cookies no se envían
→ Usa `credentials: 'include'` en fetch/axios

### Errores de validación oscuros
→ Revisa `DGII_VALIDATION.md` para detalles de campos

### Vite devuelve HTML en lugar de JSON
→ Espera a que el servidor compile completamente después de cambios

---

**Status**: ✅ Infraestructura validación completada  
**Servidor**: http://localhost:5000  
**Usuario Test**: admin/admin
