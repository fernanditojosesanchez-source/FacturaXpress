# 🚀 FacturaXpress - Plataforma de Facturación Electrónica

**Estado del Proyecto:** ✅ **Activo** | **Versión:** 1.0.0 | **Última Actualización:** 2026-01-14

---

## 🎯 Resumen Ejecutivo

**FacturaXpress** es una plataforma de facturación electrónica diseñada para simplificar la emisión, recepción y validación de Documentos Tributarios Electrónicos (DTE) en cumplimiento con las normativas de la DGII.

La plataforma está construida con un stack moderno y seguro, utilizando **React** y **TypeScript** en el frontend, y **Node.js/Express** en el backend, con **Supabase/PostgreSQL** como base de datos.

### ✨ **NUEVO: Arquitectura de Seguridad con Supabase Vault**

Todos los datos sensibles, como **certificados digitales, contraseñas y credenciales**, ahora se almacenan de forma segura utilizando **Supabase Vault**, una solución de gestión de secretos de nivel empresarial.

**Características Clave de Seguridad:**
- ✅ **Encriptación Industrial:** XChaCha20Poly1305 (libsodium).
- ✅ **Claves Gestionadas por Supabase:** Las claves de encriptación nunca son accesibles para la aplicación.
- ✅ **Auditoría Completa:** Cada acceso a un secreto es registrado (quién, qué, cuándo, desde dónde).
- ✅ **Aislamiento de Tenants:** Cada cliente solo puede acceder a sus propios secretos.
- ✅ **Cero Texto Plano:** Los secretos nunca se almacenan sin encriptar en la base de datos, backups o logs.

> Para más detalles, consulta la **[Política de Seguridad de Vault](VAULT_SECURITY_POLICY.md)**.

---

## 🚀 Quick Start para Desarrolladores

### 1. **Requisitos Previos**
- Node.js (v18+)
- npm/pnpm/yarn
- Supabase CLI (para gestión de base de datos local)
- Un proyecto de Supabase configurado.

### 2. **Instalación**

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd FacturaXpress

# 2. Instalar dependencias
npm install
```

### 3. **Configuración del Entorno**

Crea un archivo `.env` en la raíz del proyecto a partir de `.env.example` y completa las variables:

```env
# Supabase
SUPABASE_URL="https://<project_ref>.supabase.co"
SUPABASE_ANON_KEY="<your_anon_key>"
DATABASE_URL="postgresql://postgres:<your_db_password>@db.<project_ref>.supabase.co:5432/postgres"

# Aplicación
PORT=5000
ENCRYPTION_KEY="<una_clave_segura_de_32_caracteres>" # Para encriptación legacy
ADMIN_PASSWORD="<contraseña_para_el_super_admin>"
```

### 4. **Ejecutar la Aplicación (Modo Desarrollo)**

```bash
# Inicia el servidor de desarrollo (backend y frontend con Vite)
npm run dev
```
La aplicación estará disponible en `http://localhost:5000`.

### 5. **Probar la Implementación de Vault**

Para verificar que la integración con Supabase Vault funciona correctamente, ejecuta el script de testing:

```bash
# Este script realiza 9 pruebas de integración con Vault
npx ts-node scripts/test-vault.ts
```

**Salida esperada:**
```
✅ TODOS LOS TESTS PASARON (9/9 - 100%)
```

---

## 📚 Documentación Esencial

Para ponerte al día rápidamente, revisa los siguientes documentos en orden:

1. **[VAULT_QUICK_START.md](VAULT_QUICK_START.md)** (5 min)
   - **Para desarrolladores.** Cómo usar la nueva API de Vault para guardar y leer secretos.

2. **[VAULT_SECURITY_POLICY.md](VAULT_SECURITY_POLICY.md)** (10 min)
   - **Para todos.** Las reglas de oro de seguridad. Qué se debe y qué no se debe hacer.

3. **[documentacion/DOCUMENTATION_INDEX.md](documentacion/DOCUMENTATION_INDEX.md)**
   - **Índice principal.** Enlaces a toda la documentación técnica del proyecto.

---

## 🗂️ Estructura del Proyecto

```
.
├── client/         # Frontend en React + TypeScript
├── server/         # Backend en Express.js
│   ├── lib/
│   │   └── vault.ts  # 🔐 Servicio centralizado de Vault
│   ├── routes/
│   │   └── certificados.ts # Endpoints de ejemplo para Vault
│   └── storage.ts    # Capa de abstracción de datos (con integración de Vault)
├── scripts/
│   └── test-vault.ts # 🧪 Script de prueba de Vault
├── VAULT_*.md      # 📄 Documentación de la arquitectura de seguridad
└── ...
```

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, sigue las guías de estilo y seguridad del proyecto. Antes de implementar una nueva característica que maneje datos sensibles, consulta la **[Política de Seguridad de Vault](VAULT_SECURITY_POLICY.md)**.
