# Implementación UI - Anulaciones y Sistema de Invalidación

## Descripción General

Se completó la implementación de la interfaz de usuario para el sistema de anulaciones (invalidación de documentos tributarios). Esto incluye componentes React, hooks personalizados y una integración completa en la página de historial de facturas.

## Componentes Creados

### 1. `use-anulaciones.ts` - Hook personalizado
**Ubicación:** `client/src/hooks/use-anulaciones.ts`

Proporciona hooks React para interactuar con las APIs de anulaciones:

- **`useAnulacionesPendientes()`**
  - Obtiene lista de anulaciones pendientes de procesamiento
  - Auto-refetch cada 5 segundos
  - Retorna array de `AnulacionPendiente`

- **`useAnulacionesHistorico(limit: number)`**
  - Obtiene histórico de anulaciones completadas/con error
  - Auto-refetch cada 10 segundos
  - Parámetro `limit` para limitar resultados (default 50)

- **`useAnularDTE(facturaId: string)`**
  - Mutation para anular un DTE específico
  - Acepta motivo de anulación (01-05)
  - Invalida queries después de éxito

- **`useProcesarAnulacionesPendientes()`**
  - Mutation para procesar cola de anulaciones pendientes
  - Trigger manual del procesamiento asincrónico

### 2. `anular-dte-dialog.tsx` - Modal de anulación
**Ubicación:** `client/src/components/anular-dte-dialog.tsx`

Modal controlado para anular un documento tributario con:

**Props:**
```typescript
interface AnularDTEDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facturaId: string;
  codigoGeneracion: string;
  receptorRazonSocial?: string;
  monto?: number;
}
```

**Características:**
- Selector de motivo de anulación (01-05) con descripciones completas
- Validación de motivo antes de envío
- Muestra información de la factura (código gen, receptor, monto)
- Warning prominente sobre irreversibilidad
- Manejo de estados de carga y errores
- Toast notifications para feedback

**Motivos soportados:**
- 01: Error en la emisión
- 02: Contabilización errónea
- 03: Devolución total del bien o servicio
- 04: Devolución parcial del bien o servicio
- 05: Acuerdo entre las partes

### 3. `anulaciones-list.tsx` - Panel de anulaciones
**Ubicación:** `client/src/components/anulaciones-list.tsx`

Componente de vista completa para gestionar anulaciones con:

**Características:**
- **Tab Pendientes:**
  - Lista de anulaciones en estado pendiente/procesando
  - Contador de intentos fallidos (máx 10)
  - Botón para procesar manualmente todas las pendientes
  - Estado en tiempo real con auto-refresh

- **Tab Histórico:**
  - Lista de anulaciones completadas/con error
  - Muestra sello de anulación (primeros 8 caracteres)
  - Historial ordenado por fecha descendente

- **Panel de estado:**
  - 4 badges con contador de anulaciones por estado
  - Pendiente (naranja), Procesando (azul), Aceptado (verde), Error (rojo)

- **Funcionalidades:**
  - Refresh manual de datos
  - Auto-refresh configurable (5s pendientes, 10s histórico)
  - Indicadores visuales por estado
  - Esqueletos de carga para UX mejorada

## Integración en Historial de Facturas

### Cambios en `client/src/pages/historial.tsx`:

1. **Nuevo botón "Ver Anulaciones"**
   - Toggle para mostrar/ocultar panel de anulaciones
   - Ubicación: Barra superior de herramientas
   - Al lado de botones de exportación

2. **Botón "Anular" en tabla de facturas**
   - Solo visible para facturas transmitidas/selladas
   - Icono de prohibición (Ban) en color rojo
   - Abre modal de anulación con datos pre-cargados

3. **Validaciones inteligentes:**
   - Previene anulación de facturas ya anuladas
   - Previene anulación de borradores no transmitidos
   - Muestra toasts informativos para casos de error

4. **Dialog de anulación integrado**
   - Modal completamente funcional para seleccionar motivo
   - Cierra automáticamente al completar anulación exitosa
   - Invalida queries de facturas y anulaciones

## Flujo de Usuario

### 1. Anular Factura Individual
```
Usuario en Historial
  ↓
Hace clic en botón "Anular" en fila de factura
  ↓
Se abre Modal de Anulación con datos pre-cargados
  ↓
Selecciona motivo de anulación (01-05)
  ↓
Hace clic en "Anular DTE"
  ↓
API procesa la anulación:
  - Si MH disponible: Inmediatamente aceptado (estado: aceptado)
  - Si MH no disponible: Encolado para procesamiento (estado: pendiente)
  ↓
Toast de confirmación
Modal cierra automáticamente
Historial se actualiza
```

### 2. Procesar Anulaciones Pendientes
```
Usuario en Historial
  ↓
Hace clic en "Ver Anulaciones"
  ↓
Panel se expande mostrando pendientes/histórico
  ↓
Hace clic en "Procesar Pendientes"
  ↓
API procesa cola:
  - Intenta procesar cada anulación (máx 10 reintentos)
  - Actualiza estado según respuesta del MH
  - Registra errores después de 10 intentos
  ↓
Panel se auto-actualiza en tiempo real (5s/10s)
```

## Tipos de Datos

```typescript
interface AnulacionPendiente {
  id: string;
  facturaId: string;
  codigoGeneracion: string;
  motivo: string; // 01-05
  estado: "pendiente" | "procesando" | "aceptado" | "error";
  intentosFallidos: number;
  createdAt: string;
}

interface AnulacionHistorico extends AnulacionPendiente {
  selloAnulacion?: string;
  respuestaMH?: any;
  usuarioAnuloId?: string;
}

interface AnularDTERequest {
  motivo: string; // 01-05
}

interface AnularDTEResponse {
  id: string;
  estado: string;
  message: string;
}
```

## Endpoints Utilizados

- **POST** `/api/facturas/{id}/invalidar` - Anular DTE individual
- **GET** `/api/anulaciones/pendientes` - Obtener anulaciones pendientes
- **GET** `/api/anulaciones/historico?limit=50` - Obtener histórico
- **POST** `/api/anulaciones/procesar` - Procesar anulaciones pendientes

## Estilos y Componentes UI

- Utiliza componentes Radix UI (Dialog, Select, Badge, Button, Tabs)
- Tailwind CSS para estilos consistentes
- Iconos de Lucide React (Ban, AlertCircle, CheckCircle2, Clock, RefreshCw, AlertTriangle)
- Paleta de colores:
  - Naranja para pendientes
  - Azul para procesando
  - Verde para aceptado
  - Rojo para error

## Estados de Carga y Error

- **Loading:** Esqueletos de carga en tablas
- **Error:** Toasts con descripción de error
- **Success:** Toasts verdes con confirmación
- **Pending:** Indicadores visuales con spinner animado

## Refetch y Sincronización

- Auto-refetch de pendientes cada 5 segundos (estado más crítico)
- Auto-refetch de histórico cada 10 segundos
- Manual refresh con botón dedicado
- Invalidación automática de queries al completar acciones

## Notas Técnicas

1. **Validación de motivo:** Forzada en API (motivos 01-05 según DGII)
2. **Reintentos:** Máximo 10 intentos por anulación
3. **Estados async:** 202 (Accepted) para operaciones encoladas, 200 para éxito inmediato
4. **Auditoria:** Cada anulación registra usuarioAnulo y timestamp
5. **Multi-tenant:** Aislamiento por tenantId en todas las queries

## Testing

Los componentes fueron compilados exitosamente con Vite y TypeScript.

## Commit

Todos los cambios fueron consolidados en:
- Commit: `a142345` 
- Mensaje: "feat: UI para anulaciones - hooks, componentes y integración en historial"
- Archivos: 4 modificados, 737 insertiones

## Próximas Mejoras Opcionales

1. Exportar histórico de anulaciones a CSV
2. Búsqueda/filtrado en panel de anulaciones
3. Detalles expandibles en tabla de anulaciones
4. Gráficas de anulaciones por motivo/período
5. Bulk anulation actions
