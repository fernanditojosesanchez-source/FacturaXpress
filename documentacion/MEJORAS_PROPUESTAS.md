ríticas (Implementar en 1-2 semanas)
Seguridad de contraseñas: Actualmente las credenciales están sin hash. Implementar bcrypt para almacenar contraseñas con salt, agregar validación de fuerza de contraseña y mecanismo de reset seguro. Esto es urgente antes de cualquier despliegue.

Rate limiting: Proteger endpoints críticos especialmente login con express-rate-limit para prevenir ataques de fuerza bruta. Configurar 5 intentos por 15 minutos en autenticación y 100 requests por 15 minutos en API general.

Persistencia de datos: El sistema usa MemoryStore que pierde todo al reiniciar. Migrar a PostgreSQL para producción con Drizzle ORM que ya está configurado, manteniendo las sesiones en connect-pg-simple.

Validación duplicados: Validar NIT/código de generación únicos antes de crear facturas para evitar duplicados y conflictos con el MH.

Productividad inmediata (1-2 semanas)
Catálogo de productos: Crear tabla de productos con código, descripción, precio base, unidad de medida y tipo de ítem. Agregar autocomplete en el formulario de factura que rellene automáticamente precio y unidad al seleccionar producto. Incluir importador CSV para carga masiva.

Catálogo de clientes: Similar a productos pero con NIT, nombre, dirección y datos de contacto. Implementar búsqueda rápida por nombre o documento y mostrar historial de facturas por cliente.

Atajos de teclado: Agregar Ctrl+N para nueva factura, Ctrl+H para historial, Ctrl+S para guardar y Escape para cancelar. Mejora dramáticamente la velocidad de uso.

Confirmaciones globales: Usar AlertDialog de Radix UI en todas las operaciones destructivas con mensajes específicos según la acción.

Experiencia de usuario (2-4 semanas)
Barra de progreso global: Implementar NProgress en la parte superior que se active durante mutations y queries largas. Dar feedback visual constante al usuario.

Notificaciones toast mejoradas: Sistema de notificaciones con undo para acciones reversibles, agrupación de múltiples notificaciones y persistencia de mensajes importantes.

Vista previa enriquecida: Mostrar nombres legibles de catálogos en lugar de códigos en la previsualización, incluir totales destacados y formato visual similar al PDF final.

Búsqueda avanzada: En historial agregar filtros por rango de montos con slider, multi-select de estados, búsqueda full-text en observaciones y guardado de vistas de filtros en localStorage.

Integración MH (4-6 semanas)
Certificado digital: Integrar node-forge o jsrsasign para firma PKCS#7 del DTE. Crear endpoint POST /api/dte/firmar que acepte el DTE validado y retorne el documento firmado digitalmente.

Transmisión real: Implementar cliente HTTP para API del MH con retry automático, manejo de timeouts y almacenamiento del sello recibido. Crear cola con Bull y Redis para transmisiones asíncronas.

Notificaciones email: Configurar Nodemailer con template HTML que incluya logo del emisor, resumen de factura, botón para ver PDF y envío automático post-transmisión exitosa.

Performance y escalabilidad (6-8 semanas)
Lazy loading: Aplicar React.lazy() en rutas pesadas como reportes e historial. Implementar suspense boundaries con skeletons apropiados.

Virtualización: Para tablas con más de 100 registros usar react-virtual. Crítico cuando el historial crezca a miles de facturas.

Paginación server-side: Implementar limit/offset en backend para facturas y catálogos grandes, con cursor pagination para mejor UX.

Índices de base de datos: Crear índices en codigoGeneracion, numDocumento del receptor, fechaEmision y estado para queries rápidas.

Modo offline PWA: Configurar Vite PWA con service worker que cachee assets estáticos, datos de productos/clientes y facturas recientes. Sincronizar cuando vuelva conexión.

