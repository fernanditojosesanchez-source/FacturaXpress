# 🎲 Generador de Datos de Prueba

## ✨ Características

El sistema incluye un **generador automático de datos de prueba** que crea facturas realistas con:

- ✅ Emisor preconfigurado (COMERCIAL LA ESPERANZA S.A. DE C.V.)
- ✅ 5 receptores diferentes (empresas y personas naturales)
- ✅ 15 productos y servicios variados
- ✅ Fechas aleatorias en los últimos 30 días
- ✅ Estados variados (borrador, generada, sellada, transmitida)
- ✅ Cálculos automáticos de IVA y totales
- ✅ Números de control y códigos de generación válidos

---

## 🚀 Cómo Usar (Interfaz Gráfica)

### **Opción 1: Desde la Página de Configuración**

1. Ve a **Configuración** en el menú lateral
2. Busca la sección **"Datos de Prueba"**
3. Ajusta la cantidad de facturas (1-100)
4. Haz clic en **"Generar Datos"**
5. ¡Listo! Las facturas aparecerán en el Historial

### **Para Limpiar Datos:**

1. En la misma sección, haz clic en **"Limpiar Todo"**
2. Confirma la acción
3. Todas las facturas serán eliminadas

---

## 🔧 Cómo Usar (API REST)

### **Generar Facturas de Prueba**

```bash
curl -X POST http://localhost:5000/api/seed/facturas \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 20}'
```

**Respuesta:**
```json
{
  "success": true,
  "cantidad": 20,
  "mensaje": "Se generaron 20 facturas de prueba"
}
```

### **Guardar Emisor de Prueba**

```bash
curl -X POST http://localhost:5000/api/seed/emisor
```

**Respuesta:**
```json
{
  "success": true,
  "emisor": {
    "nit": "0614-160689-101-8",
    "nrc": "12345-6",
    "nombre": "COMERCIAL LA ESPERANZA S.A. DE C.V.",
    ...
  }
}
```

### **Limpiar Todas las Facturas**

```bash
curl -X DELETE http://localhost:5000/api/seed/facturas
```

**Respuesta:**
```json
{
  "success": true,
  "cantidad": 20,
  "mensaje": "Se eliminaron 20 facturas"
}
```

---

## 📊 Datos Generados

### **Emisor de Prueba**
```
Nombre: COMERCIAL LA ESPERANZA S.A. DE C.V.
NIT: 0614-160689-101-8
NRC: 12345-6
Ubicación: Colonia Escalón, San Salvador
Actividad: Venta al por menor
```

### **Receptores (5 diferentes)**

1. **INVERSIONES TÉCNICAS S.A. DE C.V.** (Empresa IT)
2. **MARÍA JOSÉ RAMÍREZ GONZÁLEZ** (Persona natural)
3. **RESTAURANTE EL BUEN SABOR S.A.** (Restaurante)
4. **FARMACIA SALUD TOTAL S.A.** (Farmacia)
5. **CARLOS ALBERTO GARCÍA MÉNDEZ** (Persona natural)

### **Productos/Servicios (15 ítems)**

**Tecnología:**
- Laptop Dell Inspiron 15 ($650.00)
- Monitor LED 24" ($180.00)
- Impresora HP LaserJet ($320.00)
- Mouse inalámbrico ($12.50)
- Teclado RGB ($45.00)
- Webcam HD 1080p ($55.00)
- Disco duro externo 1TB ($65.00)
- Memoria USB 32GB ($10.00)
- Audífonos Bluetooth ($85.00)
- Cable HDMI ($8.50)

**Servicios:**
- Instalación de software ($75.00)
- Soporte técnico mensual ($150.00)

**Accesorios:**
- Cargador universal ($25.00)
- Mousepad ergonómico ($15.00)

**Licencias:**
- Office 365 Personal ($69.99)

### **Estados Generados**

Las facturas se crean con estados variados:
- 🟡 **Borrador** (10%)
- 🔵 **Generada** (40%) ← Listas para transmitir
- ✅ **Sellada** (30%)
- 🟢 **Transmitida** (20%)

---

## 💡 Casos de Uso

### **1. Testing Rápido**
```bash
# Genera 5 facturas para probar
curl -X POST http://localhost:5000/api/seed/facturas \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 5}'
```

### **2. Demo Completa**
```bash
# Genera 50 facturas para demostración
curl -X POST http://localhost:5000/api/seed/facturas \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 50}'
```

### **3. Load Testing**
```bash
# Genera 100 facturas (máximo)
curl -X POST http://localhost:5000/api/seed/facturas \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 100}'
```

### **4. Reset Completo**
```bash
# Limpiar todo y empezar de nuevo
curl -X DELETE http://localhost:5000/api/seed/facturas
curl -X POST http://localhost:5000/api/seed/emisor
curl -X POST http://localhost:5000/api/seed/facturas \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 10}'
```

---

## 🎯 Datos Realistas

Todas las facturas generadas incluyen:

✅ **Fechas variadas** - Últimos 30 días aleatorios  
✅ **Horas realistas** - Horarios comerciales  
✅ **Números de control** - Formato correcto DTE  
✅ **Códigos de generación** - UUIDs válidos  
✅ **Cálculos precisos** - IVA 13% correcto  
✅ **Totales en letras** - Conversión automática  
✅ **Múltiples ítems** - 1-5 productos por factura  
✅ **Cantidades variables** - 1-5 unidades por ítem  
✅ **Direcciones reales** - Departamentos y municipios de El Salvador  

---

## 🔍 Ejemplo de Factura Generada

```json
{
  "id": "abc-123-def",
  "numeroControl": "DTE-01-0001-0001-000000000001234",
  "codigoGeneracion": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
  "fecEmi": "2025-12-15",
  "horEmi": "14:30:15",
  "estado": "generada",
  "emisor": {
    "nombre": "COMERCIAL LA ESPERANZA S.A. DE C.V.",
    "nit": "0614-160689-101-8",
    ...
  },
  "receptor": {
    "nombre": "INVERSIONES TÉCNICAS S.A. DE C.V.",
    "numDocumento": "0614-250588-102-5",
    ...
  },
  "cuerpoDocumento": [
    {
      "numItem": 1,
      "descripcion": "Laptop Dell Inspiron 15, 8GB RAM, 256GB SSD",
      "cantidad": 2,
      "precioUni": 650.00,
      "ventaGravada": 1300.00,
      "ivaItem": 169.00
    }
  ],
  "resumen": {
    "totalGravada": 1300.00,
    "totalIva": 169.00,
    "totalPagar": 1469.00,
    "totalLetras": "MIL CUATROCIENTOS SESENTA Y NUEVE DÓLARES CON 00/100"
  }
}
```

---

## ⚡ Rendimiento

| Cantidad | Tiempo aprox. |
|----------|---------------|
| 10 facturas | ~0.1 segundos |
| 50 facturas | ~0.5 segundos |
| 100 facturas | ~1 segundo |

---

## 🛡️ Validaciones

El generador respeta todas las validaciones:

✅ NITs válidos con formato correcto  
✅ NRCs válidos  
✅ DUIs válidos (formato 8 dígitos + verificador)  
✅ Departamentos y municipios reales de El Salvador  
✅ Códigos de actividad económica válidos  
✅ Tipos de documento correctos  
✅ Cálculos de IVA precisos  
✅ Totales coherentes  

---

## 🎨 Personalización

Si quieres agregar tus propios datos de prueba, edita:

**Archivo:** `/server/seed-data.ts`

```typescript
// Agregar más receptores
export const RECEPTORES_PRUEBA = [
  // ... tus receptores aquí
];

// Agregar más productos
export const PRODUCTOS_SERVICIOS = [
  // ... tus productos aquí
];
```

---

## 📝 Notas

- Los datos generados son **ficticios** pero **realistas**
- Todos los NITs, NRCs y DUIs son **inventados**
- Las direcciones son **genéricas** de zonas reales
- Los números de teléfono son **de ejemplo**
- Los correos son **ficticios**

---

## 🚀 Siguiente Paso

Una vez que tengas facturas de prueba:

1. Ve a **Historial**
2. Busca facturas con estado **"Generada"**
3. Haz clic en el icono 📤 para **transmitir al MH** (modo simulación)
4. Observa cómo cambian a **"Sellada"** ✅

---

*Generador creado para facilitar el desarrollo y testing - FacturaXpress 2025*
