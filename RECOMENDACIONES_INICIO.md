# Recomendaciones Técnicas para Iniciar

## Entorno
- Node.js 18+ (recomendado 20). Si usas nvm: `nvm use 20` o `nvm use 18`.
- PNPM o NPM. El lock es npm, usa `npm install`.
- SO: Linux/macOS/WSL. (Probado en Ubuntu 24.04 devcontainer).
- Puertos: 5000 (backend+frontend con Vite proxy). Asegura que esté libre.

## Pasos iniciales
1) Clonar y ubicarse en proyecto: `cd FacturaXpress/FacturaExpress`.
2) Instalar dependencias: `npm install`.
3) Desarrollo: `npm run dev` (sirve API y frontend). Abre http://localhost:5000.
4) Producción/build: `npm run build` (compila client y server). Ejecutable en `dist/index.cjs`.
5) Lint opcional: `npx eslint .` (config en .eslintrc.json).

## Credenciales de prueba
- Usuario seed: `admin` / `admin` (crear con `POST /api/seed/usuario` si no existe).

## Endpoints clave
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Catálogos DGII: `GET /api/catalogos/all` y específicos.
- Validación DGII: `POST /api/validar-dte` (AJV + schema oficial).
- Facturas: `POST /api/facturas`, `GET /api/facturas`.

## Flujo de validación (frontend)
- Formulario Nueva Factura usa `useValidateDTE` para pre-validar contra DGII antes de crear.
- Catálogos en selects (departamento, tipo doc, condición, forma pago, unidad medida, tipo item).
- Botón muestra estados: Validando / Generando.

## Scripts npm
- `npm run dev` - modo desarrollo fullstack.
- `npm run build` - build client+server.

## Troubleshooting
- Puerta ocupada: libera 5000 o ajusta config.
- Si login falla tras reinicio, re-crear usuario seed.
- Warning PostCSS `from`: solo advertencia, no bloquea build.
- Si no ves cambios en UI, hacer hard refresh (Ctrl+Shift+R / Cmd+Shift+R).

## Deployment (resumen)
- Ejecutar `npm run build`.
- Servir `dist/index.cjs` con Node 18+ (ej: `node dist/index.cjs`).
- Servir estáticos en `dist/public` (ya los entrega el server Express del build).
