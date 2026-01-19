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
CREATE TABLE "fx_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fx_api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "fx_audit_logs" (
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
CREATE TABLE "fx_contingencia_queue" (
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
	CONSTRAINT "fx_contingencia_queue_tenant_id_codigo_generacion_unique" UNIQUE("tenant_id","codigo_generacion")
);
--> statement-breakpoint
CREATE TABLE "emisor" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"data" jsonb NOT NULL
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
CREATE TABLE "facturas" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"external_id" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fec_emi" text NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"codigo_generacion" text,
	"sello_recibido" text,
	CONSTRAINT "facturas_codigo_generacion_unique" UNIQUE("codigo_generacion")
);
--> statement-breakpoint
CREATE TABLE "fx_login_attempts" (
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
CREATE TABLE "secuencial_control" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"emisor_nit" text NOT NULL,
	"tipo_dte" text NOT NULL,
	"secuencial" integer DEFAULT 1 NOT NULL,
	"ultimo_numero_control" text,
	"fecha_creacion" timestamp DEFAULT now() NOT NULL,
	"fecha_actualizacion" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "secuencial_control_tenant_id_emisor_nit_tipo_dte_unique" UNIQUE("tenant_id","emisor_nit","tipo_dte")
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
CREATE TABLE "fx_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"username" text NOT NULL,
	"email" text,
	"nombre" text,
	"password" text NOT NULL,
	"role" text DEFAULT 'cashier' NOT NULL,
	"sucursales_asignadas" jsonb DEFAULT 'null'::jsonb,
	"modulos_habilitados" jsonb DEFAULT 'null'::jsonb,
	"telefono" text,
	"email_verified" boolean DEFAULT false,
	"account_locked" boolean DEFAULT false,
	"lock_until" timestamp,
	"activo" boolean DEFAULT true,
	"ultimo_acceso" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fx_users_username_unique" UNIQUE("username"),
	CONSTRAINT "fx_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "stock_transito_detalles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_transito_id" uuid NOT NULL,
	"lote" varchar(100),
	"numero_serie" varchar(100),
	"cantidad_enviada" integer NOT NULL,
	"cantidad_recibida" integer DEFAULT 0,
	"inspeccionado" boolean DEFAULT false,
	"fecha_inspeccion" timestamp,
	"estado_inspeccion" varchar(50),
	"observaciones_inspeccion" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transito_historial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_transito_id" uuid NOT NULL,
	"estado_anterior" varchar(50),
	"estado_nuevo" varchar(50) NOT NULL,
	"usuario_id" uuid NOT NULL,
	"nombre_usuario" varchar(255),
	"evento" varchar(100) NOT NULL,
	"ubicacion" varchar(255),
	"evidencia" jsonb,
	"observaciones" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transito" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"numero_movimiento" varchar(50) NOT NULL,
	"referencia" varchar(100),
	"sucursal_origen" varchar(50) NOT NULL,
	"sucursal_destino" varchar(50) NOT NULL,
	"producto_id" uuid NOT NULL,
	"codigo_producto" varchar(100) NOT NULL,
	"nombre_producto" varchar(255) NOT NULL,
	"cantidad_enviada" integer NOT NULL,
	"cantidad_recibida" integer DEFAULT 0,
	"cantidad_devuelta" integer DEFAULT 0,
	"estado" varchar(50) DEFAULT 'pendiente' NOT NULL,
	"fecha_envio" timestamp,
	"fecha_esperada_entrega" timestamp,
	"fecha_recepcion" timestamp,
	"transportista" varchar(100),
	"numero_guia" varchar(100),
	"costo_transporte" numeric(12, 2),
	"observaciones" text,
	"motivo_devolucion" text,
	"creado_por" uuid NOT NULL,
	"modificado_por" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sigma_support_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"support_user_id" uuid NOT NULL,
	"support_user_name" varchar(255) NOT NULL,
	"support_email" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_nombre" varchar(255) NOT NULL,
	"tipo_acceso" varchar(50) DEFAULT 'readonly' NOT NULL,
	"can_view_logs" boolean DEFAULT true,
	"can_view_metrics" boolean DEFAULT true,
	"can_view_audit" boolean DEFAULT true,
	"can_export_data" boolean DEFAULT false,
	"fecha_inicio" timestamp NOT NULL,
	"fecha_fin" timestamp,
	"activo" boolean DEFAULT true,
	"razon" varchar(255) NOT NULL,
	"otorgado_por" uuid NOT NULL,
	"revisado_por" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sigma_support_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"support_user_id" uuid NOT NULL,
	"support_user_name" varchar(255) NOT NULL,
	"accion" varchar(100) NOT NULL,
	"recurso" varchar(100) NOT NULL,
	"resource_id" uuid,
	"detalles" text,
	"exitoso" boolean DEFAULT true,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sigma_support_metricas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_nombre" varchar(255) NOT NULL,
	"metrica" varchar(100) NOT NULL,
	"valor" integer NOT NULL,
	"periodo" varchar(20) DEFAULT 'daily' NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"trending" varchar(10),
	"alerta" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sigma_support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero_ticket" varchar(50) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_nombre" varchar(255) NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descripcion" text NOT NULL,
	"categoria" varchar(50) NOT NULL,
	"severidad" varchar(20) DEFAULT 'normal' NOT NULL,
	"estado" varchar(50) DEFAULT 'abierto' NOT NULL,
	"asignado_a" uuid,
	"asignado_nombre" varchar(255),
	"solucion" text,
	"fecha_resolucion" timestamp,
	"creado_por" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	CONSTRAINT "sigma_support_tickets_numero_ticket_unique" UNIQUE("numero_ticket")
);
--> statement-breakpoint
CREATE TABLE "sigma_support_access_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_access_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"previous_expires_at" timestamp NOT NULL,
	"new_expires_at" timestamp NOT NULL,
	"extension_duration" integer NOT NULL,
	"reason" text NOT NULL,
	"approved_by" uuid NOT NULL,
	"approved_by_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sigma_support_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_by_name" varchar(255) NOT NULL,
	"requested_by_email" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_nombre" varchar(255) NOT NULL,
	"reason" text NOT NULL,
	"estimated_duration" integer DEFAULT 7200000 NOT NULL,
	"urgency" varchar(20) DEFAULT 'normal' NOT NULL,
	"scope_requested" jsonb DEFAULT '{"canViewLogs":true,"canViewMetrics":true,"canViewAudit":false,"canExportData":false}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_by_name" varchar(255),
	"reviewed_at" timestamp,
	"review_notes" text,
	"access_granted_id" uuid,
	"access_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sigma_support_jit_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"require_approval" boolean DEFAULT true NOT NULL,
	"auto_approve_for_urgency" varchar(20),
	"max_access_duration" integer DEFAULT 7200000 NOT NULL,
	"max_extensions" integer DEFAULT 2 NOT NULL,
	"request_expiration_time" integer DEFAULT 86400000 NOT NULL,
	"notify_admins_on_request" boolean DEFAULT true,
	"notify_admin_emails" text,
	"allowed_scopes" jsonb DEFAULT '{"canViewLogs":true,"canViewMetrics":true,"canViewAudit":false,"canExportData":false}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sigma_support_jit_policies_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "catalog_sync_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_name" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"recommendation" text,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"acknowledged_by" uuid,
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "catalog_sync_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_name" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"message" text,
	"old_record_count" integer,
	"new_record_count" integer,
	"changed_records" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"error" text,
	"stack_trace" text,
	"trigger_type" varchar(20) DEFAULT 'auto' NOT NULL,
	"triggered_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_name" varchar(50) NOT NULL,
	"version" varchar(20) NOT NULL,
	"description" text,
	"record_count" integer DEFAULT 0 NOT NULL,
	"last_sync_at" timestamp DEFAULT now() NOT NULL,
	"sync_status" varchar(20) DEFAULT 'success' NOT NULL,
	"sync_duration_ms" integer,
	"data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_hash" varchar(64),
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unq_catalog_name_version" UNIQUE("catalog_name","version")
);
--> statement-breakpoint
CREATE TABLE "feature_flag_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_id" uuid NOT NULL,
	"tenant_id" uuid,
	"user_id" varchar,
	"resultado" boolean NOT NULL,
	"estrategia_usada" text,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_id" uuid NOT NULL,
	"campo" text NOT NULL,
	"valor_anterior" text,
	"valor_nuevo" text,
	"modificado_por" varchar NOT NULL,
	"motivo" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"categoria" text DEFAULT 'feature',
	"habilitado" boolean DEFAULT false,
	"estrategia" text DEFAULT 'boolean' NOT NULL,
	"porcentaje_rollout" integer DEFAULT 0,
	"tenants_permitidos" jsonb DEFAULT '[]'::jsonb,
	"usuarios_permitidos" jsonb DEFAULT '[]'::jsonb,
	"configuracion" jsonb DEFAULT '{}'::jsonb,
	"inicio_automatico" timestamp,
	"fin_automatico" timestamp,
	"veces_consultado" integer DEFAULT 0,
	"veces_activado" integer DEFAULT 0,
	"veces_desactivado" integer DEFAULT 0,
	"ultima_consulta" timestamp,
	"creado_por" varchar,
	"modificado_por" varchar,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anulaciones" ADD CONSTRAINT "anulaciones_usuario_anulo_fx_users_id_fk" FOREIGN KEY ("usuario_anulo") REFERENCES "public"."fx_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_api_keys" ADD CONSTRAINT "fx_api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_audit_logs" ADD CONSTRAINT "fx_audit_logs_user_id_fx_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fx_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_creado_por_fx_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."fx_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_contingencia_queue" ADD CONSTRAINT "fx_contingencia_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_contingencia_queue" ADD CONSTRAINT "fx_contingencia_queue_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emisor" ADD CONSTRAINT "emisor_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factura_items" ADD CONSTRAINT "factura_items_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptores" ADD CONSTRAINT "receptores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secuencial_control" ADD CONSTRAINT "secuencial_control_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_credentials" ADD CONSTRAINT "tenant_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_users" ADD CONSTRAINT "fx_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transito_detalles" ADD CONSTRAINT "stock_transito_detalles_stock_transito_id_stock_transito_id_fk" FOREIGN KEY ("stock_transito_id") REFERENCES "public"."stock_transito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transito_historial" ADD CONSTRAINT "stock_transito_historial_stock_transito_id_stock_transito_id_fk" FOREIGN KEY ("stock_transito_id") REFERENCES "public"."stock_transito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flag_evaluations" ADD CONSTRAINT "feature_flag_evaluations_flag_id_feature_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flag_evaluations" ADD CONSTRAINT "feature_flag_evaluations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flag_history" ADD CONSTRAINT "feature_flag_history_flag_id_feature_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_certificados_tenantId" ON "certificados" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_certificados_estado" ON "certificados" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_certificados_activo" ON "certificados" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_certificados_tenant_activo" ON "certificados" USING btree ("tenant_id","activo");--> statement-breakpoint
CREATE INDEX "idx_facturas_tenantId" ON "facturas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_facturas_estado" ON "facturas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_facturas_fecEmi" ON "facturas" USING btree ("fec_emi");--> statement-breakpoint
CREATE INDEX "idx_facturas_tenant_estado" ON "facturas" USING btree ("tenant_id","estado");--> statement-breakpoint
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
CREATE INDEX "idx_users_tenant" ON "fx_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "fx_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_activo" ON "fx_users" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_users_tenant_role" ON "fx_users" USING btree ("tenant_id","role");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_detalles_padre" ON "stock_transito_detalles" USING btree ("stock_transito_id");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_detalles_lote" ON "stock_transito_detalles" USING btree ("lote");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_historial_padre" ON "stock_transito_historial" USING btree ("stock_transito_id");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_historial_evento" ON "stock_transito_historial" USING btree ("evento");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_historial_fecha" ON "stock_transito_historial" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_tenant" ON "stock_transito" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_estado" ON "stock_transito" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_numero" ON "stock_transito" USING btree ("numero_movimiento");--> statement-breakpoint
CREATE INDEX "idx_stock_transito_origen_destino" ON "stock_transito" USING btree ("sucursal_origen","sucursal_destino");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_access_user" ON "sigma_support_access" USING btree ("support_user_id");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_access_tenant" ON "sigma_support_access" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_access_active" ON "sigma_support_access" USING btree ("activo","fecha_fin");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_logs_user" ON "sigma_support_logs" USING btree ("support_user_id");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_logs_accion" ON "sigma_support_logs" USING btree ("accion");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_logs_fecha" ON "sigma_support_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_metricas_tenant" ON "sigma_support_metricas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_metricas_tipo" ON "sigma_support_metricas" USING btree ("metrica");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_metricas_fecha" ON "sigma_support_metricas" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_tickets_tenant" ON "sigma_support_tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_tickets_estado" ON "sigma_support_tickets" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_tickets_numero" ON "sigma_support_tickets" USING btree ("numero_ticket");--> statement-breakpoint
CREATE INDEX "idx_sigma_support_tickets_severidad" ON "sigma_support_tickets" USING btree ("severidad");--> statement-breakpoint
CREATE INDEX "idx_support_extensions_access" ON "sigma_support_access_extensions" USING btree ("original_access_id");--> statement-breakpoint
CREATE INDEX "idx_support_extensions_request" ON "sigma_support_access_extensions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_support_requests_tenant" ON "sigma_support_access_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_support_requests_requester" ON "sigma_support_access_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "idx_support_requests_status" ON "sigma_support_access_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_support_requests_expires" ON "sigma_support_access_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_support_jit_policies_tenant" ON "sigma_support_jit_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_catalog_sync_alerts_catalog" ON "catalog_sync_alerts" USING btree ("catalog_name");--> statement-breakpoint
CREATE INDEX "idx_catalog_sync_alerts_severity" ON "catalog_sync_alerts" USING btree ("severity","created_at");--> statement-breakpoint
CREATE INDEX "idx_catalog_sync_history_catalog" ON "catalog_sync_history" USING btree ("catalog_name","created_at");--> statement-breakpoint
CREATE INDEX "idx_catalog_sync_history_status" ON "catalog_sync_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_catalog_versions_name" ON "catalog_versions" USING btree ("catalog_name");--> statement-breakpoint
CREATE INDEX "idx_catalog_versions_status" ON "catalog_versions" USING btree ("sync_status","last_sync_at");--> statement-breakpoint
CREATE INDEX "idx_feature_flag_evaluations_flagId" ON "feature_flag_evaluations" USING btree ("flag_id");--> statement-breakpoint
CREATE INDEX "idx_feature_flag_evaluations_tenantId" ON "feature_flag_evaluations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_feature_flag_evaluations_createdAt" ON "feature_flag_evaluations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_feature_flag_evaluations_flag_tenant" ON "feature_flag_evaluations" USING btree ("flag_id","tenant_id");--> statement-breakpoint
CREATE INDEX "idx_feature_flag_history_flagId" ON "feature_flag_history" USING btree ("flag_id");--> statement-breakpoint
CREATE INDEX "idx_feature_flag_history_createdAt" ON "feature_flag_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_feature_flags_key" ON "feature_flags" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_feature_flags_habilitado" ON "feature_flags" USING btree ("habilitado");--> statement-breakpoint
CREATE INDEX "idx_feature_flags_categoria" ON "feature_flags" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "idx_feature_flags_estrategia" ON "feature_flags" USING btree ("estrategia");