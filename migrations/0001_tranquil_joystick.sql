CREATE TABLE "anulaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"factura_id" text NOT NULL,
	"codigo_generacion" text NOT NULL,
	"motivo" text NOT NULL,
	"observaciones" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"sello_anulacion" text,
	"jws_firmado" text,
	"respuesta_mh" jsonb,
	"usuario_anulo" varchar,
	"fecha_anulo" timestamp DEFAULT now() NOT NULL,
	"fecha_proceso" timestamp,
	"ultimo_error" text,
	"intentos_fallidos" integer DEFAULT 0,
	CONSTRAINT "anulaciones_tenant_id_codigo_generacion_unique" UNIQUE("tenant_id","codigo_generacion")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"action" text NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"archivo" text NOT NULL,
	"huella" text NOT NULL,
	"algoritmo" text DEFAULT 'RSA',
	"emisor" text,
	"sujeto" text,
	"valido_desde" timestamp,
	"valido_hasta" timestamp,
	"dias_para_expiracion" integer,
	"contrasena_enc" text,
	"estado" text DEFAULT 'pendiente',
	"activo" boolean DEFAULT false,
	"es_productivo" boolean DEFAULT false,
	"certificado_valido" boolean DEFAULT false,
	"ultima_validacion" timestamp,
	"errores_validacion" jsonb,
	"url_descarga" text,
	"creado_por" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificados_tenant_id_huella_unique" UNIQUE("tenant_id","huella")
);
--> statement-breakpoint
CREATE TABLE "contingencia_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"factura_id" text NOT NULL,
	"codigo_generacion" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"intentos_fallidos" integer DEFAULT 0,
	"ultimo_error" text,
	"fecha_ingreso" timestamp DEFAULT now() NOT NULL,
	"fecha_intento" timestamp,
	"fecha_completado" timestamp,
	CONSTRAINT "contingencia_queue_tenant_id_codigo_generacion_unique" UNIQUE("tenant_id","codigo_generacion")
);
--> statement-breakpoint
CREATE TABLE "factura_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"factura_id" text,
	"num_item" integer NOT NULL,
	"tipo_item" text NOT NULL,
	"cantidad" numeric(12, 6) NOT NULL,
	"codigo" text,
	"descripcion" text NOT NULL,
	"precio_uni" numeric(12, 6) NOT NULL,
	"venta_no_suj" numeric(12, 2) DEFAULT '0' NOT NULL,
	"venta_exenta" numeric(12, 2) DEFAULT '0' NOT NULL,
	"venta_gravada" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tributos" jsonb,
	"iva_item" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"ip_address" text NOT NULL,
	"success" boolean NOT NULL,
	"user_agent" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mh_catalogos" (
	"id" serial PRIMARY KEY NOT NULL,
	"catalogo" text NOT NULL,
	"codigo" text NOT NULL,
	"valor" text NOT NULL,
	"padre" text,
	"activo" boolean DEFAULT true,
	CONSTRAINT "mh_catalogos_catalogo_codigo_unique" UNIQUE("catalogo","codigo")
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"recipient" text NOT NULL,
	"name" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"last_used_at" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid,
	"type" text NOT NULL,
	"recipient" text NOT NULL,
	"status" text NOT NULL,
	"message_id" text,
	"error" text,
	"retries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"aggregate_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"error" text,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"codigo" text,
	"nombre" text NOT NULL,
	"descripcion" text,
	"precio_unitario" numeric(12, 6) NOT NULL,
	"uni_medida" integer DEFAULT 20 NOT NULL,
	"tipo_item" text DEFAULT '2' NOT NULL,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"tipo_documento" text NOT NULL,
	"num_documento" text NOT NULL,
	"nombre" text NOT NULL,
	"nrc" text,
	"cod_actividad" text,
	"desc_actividad" text,
	"direccion" jsonb NOT NULL,
	"telefono" text,
	"correo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "receptores_tenant_id_num_documento_unique" UNIQUE("tenant_id","num_documento")
);
--> statement-breakpoint
CREATE TABLE "tenant_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mh_usuario" text,
	"mh_pass_enc" text NOT NULL,
	"cert_p12_enc" text NOT NULL,
	"cert_pass_enc" text NOT NULL,
	"ambiente" text DEFAULT 'pruebas',
	"valido_desde" timestamp,
	"valido_hasta" timestamp,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"tipo" text DEFAULT 'clinic',
	"estado" text DEFAULT 'activo',
	"origen" text,
	"modules" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "secuencial_control" DROP CONSTRAINT "secuencial_control_emisor_nit_tipo_dte_unique";--> statement-breakpoint
ALTER TABLE "facturas" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "emisor" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "estado" text DEFAULT 'borrador' NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "codigo_generacion" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "sello_recibido" text;--> statement-breakpoint
ALTER TABLE "secuencial_control" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nombre" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'cashier' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sucursales_asignadas" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "modulos_habilitados" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telefono" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_locked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lock_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activo" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ultimo_acceso" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_usuario_anulo_users_id_fk" FOREIGN KEY ("usuario_anulo") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contingencia_queue" ADD CONSTRAINT "contingencia_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contingencia_queue" ADD CONSTRAINT "contingencia_queue_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura_items" ADD CONSTRAINT "factura_items_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptores" ADD CONSTRAINT "receptores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_credentials" ADD CONSTRAINT "tenant_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_certificados_tenantId" ON "certificados" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_certificados_estado" ON "certificados" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_certificados_activo" ON "certificados" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_certificados_tenant_activo" ON "certificados" USING btree ("tenant_id","activo");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_tenant_type" ON "notification_channels" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_tenant_enabled" ON "notification_channels" USING btree ("tenant_id","enabled");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_tenant_type" ON "notification_logs" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_tenant_status" ON "notification_logs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_created" ON "notification_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_status_available" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_tenant_status" ON "outbox_events" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_productos_tenantId" ON "productos" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_productos_codigo" ON "productos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "idx_productos_activo" ON "productos" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_productos_tenant_activo" ON "productos" USING btree ("tenant_id","activo");--> statement-breakpoint
CREATE INDEX "idx_receptores_tenantId" ON "receptores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_receptores_numDocumento" ON "receptores" USING btree ("num_documento");--> statement-breakpoint
CREATE INDEX "idx_receptores_tenant_numDoc" ON "receptores" USING btree ("tenant_id","num_documento");--> statement-breakpoint
ALTER TABLE "emisor" ADD CONSTRAINT "emisor_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secuencial_control" ADD CONSTRAINT "secuencial_control_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_facturas_tenantId" ON "facturas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_facturas_estado" ON "facturas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_facturas_fecEmi" ON "facturas" USING btree ("fec_emi");--> statement-breakpoint
CREATE INDEX "idx_facturas_tenant_estado" ON "facturas" USING btree ("tenant_id","estado");--> statement-breakpoint
CREATE INDEX "idx_users_tenant" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_activo" ON "users" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_users_tenant_role" ON "users" USING btree ("tenant_id","role");--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_codigo_generacion_unique" UNIQUE("codigo_generacion");--> statement-breakpoint
ALTER TABLE "secuencial_control" ADD CONSTRAINT "secuencial_control_tenant_id_emisor_nit_tipo_dte_unique" UNIQUE("tenant_id","emisor_nit","tipo_dte");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");