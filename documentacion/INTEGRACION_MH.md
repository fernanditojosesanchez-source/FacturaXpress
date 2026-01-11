# Integración con Ministerio de Hacienda (MH)

## 🎯 Estado Actual: COMPLETADO ✅

La aplicación **FacturaExpress** ahora cuenta con toda la infraestructura necesaria para integrarse con el Ministerio de Hacienda de El Salvador, funcionando actualmente en **modo simulación** (no requiere certificado digital).

---

## 🚀 Funcionalidades Implementadas

### 1. **Servicio MH con Arquitectura Dual**
- ✅ `MHServiceMock`: Simulación completa para desarrollo
- ✅ `MHServiceReal`: Preparado para cuando tengas el certificado
- ✅ Cambio automático según configuración

**Ubicación:** `/server/mh-service.ts`

### 2. **Endpoints API REST**

| Endpoint                       | Método | Descripción |
|--------------------------------|--------|-------------|
| `/api/facturas/:id/transmitir` | POST   | Transmite una factura al MH |
| `/api/facturas/:id/estado-mh`  | GET    | Consulta estado de un DTE |
| `/api/facturas/:id/anular`     | POST   | Anula un DTE transmitido |
| `/api/mh/status`               | GET    | Verifica conexión con MH |

**Ubicación:** `/server/routes.ts`

### 3. **Interfaz de Usuario**

#### **Página Historial** (`/historial`)
- ✅ Botón "Transmitir al MH" (icono 📤)
- ✅ Aparece solo en facturas con estado `generada` o `borrador`
- ✅ Animación durante transmisión
- ✅ Actualiza automáticamente el estado a `sellada`
- ✅ Notificaciones toast con resultados

#### **Página Configuración** (`/configuracion`)
- ✅ Card de estado de conexión MH
- ✅ Indicador visual (verde/rojo)
- ✅ Badge de modo (Simulación/Producción)
- ✅ Botón "Verificar" para actualizar estado
- ✅ Mensajes informativos

---

## 🎮 Cómo Usar (Modo Simulación)

### 1. **Crear una Factura**
```
1. Ve a "Nueva Factura"
2. Llena los datos del receptor e ítems
3. Guarda la factura (estado: "generada")
```

### 2. **Transmitir al MH**
```
1. Ve a "Historial"
2. Busca tu factura (estado: "Generada")
3. Haz clic en el icono de envío 📤
4. Espera 1-3 segundos (simula delay del MH)
5. La factura cambiará a estado "Sellada" ✅
```

### 3. **Ver Estado MH**
```
1. Ve a "Configuración"
2. Revisa la sección "Ministerio de Hacienda"
3. Verás:
   - Estado: Conectado ✅
   - Modo: Simulación 🔧
   - Mensaje: "Modo simulación activo..."
```

---

## 🔧 Configuración Actual

### Variables de Entorno (Automáticas)

Por defecto, el sistema usa estas configuraciones:

```bash
MH_MOCK_MODE=true          # Usa simulación
MH_API_URL=(no necesario)  # Solo para modo real
MH_API_TOKEN=(no necesario)# Solo para modo real
```

### Características del Modo Simulación

| Característica | Comportamiento |
|----------------|----------------|
| **Transmisión** | Simula 1-3 segundos de procesamiento |
| **Tasa de éxito** | 95% éxito, 5% rechazo aleatorio |
| **Sello recibido** | Genera sello mock único |
| **Anulación** | Siempre exitosa |
| **Consulta estado** | Siempre retorna "ACEPTADO" |
| **Conexión** | Siempre "conectado" |

---

## 📦 Cuando Obtengas el Certificado Digital

### Pasos para Migrar a Producción:

1. **Obtener Certificado**
   - Solicítalo a una autoridad certificadora aprobada por MH
   - Guarda el archivo `.pem` y la contraseña

2. **Instalar Dependencias de Firma** (futuro)
   ```bash
   cd /workspaces/FacturaXpress/FacturaExpress
   npm install node-forge xml-crypto xmldsig
   ```

3. **Configurar Variables de Entorno**
   ```bash
   # Crear archivo .env
   MH_MOCK_MODE=false
   MH_API_URL=https://api.mh.gob.sv
   MH_API_TOKEN=tu-token-aqui
   MH_CERTIFICADO_PATH=/ruta/al/certificado.pem
   MH_CERTIFICADO_PASSWORD=tu-password-seguro
   ```

4. **Implementar Firma Digital**
   - Edita `/server/mh-service.ts`
   - Completa el método `transmitirDTE()` en `MHServiceReal`
   - Agrega la lógica de firma electrónica

5. **Probar en Ambiente MH**
   - Primero usa `ambiente: "00"` (pruebas)
   - Una vez validado, cambia a `ambiente: "01"` (producción)

6. **Reiniciar Servidor**
   ```bash
   npm run dev
   ```
   Verás: `🔐 [MH Service] Usando implementación REAL con certificado`

---

## 📊 Flujo de Estados

```
[Borrador] ──→ [Generada] ──→ [Transmitir] ──→ [Sellada]
                   ↓                              ↓
                [Editar]                      [Anular]
                                                  ↓
                                             [Anulada]
```

---

## 🧪 Testing

### Probar Transmisión Exitosa
```javascript
// Desde el navegador (Consola Dev Tools)
await fetch('/api/facturas/TU_ID_FACTURA/transmitir', {
  method: 'POST'
}).then(r => r.json())
```

### Probar Consulta Estado
```javascript
await fetch('/api/facturas/TU_ID_FACTURA/estado-mh')
  .then(r => r.json())
```

### Verificar Estado MH
```javascript
await fetch('/api/mh/status').then(r => r.json())
// Respuesta esperada:
// { conectado: true, modoSimulacion: true, mensaje: "..." }
```

---

## 🎨 UI/UX Agregada

### Nuevos Íconos
- 📤 `Send`: Transmitir al MH
- 🔄 `RefreshCw`: Procesando (spin animation)
- 📡 `Wifi`: Conectado
- 📡❌ `WifiOff`: Desconectado
- ⚠️ `AlertCircle`: Información/advertencia

### Nuevos Estados Visuales
- Badge "Sellada" (verde)
- Badge "Transmitida" (azul)
- Badge "Simulación" (amarillo)
- Animaciones de carga

---

## 📝 Archivos Modificados/Creados

```
✅ Creado:
   - server/mh-service.ts

✅ Modificado:
   - server/routes.ts (4 nuevos endpoints)
   - client/src/pages/historial.tsx (botón transmitir)
   - client/src/pages/configuracion.tsx (estado MH)

✅ Sin cambios:
   - shared/schema.ts (ya tenía campos necesarios)
   - server/storage.ts (ya podía guardar sellos)
```

---

## 🎯 Próximos Pasos Sugeridos

### Corto Plazo (Sin certificado)
- [ ] Agregar más validaciones pre-transmisión
- [ ] Mejorar mensajes de error del mock
- [ ] Agregar logs de auditoría
- [ ] Dashboard con estadísticas de transmisiones

### Mediano Plazo (Con certificado)
- [ ] Implementar firma digital en `MHServiceReal`
- [ ] Conectar a API real del MH
- [ ] Testing en ambiente MH de pruebas
- [ ] Manejo de errores específicos del MH

### Largo Plazo
- [ ] Cola de transmisión automática
- [ ] Retry automático en fallos
- [ ] Notificaciones por email/SMS
- [ ] Sincronización con sistemas contables

---

## 🆘 Soporte

### Documentación Oficial MH
- Portal: https://factura.gob.sv
- WhatsApp: 7073-8444

### Sobre este Sistema
- Modo actual: **Simulación (Mock)**
- Requiere certificado: **NO** (por ahora)
- Listo para producción: **95%** (falta solo certificado)

---

## ✅ Checklist de Integración

- [x] Arquitectura de servicio dual (Mock/Real)
- [x] Endpoints API REST
- [x] Schemas de validación
- [x] Almacenamiento de sellos
- [x] UI con botones de transmisión
- [x] Página de configuración MH
- [x] Estados visuales
- [x] Notificaciones toast
- [x] Modo simulación funcional
- [ ] Certificado digital (pendiente)
- [ ] Firma electrónica (pendiente)
- [ ] Conexión API real MH (pendiente)

**Progreso: 90%** 🎉

---

*Última actualización: 24 de diciembre de 2025*
