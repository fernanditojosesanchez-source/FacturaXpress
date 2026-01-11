# Guía de Integración Técnica: FacturaXpress para Ecosistema SIGMA

**Versión API:** v1.0
**Estado:** Live / Pruebas
**Destinatario:** Equipo de Desarrollo SIGMA (Clinic, Hospital, Lab)

## 1. Introducción
FacturaXpress actúa como el motor fiscal centralizado. SIGMA debe delegar la emisión de DTEs (Documentos Tributarios Electrónicos) a esta API. **SIGMA NO debe firmar ni conectar con Hacienda directamente.**

## 2. Autenticación (Server-to-Server)
La comunicación entre servidores no usa cookies ni usuarios. Usa **API Keys**.

*   **Header Requerido:** `x-api-key: fx_live_xxxxxxxxxxxxxxxxxxxx`
*   **Obtención:** Solicitar la generación de una llave para el entorno correspondiente (Staging/Prod) al administrador de FacturaXpress.

## 3. Flujos de Trabajo

### 3.1 Emisión de Factura (El caso más común)
Cuando un médico finaliza una consulta y cobra.

**Endpoint:** `POST /api/facturas`
**Content-Type:** `application/json`

**Cuerpo del Request (Ejemplo Mínimo):**
```json
{
  "externalId": "CONSULTA-10293", 
  "tipoDte": "01", 
  "receptor": {
    "nombre": "Juan Pérez",
    "numDocumento": "12345678-9",
    "tipoDocumento": "13", // 13=DUI, 36=NIT
    "correo": "cliente@email.com", // Opcional: FX enviará el correo si se incluye
    "direccion": {
      "departamento": "06", // Ver catálogo de departamentos
      "municipio": "14",    // Ver catálogo de municipios
      "complemento": "Col. Médica..."
    }
  },
  "cuerpoDocumento": [
    {
      "numItem": 1,
      "tipoItem": "2", // 1=Bien, 2=Servicio
      "cantidad": 1,
      "descripcion": "Consulta General",
      "precioUni": 35.00,
      "ventaGravada": 35.00
    }
  ],
  "resumen": {
    "condicionOperacion": "1", // 1=Contado
    "totalPagar": 35.00
  }
}
```

**Respuesta Exitosa (201 Created):**
```json
{
  "id": "uuid-interno-fx",
  "codigoGeneracion": "D04E...",
  "numeroControl": "DTE-01-...",
  "selloRecibido": "2026...",
  "estado": "sellada" // O "generada" si está en cola
}
```

### 3.2 Obtener PDF de Factura
Para que SIGMA muestre el botón "Imprimir Factura".

**Endpoint:** `GET /api/facturas/{id_factura}/pdf`
**Respuesta:** Archivo binario (application/pdf).

### 3.3 Catálogos
SIGMA debería cachear estos valores, pero puede consultarlos en tiempo real.

*   `GET /api/catalogos/departamentos`
*   `GET /api/catalogos/actividades-economicas`

## 4. Manejo de Errores y Contingencias

*   **401 Unauthorized:** API Key inválida.
*   **400 Bad Request:** Datos faltantes (ej. falta DUI del cliente). El cuerpo de respuesta indicará exactamente qué campo falló la validación.
*   **500 Internal Error:** Fallo en conexión con Hacienda.
    *   *Estrategia:* FacturaXpress guardará la factura en estado `borrador` o `generada` y reintentará automáticamente. SIGMA recibirá el ID y podrá consultar el estado después.

## 5. Webhooks (Próximamente)
FacturaXpress notificará a la URL configurada en SIGMA cuando un DTE cambie de estado (ej. de "Procesando" a "Sellada").

---
**Soporte:** Para dudas técnicas, contactar a Fher (Arquitecto de Sistema).
