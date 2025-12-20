# Factura Electrónica El Salvador - Sistema DTE

## Overview

This is an electronic invoicing system (DTE - Documento Tributario Electrónico) for El Salvador, built to comply with DGII (Dirección General de Impuestos Internos) regulations. The application enables businesses to generate, manage, and export electronic invoices (facturas), credit notes (comprobantes de crédito fiscal), and other tax documents required by Salvadoran law.

The system provides a complete invoicing workflow including issuer (emisor) configuration, invoice creation with line items, tax calculations (13% IVA), PDF generation with QR codes, and invoice history management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Shadcn/ui (Radix primitives + Tailwind CSS)
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite

The frontend follows a page-based structure with shared components. Pages include Dashboard, Nueva Factura (new invoice), Historial (history), Emisor (issuer settings), and Configuración (system config). The UI supports light/dark themes with a professional healthcare-inspired design system.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with tsx for execution
- **API Pattern**: RESTful JSON API under `/api/*` prefix
- **PDF Generation**: jsPDF for invoice documents
- **QR Codes**: qrcode library for DTE validation codes

The server handles CRUD operations for invoices (facturas) and issuer data (emisor), with routes defined in `server/routes.ts`. Development uses Vite middleware for HMR; production serves static files from `dist/public`.

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Current Storage**: In-memory storage class (`MemStorage`) as default implementation
- **Database Ready**: Schema defined for PostgreSQL with Drizzle, migrations output to `./migrations`

Key entities include Users, Emisor (issuer business data), and Facturas (invoices with nested receptor, items, and totals).

### Validation Layer
- **Schema Validation**: Zod schemas for all data structures
- **Drizzle-Zod Integration**: Auto-generated insert schemas from database tables
- **Form Validation**: Zod resolvers integrated with React Hook Form

Schemas include emisorSchema, receptorSchema, itemFacturaSchema, and insertFacturaSchema covering El Salvador-specific requirements (NIT, NRC, departamentos, municipios).

## External Dependencies

### Database
- PostgreSQL (configured via `DATABASE_URL` environment variable)
- Drizzle Kit for schema migrations (`npm run db:push`)

### Third-Party Libraries
- **jsPDF**: Client-side PDF generation for invoice documents
- **qrcode**: QR code generation for DTE validation
- **date-fns**: Date formatting utilities
- **express-session** + **connect-pg-simple**: Session management (if authentication is added)

### El Salvador Tax System Specifics
- Document types: Factura (01), Comprobante de Crédito Fiscal (03), Nota de Crédito (05), Nota de Débito (06), etc.
- Tax calculation: 13% IVA
- Geographic codes: Departamentos and municipios of El Salvador
- Number formats: NIT (tax ID), NRC (tax registry number)
- Control number format: `DTE-{tipo}-{establecimiento}-{punto}-{correlativo}`

## Recent Changes (December 2025)

### New Features Added
1. **Notas de Crédito/Débito** (`/notas`): Forms to create credit/debit notes referencing existing invoices
2. **Reportes y Estadísticas** (`/reportes`): Dashboard with charts showing sales by month, top services, IVA accumulated, document type distribution
3. **Búsqueda Avanzada**: Advanced filtering in history page by date range, amount, status, and document type
4. **Exportación Masiva**: Export all filtered invoices as a single JSON file for backup or accountant
5. **Duplicar Factura**: One-click duplication of existing invoices to create new ones with same data
6. **Modo Offline**: Hook for saving drafts to localStorage when connection issues occur (`use-offline-drafts.ts`)

### Pending Features
- **Email Integration**: The email sending feature is prepared in the UI but requires a service integration (Resend, SendGrid, or similar). User dismissed integration setup - when ready, configure email service and implement `/api/facturas/:id/email` endpoint.

## Key Files

### Pages
- `client/src/pages/dashboard.tsx` - Main dashboard with statistics
- `client/src/pages/nueva-factura.tsx` - Invoice creation form with preview
- `client/src/pages/nota-credito-debito.tsx` - Credit/debit notes creation
- `client/src/pages/historial.tsx` - Invoice history with advanced search
- `client/src/pages/reportes.tsx` - Reports and charts
- `client/src/pages/emisor.tsx` - Issuer configuration
- `client/src/pages/configuracion.tsx` - System settings

### Hooks
- `client/src/hooks/use-offline-drafts.ts` - Offline draft management with localStorage