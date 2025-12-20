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
- Document types: Factura (01), Comprobante de Crédito Fiscal (03), etc.
- Tax calculation: 13% IVA
- Geographic codes: Departamentos and municipios of El Salvador
- Number formats: NIT (tax ID), NRC (tax registry number)
- Control number format: `DTE-{tipo}-{establecimiento}-{punto}-{correlativo}`