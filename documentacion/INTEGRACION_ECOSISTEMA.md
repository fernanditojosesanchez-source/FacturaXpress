# Estrategia de Integración Ecosistema FS Digital
**FacturaXpress + SIGMA (Clinic/Hospital/Lab)**

Este documento define la arquitectura de integración para unificar FacturaXpress con el resto del ecosistema de salud.

## 1. Visión Unificada
El objetivo es que **FacturaXpress** funcione como el **motor fiscal centralizado** para todas las plataformas clínicas. Ningún módulo clínico (Consulta, Hospitalización, Lab) debe implementar lógica de facturación electrónica directa; deben delegarla a FacturaXpress.

## 2. Arquitectura de Servicios

### 2.1 Flujo de Datos
```mermaid
graph LR
    SIGMA[SIGMA Clinic/Hosp] -->|Solicitud Factura (JSON)| FX[FacturaXpress API]
    SIGLA[SIGMA Lab] -->|Solicitud Factura (JSON)| FX
    FX -->|DTE Firmado| MH[Ministerio Hacienda]
    MH -->|Sello/Rechazo| FX
    FX -->|Estado + PDF| SIGMA
    FX -->|Estado + PDF| SIGLA
```

### 2.2 Entidades Compartidas
Para evitar duplicidad, se propone la siguiente estrategia de sincronización:

*   **Pacientes (Receptores):**
    *   **Maestro:** SIGMA (Tabla `patients`).
    *   **Sincronización:** Cuando se crea/actualiza un paciente en SIGMA que requiere facturación, SIGMA envía los datos fiscales al endpoint `POST /api/receptores` de FacturaXpress (o FacturaXpress consulta a SIGMA si se implementa federación).
    *   **Validación:** FacturaXpress valida NIT/DUI/NRC antes de aceptar el registro.

*   **Servicios/Productos (Items):**
    *   **Maestro:** SIGMA (Catálogo de servicios médicos) / SIGLA (Catálogo de exámenes).
    *   **Mapeo:** Cada servicio en SIGMA debe tener asignado un `tipoItem` (Bien/Servicio) y códigos de tributo asociados para que FacturaXpress sepa cómo procesarlo.

## 3. Definición de Interfaz (API Contrato)

### 3.1 Emitir Factura desde SIGMA
**Endpoint:** `POST /api/facturas` (En FacturaXpress)
**Header:** `x-tenant-id: <id-clinica>`
**Body (Simplificado):**
```json
{
  "receptor": {
    "nombre": "Juan Pérez",
    "numDocumento": "00000000-0",
    "tipoDocumento": "13",
    "correo": "juan@email.com"
  },
  "items": [
    {
      "descripcion": "Consulta General",
      "cantidad": 1,
      "precio": 35.00,
      "tipo": "servicio"
    }
  ],
  "referenciaExterna": "CONSULTA-10234" 
}
```

### 3.2 Webhooks (Notificaciones)
FacturaXpress notificará a SIGMA cuando el estado del DTE cambie.
**Evento:** `dte.processed`
**Payload:**
```json
{
  "referenciaExterna": "CONSULTA-10234",
  "codigoGeneracion": "DTE-...",
  "sello": "...",
  "pdfUrl": "https://facturaxpress.../pdf/..."
}
```

## 4. Seguridad en la Integración
*   **Tokens API:** Generar API Keys de larga duración para los servidores de SIGMA y SIGLA, permitiendo autenticación `server-to-server` sin sesión de usuario.
*   **mTLS (Opcional):** Autenticación mutua TLS para máxima seguridad entre servidores internos.

## 5. Próximos Pasos Implementación
1.  Crear endpoint de generación de **API Keys** en FacturaXpress (`server/auth.ts`).
2.  Desarrollar módulo de cliente HTTP en SIGMA (Laravel/Node) para consumir FacturaXpress.
3.  Implementar tabla de mapeo de IDs (`external_id` <-> `factura_id`) en FacturaXpress.
