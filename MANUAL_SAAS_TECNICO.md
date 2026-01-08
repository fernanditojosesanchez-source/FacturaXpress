# Manual Técnico: Sistema SaaS FacturaXpress

Este documento detalla la arquitectura, seguridad y flujos operativos del sistema de facturación electrónica Multi-tenant **FacturaXpress**, diseñado para escalar desde una pequeña clínica hasta miles de comercios (ferreterías, tiendas, laboratorios).

## 1. Arquitectura Multi-tenant (SaaS)

El sistema ya no es una aplicación monolítica simple. Se ha transformado en una plataforma donde múltiples empresas ("Tenants") coexisten en la misma infraestructura pero con aislamiento total de datos.

### Modelo de Datos
El aislamiento se logra mediante la columna `tenant_id` en todas las tablas críticas:

*   **`tenants`**: La tabla maestra. Cada registro es una empresa cliente (ej. "Clínica San Benito", "Ferretería El Clavo").
*   **`users`**: Los usuarios pertenecen a un Tenant.
*   **`facturas`**: Cada documento tributario está ligado a un Tenant.
*   **`emisor`**: Configuración fiscal propia de cada Tenant.

### Seguridad y Aislamiento
*   **Middleware `requireAuth`**: Intercepta cada petición, identifica al usuario y su `tenant_id`, y lo inyecta en el contexto.
*   **Storage Layer**: Todas las consultas a la base de datos filtran automáticamente por `tenant_id`. Es imposible que el Tenant A vea datos del Tenant B.

## 2. Sistema de Firma Digital (Node.js Nativo)

Hemos eliminado la dependencia del contenedor Docker oficial de Hacienda (`svfe-firmador`) para permitir una escalabilidad real.

*   **Tecnología**: Usamos `node-forge` y criptografía nativa de Node.js.
*   **Ventaja**: Permite "Hot-Swapping" de certificados. El servidor puede firmar una factura de la Clínica A y milisegundos después una de la Ferretería B sin reiniciar ni reconfigurar nada.
*   **Estándar**: Implementación completa de JWS (JSON Web Signature) según la normativa técnica del MH.

## 3. Custodia Segura de Credenciales (Grado Bancario)

Como proveedor SaaS, somos custodios de la identidad digital de nuestros clientes.

*   **Almacenamiento**: Los archivos `.p12` (certificados) **NO** se guardan en carpetas. Se almacenan en la base de datos (PostgreSQL).
*   **Encriptación**: Antes de guardar, el certificado se cifra con **AES-256-CBC** usando una llave maestra (`ENCRYPTION_KEY`) que solo vive en la memoria del servidor.
*   **Uso Efímero**: Al momento de firmar, el sistema desencripta el certificado en memoria RAM, firma el JSON y destruye la copia desencriptada inmediatamente.

## 4. Roles y Permisos (RBAC)

El sistema implementa una jerarquía de 4 niveles para operar en tiendas reales:

1.  **Super Admin (`super_admin`)**: Dueño de la plataforma (Fher). Ve el panel `/admin`.
2.  **Tenant Admin (`tenant_admin`)**: Dueño del negocio (Ferretero). Acceso total a su tienda.
3.  **Manager (`manager`)**: Gerente. Puede ver reportes y emitir notas de crédito.
4.  **Cajero (`cashier`)**: Operativo. Solo factura y ve historial. Bloqueado de reportes y configuración.

## 5. Panel de Super Administrador

Se ha creado una interfaz exclusiva para el dueño de la plataforma (Fher / FS Digital).

*   **Ruta**: `/admin` (Protegida, requiere rol `super_admin`).
*   **Funciones**:
    *   **Alta de Empresas**: Crear nuevos inquilinos con un solo clic.
    *   **Gestión de Credenciales**: Subir los certificados `.p12` y contraseñas de Hacienda de cada cliente desde la web.
    *   **Monitoreo**: Ver el estado de todas las empresas registradas.

## 6. Escalabilidad Comercial

Esta arquitectura permite dos modelos de negocio simultáneos:

1.  **FS Digital (Ecosistema Salud):**
    *   Integración transparente vía API para SIGMA Clinic y Hospital.
    *   Facturación automática sin intervención del médico.

2.  **FacturaXpress Retail (Producto Masivo):**
    *   Venta de suscripciones a PYMES (Ferreterías, Abogados, Tiendas).
    *   Cada cliente tiene su propio acceso, logo y facturación independiente.