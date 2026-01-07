CREATE TABLE "emisor" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facturas" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"fec_emi" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secuencial_control" (
	"id" serial PRIMARY KEY NOT NULL,
	"emisor_nit" text NOT NULL,
	"tipo_dte" text NOT NULL,
	"secuencial" integer DEFAULT 1 NOT NULL,
	"ultimo_numero_control" text,
	"fecha_creacion" timestamp DEFAULT now() NOT NULL,
	"fecha_actualizacion" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "secuencial_control_emisor_nit_tipo_dte_unique" UNIQUE("emisor_nit","tipo_dte")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
