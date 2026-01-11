# Design Guidelines: Sistema de Gestión de Clínica con Facturación Electrónica

## Design Approach

**Selected System:** Material Design with Healthcare Professional Aesthetics
**Justification:** Medical management systems require clear information hierarchy, data density, and professional credibility. Material Design provides robust patterns for forms, tables, and data visualization while maintaining accessibility standards crucial for healthcare environments.

## Core Design Principles

1. **Clinical Professionalism** - Clean, trustworthy interface that inspires confidence in medical and financial data handling
2. **Efficiency First** - Streamlined workflows for rapid patient registration, consultation logging, and invoice generation
3. **Data Clarity** - Information hierarchy that makes critical medical and billing data immediately scannable
4. **Bilingual Consideration** - Design accommodates Spanish text lengths and medical terminology

## Typography

**Font Families:**
- Primary: Inter (via Google Fonts CDN) - for UI elements, data tables, forms
- Secondary: System UI fallback for optimal performance

**Hierarchy:**
- Page Headers: text-2xl font-semibold (clinic sections)
- Section Headers: text-xl font-medium (patient info, invoice details)
- Subsections: text-lg font-medium (form labels, table headers)
- Body Text: text-base font-normal (form inputs, patient data)
- Small Text: text-sm (metadata, timestamps, secondary info)
- Micro Text: text-xs (helper text, disclaimers)

## Layout System

**Spacing Units:** Tailwind units of 2, 4, 6, and 8 for consistent rhythm
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Form field gaps: gap-4
- Card padding: p-6
- Page margins: px-6 md:px-8 lg:px-12

**Grid Structure:**
- Main content: max-w-7xl mx-auto
- Forms: max-w-4xl (optimal for data entry)
- Invoice preview: max-w-5xl
- Sidebar navigation: w-64 (fixed)

## Component Library

### Navigation
- **Sidebar:** Fixed left navigation with icon + text menu items
  - Sections: Dashboard, Pacientes, Consultas, Facturación, Inventario, Reportes
  - Active state with subtle indicator
  - Collapsible on mobile (hamburger menu)
  
- **Top Bar:** Clinic name/logo, user profile, notifications, search

### Core UI Elements

**Cards:**
- Elevated cards with subtle shadow (shadow-sm)
- Rounded corners (rounded-lg)
- Clear section divisions within cards
- Use for: patient summaries, invoice previews, statistics widgets

**Forms:**
- Two-column layout for desktop (grid-cols-1 md:grid-cols-2)
- Single column for invoice line items
- Label above input pattern
- Required field indicators (asterisk)
- Inline validation messages
- Clear submit/cancel buttons

**Tables:**
- Zebra striping for data rows (alternate row treatment)
- Sticky headers for long lists
- Sortable columns with indicators
- Actions column (right-aligned)
- Responsive: cards on mobile, table on desktop
- Use for: patient lists, invoice history, service catalogs

**Buttons:**
- Primary: Solid, full corners (rounded-md), font-medium
- Secondary: Outlined variant
- Danger: For delete/cancel actions
- Icon buttons: For table actions
- Sizes: btn-sm for inline, btn-md for forms, btn-lg for primary actions

### Facturación Module Specific

**Invoice Builder:**
- Split layout: Form (left 60%) | Preview (right 40%)
- Sticky preview that updates in real-time
- Add item button with modal/inline form
- Item table with quantity, price, IVA calculation
- Totals panel: Subtotal, IVA (13%), Total clearly displayed
- DGII required fields prominently labeled

**Invoice Display:**
- Header: DTE logo/seal area, invoice number, date
- Emisor/Receptor in two columns
- Line items table
- Totals summary (right-aligned)
- Footer: QR code (left), legal text (center), digital signature info (right)
- Download JSON and PDF buttons

**Patient-Invoice Link:**
- Quick invoice generation from patient record
- Recent invoices in patient profile
- Auto-populate patient data into receptor fields

### Data Displays

**Dashboard Widgets:**
- Statistics cards: Today's patients, pending invoices, revenue
- Recent activity list
- Quick actions panel
- Layout: 3-column grid on desktop (grid-cols-1 md:grid-cols-3)

**Patient Records:**
- Tab navigation: Información General, Historial, Facturas
- Timeline view for medical history
- Attached documents section

### Overlays

**Modals:**
- Centered overlay with backdrop blur
- Clear close button (X in top-right)
- Title + content + action buttons
- Use for: confirmations, quick add forms, invoice details

**Toasts/Notifications:**
- Top-right positioned
- Auto-dismiss (5 seconds)
- Icon + message + close button
- Types: Success (invoice sent), Error (validation), Info (saving)

## Animations

**Minimal Motion:**
- Page transitions: None (instant)
- Modal appearance: Subtle fade-in (150ms)
- Form validation: Shake on error (300ms)
- Loading states: Spinner only, no skeleton screens
- Hover states: Subtle background change only

## Accessibility

- Semantic HTML throughout
- ARIA labels for icon-only buttons
- Keyboard navigation support
- Focus indicators on all interactive elements
- Sufficient contrast ratios (WCAG AA minimum)
- Form error announcements
- Screen reader friendly table structures

## Key Patterns

**Workflow Optimization:**
- Breadcrumb navigation for deep pages
- Autosave drafts for invoices
- Keyboard shortcuts for common actions
- Batch operations for multiple invoices
- Quick patient search (Ctrl+K pattern)

**DGII Compliance Visual Cues:**
- Required DGII fields marked distinctly
- Format validations (NIT, DUI) with inline feedback
- JSON preview with syntax highlighting
- Sello de Recepción display when received
- Status badges: Pendiente, Transmitida, Sellada, Anulada

## Images

No hero images needed. This is a utility application where:
- Clinic logo appears in top navigation (small, 120x40px recommended)
- Patient photos optional in profile (thumbnail size)
- DGII/El Salvador official seals in invoice footer (small icons)
- QR codes generated dynamically for invoices
- Empty states: Simple illustrations for "No patients found", "No invoices yet"